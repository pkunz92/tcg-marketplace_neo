from django.db import transaction
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers
from .models import (
    Card_Master, Card_Listing, Order, OrderStatusChoices,
    Set_Master, UserProfile, CardTranslation, SetTranslation, CardPrice, CardPriceHistory,
    Offer, OfferStatusChoices, Transaction, TransactionStatusChoices, CardGrade, ListingPhoto,
    Review, PriceSoldSnapshot, Dispute, DisputeStatusChoices, UserFlag,
)


# --- Set Master Serializer ---
class SetMasterSerializer(serializers.ModelSerializer):
    translations = serializers.SerializerMethodField()
    english_name = serializers.CharField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = Set_Master
        fields = [
            'id', 'set_code', 'language', 'tcg_type', 'set_name', 'english_name', 'ptcgo_code', 'series',
            'total_cards', 'printed_total', 'release_date',
            'symbol_url', 'logo_url', 'legalities', 'translations',
        ]

    def get_translations(self, obj):
        lang = self.context.get('request', {})
        if hasattr(lang, 'query_params'):
            lang = lang.query_params.get('lang')
        else:
            lang = None

        if lang:
            translations = obj.translations.filter(language=lang)
        else:
            translations = obj.translations.all()

        return SetTranslationSerializer(translations, many=True).data


class SetTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SetTranslation
        fields = ['language', 'name']


# --- Card Price Serializer ---
class CardPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardPrice
        fields = [
            'source', 'variant', 'currency',
            'low', 'mid', 'high', 'market', 'direct_low', 'updated_at',
        ]


class CardPriceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CardPriceHistory
        fields = ['source', 'variant', 'currency', 'low', 'mid', 'high', 'market', 'fetched_at']


# --- Card Translation Serializer ---
class CardTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardTranslation
        fields = ['language', 'name', 'image_url']


# --- Card Master Serializer ---
class CardMasterSerializer(serializers.ModelSerializer):
    set = SetMasterSerializer(read_only=True, allow_null=True)
    translations = serializers.SerializerMethodField()
    prices = serializers.SerializerMethodField()

    class Meta:
        model = Card_Master
        fields = '__all__'

    def get_translations(self, obj):
        request = self.context.get('request')
        lang = None
        if request and hasattr(request, 'query_params'):
            lang = request.query_params.get('lang')

        if lang:
            translations = obj.translations.filter(language=lang)
        else:
            translations = obj.translations.all()

        return CardTranslationSerializer(translations, many=True).data

    def get_prices(self, obj):
        include_prices = True
        request = self.context.get('request')
        if request and hasattr(request, 'query_params'):
            include_prices = request.query_params.get('include_prices', 'false').lower() == 'true'

        if not include_prices:
            return []

        return CardPriceSerializer(obj.prices.all(), many=True).data


# --- Card Master List Serializer (lightweight, no nested prices/translations) ---
class CardMasterListSerializer(serializers.ModelSerializer):
    set = SetMasterSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Card_Master
        fields = [
            'api_id', 'language', 'tcg_type', 'card_name', 'card_number', 'secondary_id',
            'card_rarity', 'image_url', 'supertype', 'hp', 'types',
            'artist', 'set',
        ]


# --- Card Listing Serializer ---
class CardListingSerializer(serializers.ModelSerializer):
    card_name = serializers.CharField(source='card_master.card_name', read_only=True)
    card_number = serializers.CharField(source='card_master.card_number', read_only=True)
    secondary_id = serializers.CharField(source='card_master.secondary_id', read_only=True)
    card_rarity = serializers.CharField(source='card_master.card_rarity', read_only=True)
    card_image_url = serializers.URLField(source='card_master.image_url', read_only=True)
    tcg_type = serializers.CharField(source='card_master.tcg_type', read_only=True)
    set_name = serializers.CharField(source='card_master.set.set_name', read_only=True, allow_null=True)
    set_code = serializers.CharField(source='card_master.set.set_code', read_only=True, allow_null=True)
    ptcgo_code = serializers.CharField(source='card_master.set.ptcgo_code', read_only=True, allow_null=True)
    seller_username = serializers.CharField(source='seller.username', read_only=True)
    seller_photo_url = serializers.SerializerMethodField()
    seller_reputation_score = serializers.SerializerMethodField()
    seller_reputation_count = serializers.SerializerMethodField()
    requires_photo = serializers.BooleanField(read_only=True)
    grading_status = serializers.CharField(read_only=True)
    auto_grade = serializers.JSONField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Card_Listing
        fields = [
            'id', 'card_master', 'card_name', 'card_number', 'secondary_id',
            'card_rarity', 'card_image_url', 'tcg_type', 'set_name', 'set_code', 'ptcgo_code',
            'seller', 'seller_username', 'price_chf', 'quantity', 'condition',
            'is_graded', 'seller_photo', 'seller_photo_url', 'is_available',
            'requires_photo', 'grading_status', 'auto_grade', 'created_at',
            'seller_reputation_score', 'seller_reputation_count',
        ]
        read_only_fields = ['seller']

    def validate_card_master(self, value):
        if not value:
            raise serializers.ValidationError("Card master is required.")
        return value

    def get_seller_photo_url(self, obj):
        if obj.seller_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.seller_photo.url)
            return obj.seller_photo.url
        return None

    def get_seller_reputation_score(self, obj):
        from .reputation import compute_reputation
        score, _, _ = compute_reputation(obj.seller)
        return score

    def get_seller_reputation_count(self, obj):
        return Review.objects.filter(seller=obj.seller).count()


