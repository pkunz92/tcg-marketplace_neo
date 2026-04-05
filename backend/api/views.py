from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework import viewsets, permissions, generics, filters, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.conf import settings
from django.core.cache import cache
from django.db import connection, transaction
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    Card_Master, Card_Listing, Order, OrderStatusChoices, Set_Master, CardPrice, CardPriceHistory,
    Offer, OfferStatusChoices, Transaction, TransactionStatusChoices, CardGrade, ListingPhoto,
    Review, PriceSoldSnapshot,
)
from .serializers import (
    CardMasterSerializer, CardMasterListSerializer, CardListingSerializer,
    OrderSerializer, SetMasterSerializer, UserProfileSerializer,
    CardPriceSerializer, CardPriceHistorySerializer,
    OfferSerializer, TransactionSerializer, CardGradeSerializer, ListingPhotoSerializer,
    ReviewSerializer, ReputationSerializer, PriceSoldSnapshotSerializer,
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
    filter_backends = [SearchFilter, DjangoFilterBackend]
    filterset_class = CardMasterFilter
    search_fields = ['card_name', 'secondary_id']


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

    def perform_update(self, serializer):
        instance = self.get_object()
        # Enforce mandatory photo when publishing (setting is_available=True)
        making_available = serializer.validated_data.get('is_available', instance.is_available)
        if making_available and instance.requires_photo:
            has_photo = ListingPhoto.objects.filter(
                listing=instance, is_deleted=False
            ).exists()
            if not has_photo:
                from rest_framework.exceptions import ValidationError as DRFValidationError
                raise DRFValidationError({
                    'code': 'PHOTO_REQUIRED',
                    'threshold': {
                        'min_value_chf': instance.PHOTO_REQUIRED_VALUE_THRESHOLD,
                        'rarities': list(instance.PHOTO_REQUIRED_RARITIES),
                    },
                    'detail': (
                        'A photo is required before publishing this listing. '
                        'Upload a photo via POST /api/photos/presign first.'
                    ),
                })
        serializer.save()

    def list(self, request, *args, **kwargs):
        """
        Override list to apply a short-lived in-process cache (30 s default).
        Only unauthenticated / public list calls are cached (my_listings=true and
        any authenticated call bypass cache so per-user data is never shared).
        """
        from .signals import LISTING_CACHE_PREFIX

        bypass = (
            request.user.is_authenticated
            or request.query_params.get('my_listings') == 'true'
        )
        if bypass:
            return super().list(request, *args, **kwargs)

        # Build a cache key from the sorted query string so each unique filter
        # combination gets its own cached page.
        sorted_params = '&'.join(
            f'{k}={v}'
            for k, v in sorted(request.query_params.items())
        )
        cache_key = f'{LISTING_CACHE_PREFIX}list:{sorted_params}'

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data)
        return response

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


_CONDITION_TO_PSA = {"MT": 10, "NM": 9, "LP": 7, "MP": 5, "HP": 3, "DMG": 1}


