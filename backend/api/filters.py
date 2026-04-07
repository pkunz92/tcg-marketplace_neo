"""
Filter classes for API views.
"""
import django_filters
from django.db.models import IntegerField
from django.db.models.functions import Cast
from .models import Card_Listing, Card_Master


class CardMasterFilter(django_filters.FilterSet):
    """Filter for Card_Master list views."""

    supertype = django_filters.CharFilter(field_name='supertype', lookup_expr='iexact')
    rarity = django_filters.CharFilter(field_name='card_rarity', lookup_expr='iexact')
    types = django_filters.CharFilter(method='filter_types')
    artist = django_filters.CharFilter(field_name='artist', lookup_expr='icontains')
    set_code = django_filters.CharFilter(field_name='set__set_code', lookup_expr='exact')
    set_name = django_filters.CharFilter(field_name='set__set_name', lookup_expr='icontains')
    series = django_filters.CharFilter(field_name='set__series', lookup_expr='icontains')
    language = django_filters.CharFilter(field_name='language', lookup_expr='iexact')
    tcg_type = django_filters.CharFilter(field_name='tcg_type', lookup_expr='iexact')
    hp_min = django_filters.NumberFilter(method='filter_hp_min')
    hp_max = django_filters.NumberFilter(method='filter_hp_max')
    has_price = django_filters.BooleanFilter(method='filter_has_price')

    class Meta:
        model = Card_Master
        fields = ['supertype', 'rarity', 'set_code', 'artist', 'tcg_type']

    def filter_types(self, queryset, name, value):
        """Filter cards that contain a specific type in their types JSON array."""
        return queryset.filter(types__contains=[value])

    def filter_hp_min(self, queryset, name, value):
        """Filter by minimum HP (HP is stored as CharField, cast for comparison)."""
        return (
            queryset.exclude(hp='').exclude(hp__isnull=True)
            .annotate(_hp_int=Cast('hp', IntegerField()))
            .filter(_hp_int__gte=value)
        )

    def filter_hp_max(self, queryset, name, value):
        """Filter by maximum HP."""
        return (
            queryset.exclude(hp='').exclude(hp__isnull=True)
            .annotate(_hp_int=Cast('hp', IntegerField()))
            .filter(_hp_int__lte=value)
        )

    def filter_has_price(self, queryset, name, value):
        """Filter cards that have/don't have price data."""
        if value:
            return queryset.filter(prices__isnull=False).distinct()
        return queryset.filter(prices__isnull=True)


class CardListingFilter(django_filters.FilterSet):
    """Filter for Card_Listing views."""

    card_master = django_filters.ModelChoiceFilter(
        queryset=Card_Master.objects.all(),
        field_name='card_master',
    )
    card_name = django_filters.CharFilter(
        field_name='card_master__card_name',
        lookup_expr='icontains',
    )
    seller = django_filters.NumberFilter(field_name='seller__id')
    seller_username = django_filters.CharFilter(
        field_name='seller__username',
        lookup_expr='icontains',
    )
    is_available = django_filters.BooleanFilter(field_name='is_available')
    condition = django_filters.ChoiceFilter(
        choices=Card_Listing._meta.get_field('condition').choices,
    )
    is_graded = django_filters.ChoiceFilter(
        choices=Card_Listing._meta.get_field('is_graded').choices,
    )
    min_price = django_filters.NumberFilter(field_name='price_chf', lookup_expr='gte')
    max_price = django_filters.NumberFilter(field_name='price_chf', lookup_expr='lte')
    set_code = django_filters.CharFilter(
        field_name='card_master__set__set_code',
        lookup_expr='exact',
    )
    set_name = django_filters.CharFilter(
        field_name='card_master__set__set_name',
        lookup_expr='icontains',
    )
    supertype = django_filters.CharFilter(
        field_name='card_master__supertype',
        lookup_expr='iexact',
    )
    rarity = django_filters.CharFilter(
        field_name='card_master__card_rarity',
        lookup_expr='iexact',
    )
    tcg_type = django_filters.CharFilter(
        field_name='card_master__tcg_type',
        lookup_expr='iexact',
    )

    class Meta:
        model = Card_Listing
        fields = [
            'card_master', 'seller', 'is_available', 'condition',
            'is_graded', 'min_price', 'max_price', 'tcg_type',
        ]
