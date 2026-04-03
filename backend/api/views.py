from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework import viewsets, permissions, generics, filters, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.conf import settings
from django.db import transaction
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Card_Master, Card_Listing, Order, OrderStatusChoices, Set_Master, CardPrice, CardPriceHistory,
    Offer, OfferStatusChoices, Transaction, TransactionStatusChoices, CardGrade,
)
from .serializers import (
    CardMasterSerializer, CardMasterListSerializer, CardListingSerializer,
    OrderSerializer, SetMasterSerializer, UserProfileSerializer,
    CardPriceSerializer, CardPriceHistorySerializer,
    OfferSerializer, TransactionSerializer, CardGradeSerializer,
)
from .permissions import IsSellerOrReadOnly
from .filters import CardListingFilter, CardMasterFilter
from .emails import (
    send_order_confirmation, send_offer_received, send_offer_response,
)


@api_view(['GET'])
def api_root(request, format=None):
    return Response({
        'master-cards-list': reverse('cardmaster-list', request=request, format=format),
        'card-listings-list': reverse('cardlisting-list', request=request, format=format),
        'orders-list': reverse('order-list', request=request, format=format),
        'user-details': reverse('rest_user_details', request=request, format=format),
        'login': reverse('rest_login', request=request, format=format),
        'logout': reverse('rest_logout', request=request, format=format),
    })


class CardMasterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Card_Master.objects.select_related('set').all()
    serializer_class = CardMasterSerializer
    permission_classes = [permissions.AllowAny]


class CardMasterListAPIView(generics.ListAPIView):
    """
    List cards with search, filtering by supertype/rarity/types/set/artist.
    Default ordering: by set release date then numeric card number.
    Supports ?lang= for filtering by translation availability.
    """
    serializer_class = CardMasterListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [SearchFilter, DjangoFilterBackend]
    search_fields = ['card_name', 'secondary_id']
    filterset_class = CardMasterFilter

    def get_queryset(self):
        from django.db.models.functions import Cast
        from django.db.models import IntegerField

        queryset = Card_Master.objects.select_related('set').annotate(
            card_number_int=Cast('card_number', IntegerField())
        )

        lang = self.request.query_params.get('lang')
        if lang and lang != 'en':
            queryset = queryset.filter(translations__language=lang)

        ordering = self.request.query_params.get('ordering', '')

        if ordering in ('', 'card_number', '-card_number'):
            direction = '-' if ordering.startswith('-') else ''
            queryset = queryset.order_by(
                'set__release_date', f'{direction}card_number_int', f'{direction}card_number'
            )
        elif ordering.lstrip('-') in ('card_name', 'card_rarity', 'hp'):
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by(
                'set__release_date', 'card_number_int', 'card_number'
            )

        return queryset


class CardMasterDetailAPIView(generics.RetrieveAPIView):
    queryset = Card_Master.objects.select_related('set').prefetch_related(
        'translations', 'prices'
    ).all()
    serializer_class = CardMasterSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'api_id'

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Always include prices in detail view
        if self.request:
            self.request.query_params._mutable = True
            self.request.query_params['include_prices'] = 'true'
            self.request.query_params._mutable = False
        return context


class CardDetailWithStatsAPIView(generics.RetrieveAPIView):
    queryset = Card_Master.objects.all()
    permission_classes = [permissions.AllowAny]
    lookup_field = 'api_id'

    def retrieve(self, request, *args, **kwargs):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Avg, Min, Max, Count, Q

        card = self.get_object()

        # Get all available listings for this card
        listings = Card_Listing.objects.filter(
            card_master=card,
            is_available=True,
        ).select_related('seller', 'card_master').order_by('price_chf')

        listing_serializer = CardListingSerializer(listings, many=True)

        # Price statistics from listings
        price_stats = listings.aggregate(
            min_price=Min('price_chf'),
            max_price=Max('price_chf'),
            avg_price=Avg('price_chf'),
            total_listings=Count('id'),
        )

        # Market prices from pokemontcg.io
        market_prices = CardPriceSerializer(
            card.prices.all(), many=True
        ).data

        # Card translations
        from .serializers import CardTranslationSerializer
        translations = CardTranslationSerializer(
            card.translations.all(), many=True
        ).data

        # Card detail
        card_serializer = CardMasterSerializer(card, context={'request': request})

        return Response({
            'card': card_serializer.data,
            'listings': listing_serializer.data,
            'translations': translations,
            'market_prices': market_prices,
            'statistics': {
                'min_price': float(price_stats['min_price']) if price_stats['min_price'] else None,
                'max_price': float(price_stats['max_price']) if price_stats['max_price'] else None,
                'avg_price': float(price_stats['avg_price']) if price_stats['avg_price'] else None,
                'total_listings': price_stats['total_listings'],
            },
        })


