from django.db import models
from django.conf import settings
from django.db.models.fields import DateField


# --- CHOICES ---
class ConditionChoices(models.TextChoices):
    MT = 'MT', 'Mint'
    NM = 'NM', 'Near Mint'
    LP = 'LP', 'Lightly Played'
    MP = 'MP', 'Moderately Played'
    HP = 'HP', 'Heavily Played'
    DMG = 'DMG', 'Damaged'


class GradingChoices(models.TextChoices):
    RAW = 'RAW', 'Raw (Ungraded)'
    PSA = 'PSA', 'PSA Graded'
    BGS = 'BGS', 'BGS Graded'
    CGC = 'CGC', 'CGC Graded'
    TAG = 'TAG', 'TAG Graded'
    ACE = 'ACE', 'ACE Graded'


class Set_Master(models.Model):
    set_code = models.CharField(max_length=20)
    language = models.CharField(max_length=10, default='en', db_index=True)
    set_name = models.CharField(max_length=100)
    total_cards = models.IntegerField(default=0)
    printed_total = models.IntegerField(default=0)
    ptcgo_code = models.CharField(max_length=10, blank=True, null=True)
    series = models.CharField(max_length=100, blank=True, null=True)
    release_date = models.DateField(blank=True, null=True)
    symbol_url = models.URLField(max_length=500, blank=True, default='')
    logo_url = models.URLField(max_length=500, blank=True, default='')
    legalities = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.set_name} ({self.language})"

    class Meta:
        verbose_name_plural = "Set Masters"
        unique_together = ('set_code', 'language')


class Card_Master(models.Model):
    set = models.ForeignKey(
        Set_Master,
        on_delete=models.PROTECT,
        related_name='cards',
        null=True,
    )
    api_id = models.CharField(max_length=60, unique=True, primary_key=True)
    language = models.CharField(max_length=10, default='en', db_index=True)
    card_name = models.CharField(max_length=255)
    card_number = models.CharField(max_length=10)
    secondary_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    card_rarity = models.CharField(max_length=50)
    image_url = models.URLField(max_length=500)

    # --- Card detail fields (enriched from pokemontcg.io) ---
    supertype = models.CharField(max_length=50, blank=True, default='')
    subtypes = models.JSONField(default=list, blank=True)
    hp = models.CharField(max_length=10, blank=True, default='')
    types = models.JSONField(default=list, blank=True)
    evolves_from = models.CharField(max_length=200, blank=True, default='')
    evolves_to = models.JSONField(default=list, blank=True)
    attacks = models.JSONField(default=list, blank=True)
    abilities = models.JSONField(default=list, blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    resistances = models.JSONField(default=list, blank=True)
    retreat_cost = models.IntegerField(null=True, blank=True)
    artist = models.CharField(max_length=200, blank=True, default='')
    flavor_text = models.TextField(blank=True, default='')
    national_pokedex_numbers = models.JSONField(default=list, blank=True)
    legalities = models.JSONField(default=dict, blank=True)
    regulation_mark = models.CharField(max_length=10, blank=True, default='')
    rules = models.JSONField(default=list, blank=True)

    def __str__(self):
        set_code = self.set.set_code if self.set else '???'
        return f"{self.card_name} ({set_code} #{self.card_number})"

    class Meta:
        verbose_name_plural = "Card Master Database"
        ordering = ['set__set_name', 'card_name', 'card_number']
        indexes = [
            models.Index(fields=['card_name']),
            models.Index(fields=['supertype']),
            models.Index(fields=['card_rarity']),
            models.Index(fields=['artist']),
        ]


class CardTranslation(models.Model):
    card_master = models.ForeignKey(
        Card_Master,
        on_delete=models.CASCADE,
        related_name='translations',
    )
    language = models.CharField(max_length=10)
    name = models.CharField(max_length=300)
    image_url = models.URLField(max_length=500, blank=True, default='')

    def __str__(self):
        return f"{self.name} ({self.language})"

    class Meta:
        unique_together = ('card_master', 'language')
        verbose_name_plural = "Card Translations"


class SetTranslation(models.Model):
    set_master = models.ForeignKey(
        Set_Master,
        on_delete=models.CASCADE,
        related_name='translations',
    )
    language = models.CharField(max_length=10)
    name = models.CharField(max_length=200)

    def __str__(self):
        return f"{self.name} ({self.language})"

    class Meta:
        unique_together = ('set_master', 'language')
        verbose_name_plural = "Set Translations"


class CardPrice(models.Model):
    card_master = models.ForeignKey(
        Card_Master,
        on_delete=models.CASCADE,
        related_name='prices',
    )
    source = models.CharField(max_length=50)
    variant = models.CharField(max_length=50)
    currency = models.CharField(max_length=3)
    low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    mid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    high = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    market = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    direct_low = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.card_master.card_name} - {self.source} {self.variant} ({self.currency})"

    class Meta:
        unique_together = ('card_master', 'source', 'variant')
        verbose_name_plural = "Card Prices"


