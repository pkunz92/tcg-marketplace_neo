from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.reverse import reverse
from rest_framework import viewsets, permissions, generics, filters
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import Card_Master, Card_Listing, Order, Set_Master, CardPrice
from .serializers import (
    CardMasterSerializer, CardMasterListSerializer, CardListingSerializer,
    OrderSerializer, SetMasterSerializer, UserProfileSerializer,
    CardPriceSerializer,
)
from .permissions import IsSellerOrReadOnly
from .filters import CardListingFilter, CardMasterFilter


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
    Supports ?lang= for filtering by translation availability.
    """
    serializer_class = CardMasterListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [SearchFilter, DjangoFilterBackend, OrderingFilter]
    search_fields = ['card_name', 'secondary_id']
    filterset_class = CardMasterFilter
    ordering_fields = ['card_name', 'card_number', 'card_rarity', 'hp']
    ordering = ['set__set_name', 'card_number']

    def get_queryset(self):
        queryset = Card_Master.objects.select_related('set').all()

        # Filter by language availability
        lang = self.request.query_params.get('lang')
        if lang and lang != 'en':
            queryset = queryset.filter(translations__language=lang)

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
                'price_stats': {
                    'min': float(price_stats['min_price']) if price_stats['min_price'] else None,
                    'max': float(price_stats['max_price']) if price_stats['max_price'] else None,
                    'avg': float(price_stats['avg_price']) if price_stats['avg_price'] else None,
                    'total_listings': price_stats['total_listings'],
                },
            },
        })


class SetListAPIView(generics.ListAPIView):
    serializer_class = SetMasterSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['set_name', 'set_code', 'series']
    ordering_fields = ['set_name', 'release_date', 'set_code']
    ordering = ['set_name']

    def get_queryset(self):
        queryset = Set_Master.objects.prefetch_related('translations').all()

        series = self.request.query_params.get('series')
        if series:
            queryset = queryset.filter(series__icontains=series)

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
        serializer.save(buyer=self.request.user)

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


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user.profile