class OrderSerializer(serializers.ModelSerializer):
    listing_id = serializers.IntegerField(source='listing.id', read_only=True)
    card_name = serializers.CharField(source='listing.card_master.card_name', read_only=True)
    card_image_url = serializers.URLField(source='listing.card_master.image_url', read_only=True)
    seller_username = serializers.CharField(source='listing.seller.username', read_only=True)
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'listing', 'listing_id', 'card_name', 'card_image_url',
            'seller_username', 'buyer_username', 'buyer', 'quantity', 'price_chf',
            'shipping_name', 'shipping_address_line1', 'shipping_address_line2',
            'shipping_city', 'shipping_postal_code', 'shipping_country',
            'status', 'created_at',
        ]
        read_only_fields = ['buyer', 'price_chf', 'created_at']

    def validate(self, attrs):
        # Skip creation-only checks on partial updates (PATCH) — only status is writable.
        if self.partial:
            return attrs

        listing = attrs.get('listing')
        quantity = attrs.get('quantity', 1)
        required_fields = [
            'shipping_name', 'shipping_address_line1',
            'shipping_city', 'shipping_postal_code', 'shipping_country',
        ]

        if not listing:
            raise serializers.ValidationError({'listing': 'Listing is required.'})
        if not listing.is_available:
            raise serializers.ValidationError({'listing': 'Listing is not available.'})
        if quantity < 1:
            raise serializers.ValidationError({'quantity': 'Quantity must be at least 1.'})
        if quantity > listing.quantity:
            raise serializers.ValidationError({'quantity': 'Quantity exceeds available stock.'})
        for field in required_fields:
            if not attrs.get(field):
                raise serializers.ValidationError({field: 'This field is required.'})

        return attrs

    def validate_status(self, value):
        request = self.context.get('request')
        if request and request.method in ['PUT', 'PATCH']:
            if value not in [OrderStatusChoices.COMPLETED, OrderStatusChoices.CANCELLED]:
                raise serializers.ValidationError('Invalid status transition.')
        return value

    def create(self, validated_data):
        buyer = validated_data.get('buyer')
        quantity = validated_data.get('quantity', 1)

        with transaction.atomic():
            listing = (
                Card_Listing.objects
                .select_for_update()
                .get(pk=validated_data['listing'].pk)
            )

            if not listing.is_available:
                raise serializers.ValidationError({'listing': 'Listing is not available.'})
            if quantity > listing.quantity:
                raise serializers.ValidationError({'quantity': 'Quantity exceeds available stock.'})

            listing.quantity -= quantity
            if listing.quantity <= 0:
                listing.quantity = 0
                listing.is_available = False
            listing.save(update_fields=['quantity', 'is_available'])

            order = Order.objects.create(
                listing=listing,
                buyer=buyer,
                quantity=quantity,
                price_chf=listing.price_chf,
                shipping_name=validated_data['shipping_name'],
                shipping_address_line1=validated_data['shipping_address_line1'],
                shipping_address_line2=validated_data.get('shipping_address_line2'),
                shipping_city=validated_data['shipping_city'],
                shipping_postal_code=validated_data['shipping_postal_code'],
                shipping_country=validated_data['shipping_country'],
                status=OrderStatusChoices.PENDING,
            )

        return order


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            'shipping_name', 'shipping_address_line1', 'shipping_address_line2',
            'shipping_city', 'shipping_postal_code', 'shipping_country',
        ]


# ---------------------------------------------------------------------------
# Phase 2 serializers
# ---------------------------------------------------------------------------

class CardGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardGrade
        fields = ['id', 'listing', 'company', 'grade', 'cert_number', 'graded_at', 'notes']
        read_only_fields = ['id']

    def validate_grade(self, value):
        if value < 1 or value > 10:
            raise serializers.ValidationError("Grade must be between 1.0 and 10.0.")
        return value