class CardPriceHistory(models.Model):
    """Timestamped price snapshots — one row written every time prices are fetched."""
    card_master = models.ForeignKey(
        Card_Master,
        on_delete=models.CASCADE,
        related_name='price_history',
    )
    source = models.CharField(max_length=50)
    variant = models.CharField(max_length=50)
    currency = models.CharField(max_length=3)
    low    = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    mid    = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    high   = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    market = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['card_master', 'source', 'variant', 'fetched_at']),
        ]
        ordering = ['fetched_at']
        verbose_name_plural = "Card Price History"

    def __str__(self):
        return f"{self.card_master_id} {self.source}/{self.variant} @ {self.fetched_at:%Y-%m-%d}"


class Card_Listing(models.Model):
    card_master = models.ForeignKey(
        Card_Master,
        on_delete=models.CASCADE,
        related_name='listings',
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sold_listings',
    )
    price_chf = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.IntegerField(default=1)
    condition = models.CharField(
        max_length=4,
        choices=ConditionChoices.choices,
    )
    is_graded = models.CharField(
        max_length=4,
        choices=GradingChoices.choices,
        default=GradingChoices.RAW,
    )
    seller_photo = models.ImageField(
        upload_to='listing_photos/%Y/%m/',
        blank=True,
        null=True,
        help_text="Seller-provided high-resolution photo of the actual card.",
    )
    is_available = models.BooleanField(default=True)

    # --- Phase 3: auto-grading result ---
    grading_status = models.CharField(
        max_length=12,
        choices=[
            ('none', 'None'),
            ('queued', 'Queued'),
            ('processing', 'Processing'),
            ('complete', 'Complete'),
            ('failed', 'Failed'),
        ],
        default='none',
    )
    auto_grade = models.JSONField(
        null=True,
        blank=True,
        help_text="ML grading result: {grade, confidence, detectedCard}",
    )

    # Rarities that require a photo before publishing
    PHOTO_REQUIRED_RARITIES = {'Rare Holo', 'Ultra Rare', 'Secret Rare'}
    PHOTO_REQUIRED_VALUE_THRESHOLD = 20  # CHF

    @property
    def requires_photo(self):
        rarity = getattr(self.card_master, 'card_rarity', '') or ''
        return (
            rarity in self.PHOTO_REQUIRED_RARITIES
            or float(self.price_chf or 0) >= self.PHOTO_REQUIRED_VALUE_THRESHOLD
        )

    def __str__(self):
        return f"{self.card_master.card_name} - {self.get_condition_display()} by {self.seller.username}"


class ListingPhoto(models.Model):
    """S3-backed photo attached to a listing (Phase 3)."""
    listing = models.ForeignKey(
        Card_Listing,
        on_delete=models.CASCADE,
        related_name='photos',
    )
    s3_key = models.CharField(max_length=500)
    s3_bucket = models.CharField(max_length=200, default='')
    mime_type = models.CharField(max_length=80, default='image/jpeg')
    size_bytes = models.PositiveIntegerField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Photo {self.id} for listing {self.listing_id}"