class AnalyzePhotoView(generics.GenericAPIView):
    """
    POST /api/listings/analyze-photo/

    Accepts a card photo (multipart field ``photo``) and runs it through the
    ML pre-grading pipeline:
      1. Photo quality validation — rejects blurry / low-res / no-card images.
      2. Card recognition — returns up to 3 card name candidates with confidence scores.
      3. Condition grading — returns suggested condition on both the internal
         MT/NM/LP/MP/HP/DMG scale and an approximate PSA 1-10 grade.

    Response 200 (success):
    {
      "card_suggestions": [
        {"card_name": "Charizard", "set_name": "Base Set", "card_id": "base1-4",
         "confidence": 0.91, "method": "hash_index"},
        ...
      ],
      "grading": {
        "suggested_condition": "NM",
        "suggested_psa_grade": 9,
        "confidence": 0.74,
        "confidence_breakdown": {"MT": 0.09, "NM": 0.74, ...},
        "issues_detected": [],
        "method": "heuristic"
      },
      "photo_quality": {"ok": true, "warnings": []}
    }

    Response 400 (photo rejected):
    {"error": "photo_quality_failure", "details": [...], "warnings": [...]}
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes_override = None  # resolved at request time via DRF

    def post(self, request, *args, **kwargs):
        import numpy as np
        import cv2
        from .ml import card_normalizer, card_recognizer, grader, photo_validator

        photo = request.FILES.get("photo")
        if photo is None:
            raise ValidationError({"photo": "This field is required."})

        file_bytes = photo.read()
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            raise ValidationError({"photo": "Cannot decode image. Provide a valid JPEG, PNG, or WebP file."})

        # 1. Photo quality validation
        validation = photo_validator.validate(img_bgr)
        if not validation.ok:
            return Response(
                {
                    "error": "photo_quality_failure",
                    "details": validation.errors,
                    "warnings": validation.warnings,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Normalise
        normalised, _warped = card_normalizer.normalize(img_bgr)

        # 3. Card recognition — top 3 candidates
        top_matches = card_recognizer.recognize_top_k(normalised, k=3)
        card_suggestions = [
            {
                "card_name": r.card_name,
                "set_name": r.set_name,
                "card_id": r.card_id,
                "confidence": r.confidence,
                "method": r.method,
            }
            for r in top_matches
        ]

        # 4. Condition grading
        grade_result = grader.grade(normalised)

        return Response(
            {
                "card_suggestions": card_suggestions,
                "grading": {
                    "suggested_condition": grade_result.suggested_condition,
                    "suggested_psa_grade": _CONDITION_TO_PSA.get(grade_result.suggested_condition),
                    "confidence": grade_result.confidence,
                    "confidence_breakdown": grade_result.confidence_breakdown,
                    "issues_detected": grade_result.issues_detected,
                    "method": grade_result.method,
                },
                "photo_quality": {
                    "ok": True,
                    "warnings": validation.warnings,
                },
            },
            status=status.HTTP_200_OK,
        )


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


# ---------------------------------------------------------------------------
# Phase 3 / Phase 5D: Object Storage (S3 or Cloudflare R2) + CDN
# ---------------------------------------------------------------------------

def _get_r2_client():
    """Return a boto3 S3-compatible client pointed at Cloudflare R2, or None."""
    from django.conf import settings as django_settings
    try:
        import boto3
    except ImportError:
        return None
    account_id = getattr(django_settings, 'CLOUDFLARE_R2_ACCOUNT_ID', '')
    key_id = getattr(django_settings, 'CLOUDFLARE_R2_ACCESS_KEY_ID', '')
    secret = getattr(django_settings, 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', '')
    if not (account_id and key_id and secret):
        return None
    endpoint = f'https://{account_id}.r2.cloudflarestorage.com'
    return boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name='auto',
    )


def _get_s3_client():
    """Return a boto3 S3 client, or None if AWS credentials are absent."""
    from django.conf import settings as django_settings
    try:
        import boto3
    except ImportError:
        return None
    key_id = getattr(django_settings, 'AWS_ACCESS_KEY_ID', '')
    secret = getattr(django_settings, 'AWS_SECRET_ACCESS_KEY', '')
    region = getattr(django_settings, 'AWS_REGION', 'us-east-1')
    if not (key_id and secret):
        return None
    return boto3.client(
        's3',
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name=region,
    )


def _get_storage_client_and_bucket():
    """
    Return (client, bucket, is_r2) for whichever storage backend is configured.
    Prefers Cloudflare R2 when CLOUDFLARE_R2_* env vars are present.
    """
    from django.conf import settings as django_settings
    r2_client = _get_r2_client()
    r2_bucket = getattr(django_settings, 'CLOUDFLARE_R2_BUCKET', '')
    if r2_client and r2_bucket:
        return r2_client, r2_bucket, True

    s3_client = _get_s3_client()
    s3_bucket = getattr(django_settings, 'AWS_S3_BUCKET', '')
    return s3_client, s3_bucket, False


def _public_photo_url(s3_key: str, bucket: str, is_r2: bool) -> str:
    """
    Build the public URL for a stored photo.
    Uses CDN_BASE_URL when set; otherwise falls back to the native bucket URL.
    """
    from django.conf import settings as django_settings
    cdn = getattr(django_settings, 'CDN_BASE_URL', '').rstrip('/')
    if cdn:
        return f'{cdn}/{s3_key}'
    if is_r2:
        account_id = getattr(django_settings, 'CLOUDFLARE_R2_ACCOUNT_ID', '')
        return f'https://{account_id}.r2.cloudflarestorage.com/{bucket}/{s3_key}'
    region = getattr(django_settings, 'AWS_REGION', 'us-east-1')
    return f'https://{bucket}.s3.{region}.amazonaws.com/{s3_key}'


class PresignPhotoView(generics.GenericAPIView):
    """
    POST /api/photos/presign

    Generate a presigned upload URL for a listing photo.
    Uses Cloudflare R2 when CLOUDFLARE_R2_* env vars are set; falls back to AWS S3.

    Request body: { "listingId": <int>, "mimeType": "image/jpeg", "sizeBytes": <int> }
    Response 200: { "uploadUrl": "...", "photoId": <int>, "key": "...", "cdnUrl": "..." }
    Response 503: No object-storage backend configured.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        from django.conf import settings as django_settings
        import uuid

        listing_id = request.data.get('listingId')
        mime_type = request.data.get('mimeType', 'image/jpeg')
        size_bytes = request.data.get('sizeBytes')

        if not listing_id:
            raise ValidationError({'listingId': 'This field is required.'})

        try:
            listing = Card_Listing.objects.get(pk=listing_id, seller=request.user)
        except Card_Listing.DoesNotExist:
            raise ValidationError({'listingId': 'Listing not found or not owned by you.'})

        client, bucket, is_r2 = _get_storage_client_and_bucket()
        if not client or not bucket:
            return Response(
                {'error': 'Object storage is not configured on this server.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ext = mime_type.split('/')[-1] if '/' in mime_type else 'jpg'
        key = f"listing-photos/{listing_id}/{uuid.uuid4()}.{ext}"

        expiry = getattr(django_settings, 'AWS_PRESIGN_EXPIRY', 3600)
        upload_url = client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket,
                'Key': key,
                'ContentType': mime_type,
            },
            ExpiresIn=expiry,
        )

        photo = ListingPhoto.objects.create(
            listing=listing,
            s3_key=key,
            s3_bucket=bucket,
            mime_type=mime_type,
            size_bytes=size_bytes,
        )

        cdn_url = _public_photo_url(key, bucket, is_r2)
        return Response({
            'uploadUrl': upload_url,
            'photoId': photo.id,
            'key': key,
            'cdnUrl': cdn_url,
        }, status=status.HTTP_200_OK)


