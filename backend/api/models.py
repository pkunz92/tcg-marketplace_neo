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
    set_code = models.CharField(max_length=20, unique=True)
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
        return self.set_name

    class Meta:
        verbose_name_plural = "Set Masters"


class Card_Master(models.Model):
    set = models.ForeignKey(
        Set_Master,
        on_delete=models.PROTECT,
        related_name='cards',
        null=True,
    )
    api_id = models.CharField(max_length=50, unique=True, primary_key=True)
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

    def __str__(self):
        return f"{self.card_master.card_name} - {self.get_condition_display()} by {self.seller.username}"


class OrderStatusChoices(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


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