class OrderStatusChoices(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    DELIVERED = 'DELIVERED', 'Delivered'


class Order(models.Model):
    listing = models.ForeignKey(
        Card_Listing,
        on_delete=models.PROTECT,
        related_name='orders',
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orders',
    )
    quantity = models.PositiveIntegerField(default=1)
    price_chf = models.DecimalField(max_digits=8, decimal_places=2)
    shipping_name = models.CharField(max_length=100, default='')
    shipping_address_line1 = models.CharField(max_length=200, default='')
    shipping_address_line2 = models.CharField(max_length=200, blank=True, null=True)
    shipping_city = models.CharField(max_length=100, default='')
    shipping_postal_code = models.CharField(max_length=20, default='')
    shipping_country = models.CharField(max_length=100, default='')
    status = models.CharField(
        max_length=10,
        choices=OrderStatusChoices.choices,
        default=OrderStatusChoices.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.id} - {self.listing.card_master.card_name} x{self.quantity}"


# ---------------------------------------------------------------------------
# Phase 2 models — Offer, Transaction, CardGrade
# ---------------------------------------------------------------------------

class OfferStatusChoices(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    ACCEPTED = 'ACCEPTED', 'Accepted'
    DECLINED = 'DECLINED', 'Declined'
    EXPIRED = 'EXPIRED', 'Expired'
    COUNTERED = 'COUNTERED', 'Countered'


class Offer(models.Model):
    """A buyer makes a price offer on an available Card_Listing."""
    listing = models.ForeignKey(
        Card_Listing,
        on_delete=models.CASCADE,
        related_name='offers',
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='offers',
    )
    offer_price_chf = models.DecimalField(max_digits=8, decimal_places=2)
    counter_price_chf = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Seller's counter-offer price, set when status=COUNTERED.",
    )
    message = models.TextField(blank=True, default='')
    status = models.CharField(
        max_length=10,
        choices=OfferStatusChoices.choices,
        default=OfferStatusChoices.PENDING,
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Offer #{self.id} CHF {self.offer_price_chf} on listing {self.listing_id}"

    class Meta:
        indexes = [
            models.Index(fields=['listing', 'status']),
            models.Index(fields=['buyer', 'status']),
        ]
        ordering = ['-created_at']


class TransactionStatusChoices(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    SUCCEEDED = 'SUCCEEDED', 'Succeeded'
    FAILED = 'FAILED', 'Failed'
    REFUNDED = 'REFUNDED', 'Refunded'


class Transaction(models.Model):
    """Stripe payment record linked 1:1 to an Order."""
    order = models.OneToOneField(
        Order,
        on_delete=models.PROTECT,
        related_name='transaction',
    )
    stripe_payment_intent_id = models.CharField(max_length=100, unique=True)
    stripe_charge_id = models.CharField(max_length=100, blank=True, default='')
    amount_chf = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(
        max_length=10,
        choices=TransactionStatusChoices.choices,
        default=TransactionStatusChoices.PENDING,
    )
    stripe_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Transaction {self.stripe_payment_intent_id} ({self.status})"

    class Meta:
        indexes = [
            models.Index(fields=['status']),
        ]
        ordering = ['-created_at']


class CardGrade(models.Model):
    """Professional grading certificate details for a graded listing."""
    listing = models.OneToOneField(
        Card_Listing,
        on_delete=models.CASCADE,
        related_name='grade_detail',
    )
    company = models.CharField(
        max_length=4,
        choices=GradingChoices.choices,
        help_text="Grading company (PSA, BGS, CGC, etc.)",
    )
    grade = models.DecimalField(
        max_digits=4, decimal_places=1,
        help_text="Numeric grade, e.g. 9.5 or 10.0",
    )
    cert_number = models.CharField(
        max_length=50, unique=True,
        help_text="Grading certificate/population report ID.",
    )
    graded_at = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.company} {self.grade} — cert {self.cert_number}"

    class Meta:
        verbose_name = "Card Grade"
        verbose_name_plural = "Card Grades"


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    shipping_name = models.CharField(max_length=100, default='')
    shipping_address_line1 = models.CharField(max_length=200, default='')
    shipping_address_line2 = models.CharField(max_length=200, blank=True, null=True)
    shipping_city = models.CharField(max_length=100, default='')
    shipping_postal_code = models.CharField(max_length=20, default='')
    shipping_country = models.CharField(max_length=100, default='')

    def __str__(self):
        return f"{self.user.username} Profile"


# ---------------------------------------------------------------------------
# Phase 5A models — Review, Reputation
# ---------------------------------------------------------------------------

class Review(models.Model):
    """Post-purchase review left by a buyer for a seller, tied to one order."""
    order = models.OneToOneField(
        Order,
        on_delete=models.PROTECT,
        related_name='review',
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_given',
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_received',
    )
    stars = models.PositiveSmallIntegerField(
        help_text="Rating 1-5",
    )
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review #{self.id} ({self.stars}★) for {self.seller.username} by {self.reviewer.username}"

    class Meta:
        indexes = [
            models.Index(fields=['seller', 'created_at']),
        ]
        ordering = ['-created_at']