class ListingPhotosView(generics.ListAPIView):
    """
    GET /api/listings/<listing_id>/photos/

    List all non-deleted photos for a listing.
    Images are served via CDN so responses carry a long-lived cache header.
    """
    serializer_class = ListingPhotoSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        listing_id = self.kwargs['listing_id']
        return ListingPhoto.objects.filter(listing_id=listing_id, is_deleted=False)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Photos are immutable once uploaded – safe to cache aggressively.
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
        return response


class PhotoDeleteView(generics.DestroyAPIView):
    """
    DELETE /api/photos/<pk>/

    Soft-delete a photo (only the listing seller can do this).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            photo = ListingPhoto.objects.select_related('listing').get(
                pk=self.kwargs['pk'], is_deleted=False
            )
        except ListingPhoto.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Photo not found.')
        if photo.listing.seller != self.request.user:
            raise PermissionDenied('Only the listing seller can delete photos.')
        return photo

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted'])


# ---------------------------------------------------------------------------
# Phase 3: Auto-Grading Webhook (async background thread)
# ---------------------------------------------------------------------------

def _run_grading_job(photo_id: int):
    """
    Background job: call ML grading service, write result back to listing.
    Falls back to mock response when ML_GRADING_SERVICE_URL is not set.
    """
    import threading
    import requests as http_requests
    import django
    from django.conf import settings as django_settings

    django.setup()

    try:
        photo = ListingPhoto.objects.select_related('listing').get(pk=photo_id, is_deleted=False)
    except ListingPhoto.DoesNotExist:
        return

    listing = photo.listing
    listing.grading_status = 'processing'
    listing.save(update_fields=['grading_status'])

    _client, bucket, is_r2 = _get_storage_client_and_bucket()
    if _client and bucket:
        photo_url = _public_photo_url(photo.s3_key, bucket, is_r2)
    else:
        photo_url = ''

    ml_url = getattr(django_settings, 'ML_GRADING_SERVICE_URL', '')
    grade_result = None

    if ml_url and photo_url:
        try:
            resp = http_requests.post(
                ml_url,
                json={'photoUrl': photo_url},
                timeout=30,
            )
            resp.raise_for_status()
            ml_data = resp.json()
            grade_result = {
                'grade': ml_data.get('grade'),
                'confidence': ml_data.get('confidence'),
                'detectedCard': {
                    'set': ml_data.get('detectedSet'),
                    'name': ml_data.get('detectedName'),
                    'rarity': ml_data.get('detectedRarity'),
                },
            }
        except Exception:
            pass

    if grade_result is None:
        # Mock response when ML service unavailable
        grade_result = {
            'grade': 'NM',
            'confidence': 0.75,
            'detectedCard': None,
            '_mock': True,
        }

    listing.auto_grade = grade_result
    listing.grading_status = 'complete'
    listing.save(update_fields=['auto_grade', 'grading_status'])


class GradePhotoWebhookView(generics.GenericAPIView):
    """
    POST /internal/grade-photo

    Internal endpoint: trigger auto-grading for a photo after S3 upload confirmation.
    Enqueues a background thread job.

    Request body: { "photoId": <int> }
    Response 202: { "status": "queued", "photoId": <int> }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        import threading

        photo_id = request.data.get('photoId')
        if not photo_id:
            raise ValidationError({'photoId': 'This field is required.'})

        try:
            photo = ListingPhoto.objects.select_related('listing').get(
                pk=photo_id, is_deleted=False
            )
        except ListingPhoto.DoesNotExist:
            raise ValidationError({'photoId': 'Photo not found.'})

        if photo.listing.seller != request.user:
            raise PermissionDenied('Only the listing seller can trigger grading.')

        photo.listing.grading_status = 'queued'
        photo.listing.save(update_fields=['grading_status'])

        t = threading.Thread(target=_run_grading_job, args=(photo_id,), daemon=True)
        t.start()

        return Response({'status': 'queued', 'photoId': photo_id}, status=status.HTTP_202_ACCEPTED)


