"""
Transactional email helpers for the TCG Marketplace.

All mail is sent via Django's email backend (console in dev, SMTP/SendGrid in prod).
Configure EMAIL_BACKEND, EMAIL_HOST, EMAIL_HOST_USER, DEFAULT_FROM_EMAIL in settings/env.
"""

import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

DEFAULT_FROM = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@tcgmarketplace.local')


def _send(subject, body, recipients):
    """Fire-and-forget wrapper; logs errors rather than raising."""
    if not recipients:
        return
    try:
        send_mail(subject, body, DEFAULT_FROM, recipients, fail_silently=False)
    except Exception:
        logger.exception("Failed to send email '%s' to %s", subject, recipients)


# ---------------------------------------------------------------------------
# Order emails
# ---------------------------------------------------------------------------

def send_order_confirmation(order):
    """Notify both buyer and seller when an order is created."""
    card_name = order.listing.card_master.card_name
    price = order.price_chf
    qty = order.quantity

    buyer_email = order.buyer.email
    seller_email = order.listing.seller.email

    buyer_body = (
        f"Hi {order.buyer.username},\n\n"
        f"Your order has been placed successfully.\n\n"
        f"  Card:     {card_name}\n"
        f"  Quantity: {qty}\n"
        f"  Price:    CHF {price}\n\n"
        f"The seller will ship your item shortly. Thank you for shopping at TCG Marketplace!"
    )
    _send(f"Order confirmed: {card_name}", buyer_body, [buyer_email])

    seller_body = (
        f"Hi {order.listing.seller.username},\n\n"
        f"You have a new order!\n\n"
        f"  Card:     {card_name}\n"
        f"  Quantity: {qty}\n"
        f"  Price:    CHF {price}\n"
        f"  Buyer:    {order.buyer.username}\n\n"
        f"Please ship the item as soon as possible. Thank you!"
    )
    _send(f"New order received: {card_name}", seller_body, [seller_email])


# ---------------------------------------------------------------------------
# Offer emails
# ---------------------------------------------------------------------------

def send_offer_received(offer):
    """Notify the seller when a buyer makes an offer."""
    seller_email = offer.listing.seller.email
    card_name = offer.listing.card_master.card_name

    body = (
        f"Hi {offer.listing.seller.username},\n\n"
        f"{offer.buyer.username} has made an offer on your listing.\n\n"
        f"  Card:        {card_name}\n"
        f"  Your price:  CHF {offer.listing.price_chf}\n"
        f"  Offer price: CHF {offer.offer_price_chf}\n"
        f"  Message:     {offer.message or '(none)'}\n\n"
        f"Log in to accept, decline, or counter this offer."
    )
    _send(f"New offer on {card_name}", body, [seller_email])


def send_offer_response(offer):
    """Notify the buyer when a seller responds to their offer."""
    buyer_email = offer.buyer.email
    card_name = offer.listing.card_master.card_name
    status_label = offer.get_status_display()

    if offer.status == 'COUNTERED':
        detail = f"The seller has countered at CHF {offer.counter_price_chf}."
    elif offer.status == 'ACCEPTED':
        detail = "Your offer was accepted. An order has been created for you."
    else:
        detail = "Your offer was declined."

    body = (
        f"Hi {offer.buyer.username},\n\n"
        f"Your offer on {card_name} has been updated.\n\n"
        f"  Status: {status_label}\n"
        f"  {detail}\n\n"
        f"Log in to view the full details."
    )
    _send(f"Offer {status_label.lower()}: {card_name}", body, [buyer_email])
