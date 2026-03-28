from django.contrib import admin
from .models import (
    Card_Master, Card_Listing, Order, Set_Master,
    CardTranslation, SetTranslation, CardPrice,
)


# --- Inlines ---
class CardTranslationInline(admin.TabularInline):
    model = CardTranslation
    extra = 0
    readonly_fields = ('language', 'name', 'image_url')


class CardPriceInline(admin.TabularInline):
    model = CardPrice
    extra = 0
    readonly_fields = ('source', 'variant', 'currency', 'low', 'mid', 'high', 'market', 'direct_low', 'updated_at')


class SetTranslationInline(admin.TabularInline):
    model = SetTranslation
    extra = 0
    readonly_fields = ('language', 'name')


# --- Set Master Admin ---
@admin.register(Set_Master)
class SetMasterAdmin(admin.ModelAdmin):
    list_display = ('set_code', 'set_name', 'series', 'ptcgo_code', 'total_cards', 'release_date')
    search_fields = ('set_name', 'set_code', 'ptcgo_code', 'series')
    list_filter = ('series',)
    ordering = ('set_code',)
    inlines = [SetTranslationInline]


# --- Card Master Admin ---
@admin.register(Card_Master)
class CardMasterAdmin(admin.ModelAdmin):
    list_display = (
        'card_name',
        'secondary_id',
        'get_set_code',
        'card_number',
        'card_rarity',
        'supertype',
        'hp',
        'artist',
    )
    search_fields = (
        'card_name',
        'secondary_id',
        'card_number',
        'set__set_code',
        'set__ptcgo_code',
        'artist',
    )
    list_filter = ('supertype', 'card_rarity', 'set__series')
    raw_id_fields = ('set',)
    inlines = [CardTranslationInline, CardPriceInline]

    @admin.display(description='Set Code')
    def get_set_code(self, obj):
        return obj.set.set_code if obj.set else 'N/A'

    ordering = ('set__set_name', 'card_number')


# --- Card Listing Admin ---
@admin.register(Card_Listing)
class CardListingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'card_master', 'seller', 'price_chf',
        'quantity', 'condition', 'is_graded', 'is_available',
    )
    list_filter = ('condition', 'is_graded', 'is_available')
    search_fields = (
        'card_master__card_name',
        'card_master__secondary_id',
        'seller__username',
    )
    raw_id_fields = ('card_master', 'seller')
    ordering = ('-id',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'listing', 'buyer', 'quantity',
        'price_chf', 'status', 'created_at',
    )
    list_filter = ('status',)
    search_fields = (
        'listing__card_master__card_name',
        'buyer__username',
        'listing__seller__username',
    )
    raw_id_fields = ('listing', 'buyer')
    ordering = ('-created_at',)


# --- New Model Admins ---
@admin.register(CardTranslation)
class CardTranslationAdmin(admin.ModelAdmin):
    list_display = ('card_master', 'language', 'name')
    list_filter = ('language',)
    search_fields = ('name', 'card_master__card_name')
    raw_id_fields = ('card_master',)


@admin.register(SetTranslation)
class SetTranslationAdmin(admin.ModelAdmin):
    list_display = ('set_master', 'language', 'name')
    list_filter = ('language',)
    search_fields = ('name', 'set_master__set_name')


@admin.register(CardPrice)
class CardPriceAdmin(admin.ModelAdmin):
    list_display = ('card_master', 'source', 'variant', 'currency', 'market', 'low', 'high', 'updated_at')
    list_filter = ('source', 'currency')
    search_fields = ('card_master__card_name',)
    raw_id_fields = ('card_master',)
    ordering = ('-updated_at',)
