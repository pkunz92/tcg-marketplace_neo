from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Order, OrderStatusChoices, PriceSoldSnapshot, UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)


@receiver(post_save, sender=Order)
def create_price_sold_snapshot(sender, instance, created, **kwargs):
    """When an order reaches DELIVERED status, record a sold price snapshot."""
    if instance.status != OrderStatusChoices.DELIVERED:
        return
    if PriceSoldSnapshot.objects.filter(listing=instance.listing, sold_price=instance.price_chf).exists():
        # Avoid duplicate snapshots if signal fires multiple times for same order
        if PriceSoldSnapshot.objects.filter(listing=instance.listing).exists():
            return
    listing = instance.listing
    card = listing.card_master
    PriceSoldSnapshot.objects.get_or_create(
        listing=listing,
        defaults={
            'card': card,
            'sold_price': instance.price_chf,
            'condition': listing.condition,
            'tcg_type': card.tcg_type,
        },
    )