class CardPriceHistoryAPIView(generics.GenericAPIView):
    """
    Returns price history for a card grouped by source+variant.
    Query params:
      ?source=tcgplayer|cardmarket
      ?variant=holofoil|normal|...
      ?days=30|90|365 (default 90)
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        from django.utils import timezone
        from datetime import timedelta

        days    = int(request.query_params.get('days', 90))
        source  = request.query_params.get('source', '')
        variant = request.query_params.get('variant', '')
        since   = timezone.now() - timedelta(days=days)

        qs = CardPriceHistory.objects.filter(
            card_master_id=api_id,
            fetched_at__gte=since,
        ).order_by('fetched_at')

        if source:
            qs = qs.filter(source=source)
        if variant:
            qs = qs.filter(variant=variant)

        data = CardPriceHistorySerializer(qs, many=True).data

        # Group by source+variant for the frontend chart
        groups = {}
        for row in data:
            key = f"{row['source']}/{row['variant']}"
            if key not in groups:
                groups[key] = {
                    'source': row['source'],
                    'variant': row['variant'],
                    'currency': row['currency'],
                    'points': [],
                }
            groups[key]['points'].append({
                'date': row['fetched_at'][:10],
                'market': row['market'],
                'low': row['low'],
                'mid': row['mid'],
            })

        return Response(list(groups.values()))


class SetListAPIView(generics.ListAPIView):
    serializer_class = SetMasterSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['set_name', 'set_code', 'series']
    ordering_fields = ['set_name', 'release_date', 'set_code', 'series']
    ordering = ['-release_date']

    def get_queryset(self):
        from django.db.models import OuterRef, Subquery
        language = self.request.query_params.get('language', 'en')
        queryset = Set_Master.objects.prefetch_related('translations').filter(language=language)
        series = self.request.query_params.get('series')
        if series:
            queryset = queryset.filter(series__icontains=series)
        if language != 'en':
            english_name_sq = Set_Master.objects.filter(
                set_code=OuterRef('set_code'), language='en'
            ).values('set_name')[:1]
            queryset = queryset.annotate(english_name=Subquery(english_name_sq))
        return queryset


class DatabaseStatsAPIView(generics.GenericAPIView):
    """Returns database-level statistics."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Count
        from .models import CardTranslation, SetTranslation

        total_cards = Card_Master.objects.count()
        total_sets = Set_Master.objects.count()

        rarity_known = Card_Master.objects.exclude(
            card_rarity__in=['Unknown', '', None]
        ).count()

        cards_with_prices = CardPrice.objects.values('card_master').distinct().count()

        translation_stats = (
            CardTranslation.objects
            .values('language')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        supertype_stats = (
            Card_Master.objects
            .exclude(supertype='')
            .values('supertype')
            .annotate(count=Count('api_id'))
            .order_by('-count')
        )

        return Response({
            'total_cards': total_cards,
            'total_sets': total_sets,
            'rarity_known': rarity_known,
            'rarity_unknown': total_cards - rarity_known,
            'cards_with_prices': cards_with_prices,
            'translations': {
                item['language']: item['count']
                for item in translation_stats
            },
            'supertypes': {
                item['supertype']: item['count']
                for item in supertype_stats
            },
        })


class CardListingViewSet(viewsets.ModelViewSet):
    queryset = Card_Listing.objects.select_related(
        'card_master', 'seller', 'card_master__set'
    ).all()
    serializer_class = CardListingSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CardListingFilter
    search_fields = ['card_master__card_name', 'card_master__secondary_id', 'seller__username']
    ordering_fields = ['price_chf', 'id', 'card_master__card_name']
    ordering = ['-id']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [permissions.IsAuthenticated, IsSellerOrReadOnly]
        else:
            permission_classes = [permissions.AllowAny]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = super().get_queryset()

        if self.request.query_params.get('my_listings') == 'true' and self.request.user.is_authenticated:
            queryset = queryset.filter(seller=self.request.user)

        if self.request.query_params.get('include_unavailable') != 'true':
            queryset = queryset.filter(is_available=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(seller=self.request.user, is_available=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Order.objects.select_related(
            'listing', 'listing__card_master', 'listing__seller'
        )

        if self.request.query_params.get('seller') == 'true':
            return queryset.filter(listing__seller=self.request.user)

        return queryset.filter(buyer=self.request.user)

    def perform_create(self, serializer):
        order = serializer.save(buyer=self.request.user)
        send_order_confirmation(order)

    def perform_update(self, serializer):
        allowed_fields = {'status'}
        if set(serializer.validated_data.keys()) - allowed_fields:
            raise ValidationError('Only status updates are allowed.')

        with transaction.atomic():
            order = (
                Order.objects
                .select_for_update()
                .select_related('listing', 'listing__seller')
                .get(pk=self.get_object().pk)
            )
            listing = (
                Card_Listing.objects
                .select_for_update()
                .get(pk=order.listing_id)
            )

            new_status = serializer.validated_data.get('status', order.status)
            if new_status == order.status:
                serializer.instance = order
                return

            if order.status != 'PENDING':
                raise ValidationError('Only pending orders can be updated.')

            if order.listing.seller == self.request.user:
                if new_status not in ['COMPLETED', 'CANCELLED']:
                    raise ValidationError('Invalid status transition.')
            else:
                raise PermissionDenied('Only the seller can update this order.')

            if new_status == 'CANCELLED':
                listing.quantity += order.quantity
                listing.is_available = listing.quantity > 0
                listing.save(update_fields=['quantity', 'is_available'])

            order.status = new_status
            order.save(update_fields=['status'])
            serializer.instance = order


    @action(detail=True, methods=['post'], url_path='create-payment-intent')
    def create_payment_intent(self, request, pk=None):
        """
        Create a Stripe PaymentIntent for a PENDING order and record a Transaction.
        Returns {client_secret, payment_intent_id}.
        """
        order = self.get_object()

        if order.buyer != request.user:
            raise PermissionDenied("You can only pay for your own orders.")
        if order.status != OrderStatusChoices.PENDING:
            raise ValidationError("Only pending orders can be paid.")

        # Idempotent: return existing PaymentIntent if one already exists
        if hasattr(order, 'transaction'):
            txn = order.transaction
            try:
                import stripe
                stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
                pi = stripe.PaymentIntent.retrieve(txn.stripe_payment_intent_id)
                return Response({
                    'client_secret': pi['client_secret'],
                    'payment_intent_id': pi['id'],
                })
            except Exception:
                pass

        try:
            import stripe
        except ImportError:
            return Response(
                {'detail': 'Stripe not installed on server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        stripe.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        if not stripe.api_key:
            return Response(
                {'detail': 'Stripe is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        amount_cents = int(order.price_chf * order.quantity * 100)

        try:
            pi = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='chf',
                metadata={
                    'order_id': str(order.id),
                    'buyer_id': str(request.user.id),
                },
            )
        except stripe.error.StripeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        Transaction.objects.create(
            order=order,
            stripe_payment_intent_id=pi['id'],
            amount_chf=order.price_chf * order.quantity,
            status=TransactionStatusChoices.PENDING,
        )

        return Response({
            'client_secret': pi['client_secret'],
            'payment_intent_id': pi['id'],
        })


# ---------------------------------------------------------------------------
# Phase 2 viewsets
# ---------------------------------------------------------------------------

class OfferViewSet(viewsets.ModelViewSet):
    """
    Buyers create offers; sellers accept/decline/counter.
    - POST   /api/offers/                  — buyer creates offer
    - GET    /api/offers/                  — list own offers (buyer or seller via ?as_seller=true)
    - PATCH  /api/offers/{id}/             — seller responds (ACCEPTED/DECLINED/COUNTERED)
    - POST   /api/offers/{id}/accept/      — seller accepts, auto-creates order
    - POST   /api/offers/{id}/decline/     — seller declines
    - POST   /api/offers/{id}/counter/     — seller counters with new price
    - DELETE /api/offers/{id}/             — buyer withdraws a PENDING offer
    """
    serializer_class = OfferSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # For list action, apply buyer/seller filter; for detail/custom actions, allow both.
        if self.action == 'list':
            if self.request.query_params.get('as_seller') == 'true':
                return Offer.objects.filter(listing__seller=user).select_related(
                    'listing', 'listing__card_master', 'buyer'
                )
            return Offer.objects.filter(buyer=user).select_related(
                'listing', 'listing__card_master', 'buyer'
            )
        from django.db.models import Q
        return Offer.objects.filter(
            Q(buyer=user) | Q(listing__seller=user)
        ).select_related('listing', 'listing__card_master', 'buyer')

    def perform_create(self, serializer):
        from django.utils import timezone
        from datetime import timedelta
        expires_at = timezone.now() + timedelta(hours=48)
        offer = serializer.save(buyer=self.request.user, expires_at=expires_at)
        send_offer_received(offer)

    def perform_update(self, serializer):
        offer = self.get_object()
        if offer.listing.seller != self.request.user:
            raise PermissionDenied("Only the listing seller can respond to offers.")
        if offer.status != OfferStatusChoices.PENDING:
            raise ValidationError("Only pending offers can be updated.")
        updated = serializer.save()
        if updated.status in (OfferStatusChoices.ACCEPTED, OfferStatusChoices.DECLINED, OfferStatusChoices.COUNTERED):
            send_offer_response(updated)

    def destroy(self, request, *args, **kwargs):
        offer = self.get_object()
        if offer.buyer != request.user:
            raise PermissionDenied("Only the buyer can withdraw their offer.")
        if offer.status != OfferStatusChoices.PENDING:
            raise ValidationError("Only pending offers can be withdrawn.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """
        Seller accepts the offer. Creates an Order at the offer price and marks the offer ACCEPTED.
        Returns the created order.
        """
        offer = self.get_object()
        if offer.listing.seller != request.user:
            raise PermissionDenied("Only the listing seller can accept offers.")
        if offer.status != OfferStatusChoices.PENDING:
            raise ValidationError("Only pending offers can be accepted.")

        profile = getattr(request.user, 'profile', None)

        with transaction.atomic():
            listing = (
                Card_Listing.objects
                .select_for_update()
                .get(pk=offer.listing_id)
            )
            if not listing.is_available:
                raise ValidationError("The listing is no longer available.")
            if listing.quantity < 1:
                raise ValidationError("Insufficient stock.")

            listing.quantity -= 1
            if listing.quantity <= 0:
                listing.quantity = 0
                listing.is_available = False
            listing.save(update_fields=['quantity', 'is_available'])

            order = Order.objects.create(
                listing=listing,
                buyer=offer.buyer,
                quantity=1,
                price_chf=offer.offer_price_chf,
                shipping_name=profile.shipping_name if profile else '',
                shipping_address_line1=profile.shipping_address_line1 if profile else '',
                shipping_address_line2=getattr(profile, 'shipping_address_line2', None) if profile else None,
                shipping_city=profile.shipping_city if profile else '',
                shipping_postal_code=profile.shipping_postal_code if profile else '',
                shipping_country=profile.shipping_country if profile else '',
                status=OrderStatusChoices.PENDING,
            )

            offer.status = OfferStatusChoices.ACCEPTED
            offer.save(update_fields=['status', 'updated_at'])

        send_offer_response(offer)
        send_order_confirmation(order)
        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Seller declines the offer."""
        offer = self.get_object()
        if offer.listing.seller != request.user:
            raise PermissionDenied("Only the listing seller can decline offers.")
        if offer.status != OfferStatusChoices.PENDING:
            raise ValidationError("Only pending offers can be declined.")

        offer.status = OfferStatusChoices.DECLINED
        offer.save(update_fields=['status', 'updated_at'])
        send_offer_response(offer)
        return Response(OfferSerializer(offer, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def counter(self, request, pk=None):
        """Seller counters with a new price."""
        offer = self.get_object()
        if offer.listing.seller != request.user:
            raise PermissionDenied("Only the listing seller can counter offers.")
        if offer.status != OfferStatusChoices.PENDING:
            raise ValidationError("Only pending offers can be countered.")

        counter_price = request.data.get('counter_price_chf')
        if not counter_price:
            raise ValidationError({'counter_price_chf': 'This field is required.'})
        try:
            from decimal import Decimal, InvalidOperation
            counter_price = Decimal(str(counter_price))
            if counter_price <= 0:
                raise ValidationError({'counter_price_chf': 'Counter price must be positive.'})
        except InvalidOperation:
            raise ValidationError({'counter_price_chf': 'Invalid price value.'})

        offer.counter_price_chf = counter_price
        offer.status = OfferStatusChoices.COUNTERED
        offer.save(update_fields=['counter_price_chf', 'status', 'updated_at'])
        send_offer_response(offer)
        return Response(OfferSerializer(offer, context={'request': request}).data)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only view of Stripe transactions.
    Buyers see transactions for their orders; sellers see transactions for their listings' orders.
    Full create/update is handled by the Stripe webhook handler (see stripe_webhooks.py).
    """
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if self.request.query_params.get('as_seller') == 'true':
            return Transaction.objects.filter(
                order__listing__seller=user
            ).select_related('order', 'order__listing')
        return Transaction.objects.filter(
            order__buyer=user
        ).select_related('order', 'order__listing')


class CardGradeViewSet(viewsets.ModelViewSet):
    """
    CRUD for professional grading certificates tied to a listing.
    Only the listing seller can create/update/delete a grade record.
    """
    serializer_class = CardGradeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CardGrade.objects.select_related('listing', 'listing__card_master').all()

    def perform_create(self, serializer):
        listing = serializer.validated_data['listing']
        if listing.seller != self.request.user:
            raise PermissionDenied("Only the listing seller can add grading details.")
        serializer.save()

    def perform_update(self, serializer):
        if serializer.instance.listing.seller != self.request.user:
            raise PermissionDenied("Only the listing seller can update grading details.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.listing.seller != self.request.user:
            raise PermissionDenied("Only the listing seller can delete grading details.")
        instance.delete()


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class RarityListAPIView(generics.GenericAPIView):
    """Returns distinct rarities, optionally filtered by set_code or series."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        language = request.query_params.get('language', 'en')
        queryset = Card_Master.objects.filter(language=language).exclude(card_rarity__in=['Unknown', '', None])

        set_code = request.query_params.get('set_code')
        if set_code:
            queryset = queryset.filter(set__set_code=set_code)

        series = request.query_params.get('series')
        if series:
            queryset = queryset.filter(set__series=series)

        rarities = queryset.values_list('card_rarity', flat=True).distinct().order_by('card_rarity')
        return Response(sorted(set(rarities)))


class SeriesListAPIView(generics.GenericAPIView):
    """Returns distinct series names with set counts, ordered by release date."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Count, Min

        language = request.query_params.get('language', 'en')
        series_qs = list(
            Set_Master.objects
            .filter(language=language)
            .exclude(series__in=['', None])
            .values('series')
            .annotate(set_count=Count('set_code'), earliest=Min('release_date'), representative=Min('set_code'))
            .order_by('earliest')
        )

        if language != 'en':
            rep_codes = [s['representative'] for s in series_qs]
            en_map = {
                row['set_code']: row['series']
                for row in Set_Master.objects.filter(
                    set_code__in=rep_codes, language='en'
                ).values('set_code', 'series')
            }
            return Response([
                {
                    'series': s['series'],
                    'set_count': s['set_count'],
                    'english_series': en_map.get(s['representative']),
                }
                for s in series_qs
            ])

        return Response([
            {'series': s['series'], 'set_count': s['set_count']}
            for s in series_qs
        ])