# ---------------------------------------------------------------------------
# Phase 3: Bulk CSV Listing Upload
# ---------------------------------------------------------------------------

class BulkListingUploadView(generics.GenericAPIView):
    """
    POST /api/listings/bulk/

    Accepts a multipart CSV file (field name: ``file``) with the following columns:
      card_master_id, price_chf, quantity, condition, is_graded[, photo_key]

    Optional ``photo_key`` column: an S3 key for an already-uploaded photo.
    Associates that key with the created listing record.

    Returns: { "created": <int>, "errors": [{ "row": <int>, "detail": "..." }] }
    """
    permission_classes = [permissions.IsAuthenticated]

    REQUIRED_COLUMNS = {'card_master_id', 'price_chf', 'quantity', 'condition'}
    VALID_CONDITIONS = {'MT', 'NM', 'LP', 'MP', 'HP', 'DMG'}
    VALID_GRADING = {'RAW', 'PSA', 'BGS', 'CGC', 'TAG', 'ACE'}

    def post(self, request, *args, **kwargs):
        import csv
        import io
        from django.conf import settings as django_settings

        uploaded = request.FILES.get('file')
        if uploaded is None:
            raise ValidationError({'file': 'A CSV file is required.'})

        try:
            text = uploaded.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            raise ValidationError({'file': 'File must be UTF-8 encoded.'})

        reader = csv.DictReader(io.StringIO(text))
        columns = set(reader.fieldnames or [])
        missing = self.REQUIRED_COLUMNS - columns
        if missing:
            raise ValidationError({'file': f'Missing required columns: {", ".join(sorted(missing))}'})

        created_count = 0
        errors = []
        bucket = getattr(django_settings, 'AWS_S3_BUCKET', '')

        for row_num, row in enumerate(reader, start=2):  # row 1 = header
            try:
                card_id = row['card_master_id'].strip()
                try:
                    card = Card_Master.objects.get(api_id=card_id)
                except Card_Master.DoesNotExist:
                    raise ValueError(f"Card '{card_id}' not found.")

                try:
                    price = float(row['price_chf'])
                    if price <= 0:
                        raise ValueError()
                except (ValueError, KeyError):
                    raise ValueError('price_chf must be a positive number.')

                try:
                    qty = int(row['quantity'])
                    if qty < 1:
                        raise ValueError()
                except (ValueError, KeyError):
                    raise ValueError('quantity must be a positive integer.')

                condition = row['condition'].strip().upper()
                if condition not in self.VALID_CONDITIONS:
                    raise ValueError(f"condition must be one of {', '.join(sorted(self.VALID_CONDITIONS))}.")

                is_graded = row.get('is_graded', 'RAW').strip().upper() or 'RAW'
                if is_graded not in self.VALID_GRADING:
                    raise ValueError(f"is_graded must be one of {', '.join(sorted(self.VALID_GRADING))}.")

                photo_key = (row.get('photo_key') or '').strip()

                with transaction.atomic():
                    listing = Card_Listing.objects.create(
                        card_master=card,
                        seller=request.user,
                        price_chf=price,
                        quantity=qty,
                        condition=condition,
                        is_graded=is_graded,
                        is_available=True,
                    )
                    if photo_key and bucket:
                        ListingPhoto.objects.create(
                            listing=listing,
                            s3_key=photo_key,
                            s3_bucket=bucket,
                        )

                created_count += 1

            except (ValueError, Exception) as exc:
                errors.append({'row': row_num, 'detail': str(exc)})

        return Response(
            {'created': created_count, 'errors': errors},
            status=status.HTTP_207_MULTI_STATUS if errors else status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Phase 5A: Seller Reputation System & Buyer Reviews
# ---------------------------------------------------------------------------

from .reputation import compute_reputation as _compute_reputation


class OrderReviewCreateView(generics.CreateAPIView):
    """
    POST /api/orders/<pk>/review/
    Buyer submits a review for the seller of a delivered order.
    Enforces: order must be DELIVERED, caller must be the buyer, one review per order.
    """
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        order_id = self.kwargs['pk']
        try:
            order = Order.objects.select_related('listing__seller', 'buyer').get(pk=order_id)
        except Order.DoesNotExist:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.buyer != request.user:
            raise PermissionDenied("Only the buyer can submit a review.")

        if order.status != OrderStatusChoices.DELIVERED:
            return Response(
                {'detail': 'Reviews can only be submitted for delivered orders.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Review.objects.filter(order=order).exists():
            return Response(
                {'detail': 'You have already reviewed this order.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            order=order,
            reviewer=request.user,
            seller=order.listing.seller,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserReviewsView(generics.ListAPIView):
    """
    GET /api/users/<pk>/reviews/
    Returns all reviews received by the given seller user.
    """
    serializer_class = ReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        seller_id = self.kwargs['pk']
        try:
            seller = User.objects.get(pk=seller_id)
        except User.DoesNotExist:
            return Review.objects.none()
        return Review.objects.filter(seller=seller).select_related('reviewer', 'order__listing__card_master')


class UserReputationView(generics.GenericAPIView):
    """
    GET /api/users/<pk>/reputation/
    Returns the weighted reputation score for a seller.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = ReputationSerializer

    def get(self, request, pk, *args, **kwargs):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            seller = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        score, total, recent = _compute_reputation(seller)
        data = {
            'seller_id': seller.pk,
            'seller_username': seller.username,
            'score': score,
            'total_reviews': total,
            'recent_reviews': recent,
        }
        serializer = self.get_serializer(data)
        return Response(serializer.data)


class SellerPublicProfileView(generics.GenericAPIView):
    """
    GET /api/sellers/<pk>/
    Public seller profile: reputation + active listings.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk, *args, **kwargs):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            seller = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Seller not found.'}, status=status.HTTP_404_NOT_FOUND)

        score, total, recent = _compute_reputation(seller)
        listings_qs = Card_Listing.objects.filter(
            seller=seller, is_available=True
        ).select_related('card_master', 'card_master__set').order_by('-id')[:50]
        listings_data = CardListingSerializer(listings_qs, many=True, context={'request': request}).data

        return Response({
            'seller_id': seller.pk,
            'seller_username': seller.username,
            'reputation': {
                'score': score,
                'total_reviews': total,
                'recent_reviews': recent,
            },
            'active_listings': listings_data,
        })


# ---------------------------------------------------------------------------
# Phase 5C: Sold Price History & Market Analytics
# ---------------------------------------------------------------------------

class CardSoldPriceHistoryView(generics.GenericAPIView):
    """
    GET /cards/<api_id>/sold-price-history/?days=30|90|365

    Returns actual sold prices for a card from completed orders.
    Response: [{date, price, condition}, ...]
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, api_id):
        from django.utils import timezone
        from datetime import timedelta

        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)

        qs = PriceSoldSnapshot.objects.filter(
            card__api_id=api_id,
            sold_at__gte=since,
        ).order_by('sold_at')

        data = PriceSoldSnapshotSerializer(qs, many=True).data
        return Response(data)


class MarketAnalyticsView(generics.GenericAPIView):
    """
    GET /market/analytics/

    Returns market-wide analytics:
      - top_movers: cards with highest sales volume (last 30 days)
      - avg_price_by_condition: average sold price per condition
      - volume_stats: total sales count and revenue by tcg_type
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Avg, Count, Sum

        days = int(request.query_params.get('days', 30))
        since = timezone.now() - timedelta(days=days)
        base_qs = PriceSoldSnapshot.objects.filter(sold_at__gte=since)

        # Top movers: cards with most sales
        top_movers_qs = (
            base_qs
            .values('card__api_id', 'card__card_name', 'card__image_url', 'tcg_type')
            .annotate(
                sales_count=Count('id'),
                avg_price=Avg('sold_price'),
                total_volume=Sum('sold_price'),
            )
            .order_by('-sales_count')[:20]
        )
        top_movers = [
            {
                'card_api_id': row['card__api_id'],
                'card_name': row['card__card_name'],
                'image_url': row['card__image_url'],
                'tcg_type': row['tcg_type'],
                'sales_count': row['sales_count'],
                'avg_price': str(row['avg_price']) if row['avg_price'] else None,
                'total_volume': str(row['total_volume']) if row['total_volume'] else None,
            }
            for row in top_movers_qs
        ]

        # Average price by condition
        avg_by_condition_qs = (
            base_qs
            .values('condition')
            .annotate(avg_price=Avg('sold_price'), count=Count('id'))
            .order_by('condition')
        )
        avg_price_by_condition = {
            row['condition']: {
                'avg_price': str(row['avg_price']) if row['avg_price'] else None,
                'count': row['count'],
            }
            for row in avg_by_condition_qs
        }

        # Volume stats by tcg_type
        volume_by_tcg_qs = (
            base_qs
            .values('tcg_type')
            .annotate(count=Count('id'), total_revenue=Sum('sold_price'))
            .order_by('-count')
        )
        volume_stats = [
            {
                'tcg_type': row['tcg_type'],
                'count': row['count'],
                'total_revenue': str(row['total_revenue']) if row['total_revenue'] else None,
            }
            for row in volume_by_tcg_qs
        ]

        return Response({
            'period_days': days,
            'top_movers': top_movers,
            'avg_price_by_condition': avg_price_by_condition,
            'volume_stats': volume_stats,
        })


# ---------------------------------------------------------------------------
# Phase 5D: Fast Trigram Search  GET /api/search/?q=<term>&page=<n>&limit=<n>
# ---------------------------------------------------------------------------

class TrigamSearchView(generics.GenericAPIView):
    """
    GET /api/search/?q=<query>[&page=1][&limit=20][&tcg_type=pokemon]

    Fast card + listing search endpoint. On PostgreSQL uses pg_trgm similarity
    ranking (requires migration 0009). Falls back to icontains on SQLite.

    Returns the top matching available listings with card info.
    Results are cached for 30 s per unique (q, page, limit, tcg_type) tuple.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from .signals import LISTING_CACHE_PREFIX

        q = (request.query_params.get('q') or '').strip()
        try:
            page = max(1, int(request.query_params.get('page', 1)))
            limit = min(50, max(1, int(request.query_params.get('limit', 20))))
        except (TypeError, ValueError):
            page = 1
            limit = 20
        tcg_type = request.query_params.get('tcg_type', '')

        if not q:
            return Response({'results': [], 'count': 0, 'q': q})

        cache_key = (
            f'{LISTING_CACHE_PREFIX}search:'
            f'q={q}&page={page}&limit={limit}&tcg={tcg_type}'
        )
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        is_pg = connection.vendor == 'postgresql'

        # --- Build queryset ---
        qs = (
            Card_Listing.objects
            .filter(is_available=True)
            .select_related('card_master', 'card_master__set', 'seller')
        )
        if tcg_type:
            qs = qs.filter(card_master__tcg_type=tcg_type)

        if is_pg:
            from django.db.models import FloatField
            from django.db.models.expressions import RawSQL
            # Use pg_trgm similarity on card_name; sort by best match first.
            qs = qs.annotate(
                sim=RawSQL(
                    "similarity(api_card_master.card_name, %s)",
                    (q,),
                    output_field=FloatField(),
                )
            ).filter(sim__gt=0.1).order_by('-sim', '-id')
        else:
            qs = qs.filter(card_master__card_name__icontains=q).order_by('-id')

        total = qs.count()
        offset = (page - 1) * limit
        page_qs = qs[offset: offset + limit]

        results = CardListingSerializer(
            page_qs,
            many=True,
            context={'request': request},
        ).data

        payload = {
            'results': results,
            'count': total,
            'q': q,
            'page': page,
            'limit': limit,
        }
        cache.set(cache_key, payload)
        return Response(payload)