class OfferSerializer(serializers.ModelSerializer):
    buyer_username = serializers.CharField(source='buyer.username', read_only=True)
    listing_card_name = serializers.CharField(
        source='listing.card_master.card_name', read_only=True
    )
    expires_at = serializers.DateTimeField(required=False, read_only=False)

    class Meta:
        model = Offer
        fields = [
            'id', 'listing', 'listing_card_name', 'buyer', 'buyer_username',
            'offer_price_chf', 'counter_price_chf', 'message',
            'status', 'expires_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'buyer', 'created_at', 'updated_at']

    def validate(self, attrs):
        listing = attrs.get('listing')
        if listing and not listing.is_available:
            raise serializers.ValidationError({'listing': 'Listing is not available.'})
        offer_price = attrs.get('offer_price_chf')
        if offer_price is not None and offer_price <= 0:
            raise serializers.ValidationError({'offer_price_chf': 'Offer price must be positive.'})
        return attrs

    def validate_status(self, value):
        request = self.context.get('request')
        if request and request.method in ['PUT', 'PATCH']:
            allowed = [
                OfferStatusChoices.ACCEPTED,
                OfferStatusChoices.DECLINED,
                OfferStatusChoices.COUNTERED,
            ]
            if value not in allowed:
                raise serializers.ValidationError(
                    f"Status must be one of: {', '.join(allowed)}"
                )
        return value


class TransactionSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'order', 'order_id', 'stripe_payment_intent_id', 'stripe_charge_id',
            'amount_chf', 'status', 'stripe_metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'stripe_payment_intent_id', 'stripe_charge_id',
            'stripe_metadata', 'created_at', 'updated_at',
        ]


class CustomRegisterSerializer(RegisterSerializer):
    shipping_name = serializers.CharField(required=True, max_length=100)
    shipping_address_line1 = serializers.CharField(required=True, max_length=200)
    shipping_address_line2 = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=200)
    shipping_city = serializers.CharField(required=True, max_length=100)
    shipping_postal_code = serializers.CharField(required=True, max_length=20)
    shipping_country = serializers.CharField(required=True, max_length=100)

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['shipping_name'] = self.validated_data.get('shipping_name', '')
        data['shipping_address_line1'] = self.validated_data.get('shipping_address_line1', '')
        data['shipping_address_line2'] = self.validated_data.get('shipping_address_line2', '')
        data['shipping_city'] = self.validated_data.get('shipping_city', '')
        data['shipping_postal_code'] = self.validated_data.get('shipping_postal_code', '')
        data['shipping_country'] = self.validated_data.get('shipping_country', '')
        return data

    def save(self, request):
        user = super().save(request)
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.shipping_name = self.cleaned_data.get('shipping_name', '')
        profile.shipping_address_line1 = self.cleaned_data.get('shipping_address_line1', '')
        profile.shipping_address_line2 = self.cleaned_data.get('shipping_address_line2', '')
        profile.shipping_city = self.cleaned_data.get('shipping_city', '')
        profile.shipping_postal_code = self.cleaned_data.get('shipping_postal_code', '')
        profile.shipping_country = self.cleaned_data.get('shipping_country', '')
        profile.save()
        return user


class ListingPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingPhoto
        fields = ['id', 'listing', 's3_key', 's3_bucket', 'mime_type', 'size_bytes', 'created_at']
        read_only_fields = ['id', 'created_at']


# ---------------------------------------------------------------------------
# Phase 5A serializers — Review, Reputation
# ---------------------------------------------------------------------------

class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    card_name = serializers.CharField(source='order.listing.card_master.card_name', read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'order', 'reviewer', 'reviewer_username', 'seller', 'stars', 'comment', 'card_name', 'created_at']
        read_only_fields = ['id', 'order', 'reviewer', 'seller', 'created_at']

    def validate_stars(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Stars must be between 1 and 5.")
        return value


class ReputationSerializer(serializers.Serializer):
    seller_id = serializers.IntegerField()
    seller_username = serializers.CharField()
    score = serializers.FloatField(allow_null=True)
    total_reviews = serializers.IntegerField()
    recent_reviews = serializers.IntegerField(help_text="Reviews in last 90 days")


class PriceSoldSnapshotSerializer(serializers.ModelSerializer):
    date = serializers.DateTimeField(source='sold_at')
    price = serializers.DecimalField(source='sold_price', max_digits=10, decimal_places=2)

    class Meta:
        model = PriceSoldSnapshot
        fields = ['date', 'price', 'condition']


class DisputeSerializer(serializers.ModelSerializer):
    opened_by_username = serializers.CharField(source='opened_by.username', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)

    class Meta:
        model = Dispute
        fields = [
            'id', 'order', 'order_id', 'opened_by', 'opened_by_username',
            'reason', 'description', 'status', 'resolution',
            'created_at', 'resolved_at',
        ]
        read_only_fields = ['id', 'order', 'order_id', 'opened_by', 'status', 'resolution', 'created_at', 'resolved_at']


class DisputeResolveSerializer(serializers.Serializer):
    resolution = serializers.CharField(required=True)
    refund = serializers.BooleanField(default=False)
    close = serializers.BooleanField(default=False, help_text="Close without resolving if True")
