"""
Stripe webhook handler skeleton for Phase 2 payment integration.

Setup required (not yet wired):
  1. pip install stripe
  2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
  3. Add to urls.py:
       path('api/webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
  4. Register endpoint in Stripe dashboard pointing to /api/webhooks/stripe/

Supported events (Phase 2 MVP):
  - payment_intent.succeeded     -> mark Transaction SUCCEEDED, Order COMPLETED
  - payment_intent.payment_failed -> mark Transaction FAILED
  - charge.refunded               -> mark Transaction REFUNDED, restock listing
"""

import logging
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Receives and verifies Stripe webhook events.
    All event processing is delegated to _handle_event().
    """
    try:
        import stripe
    except ImportError:
        logger.error("stripe package not installed. Run: pip install stripe")
        return HttpResponse(status=503)

    stripe.api_key = settings.STRIPE_SECRET_KEY
    webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '')

    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        logger.warning("Stripe webhook: invalid payload")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook: invalid signature")
        return HttpResponse(status=400)

    try:
        _handle_event(event)
    except Exception:
        logger.exception("Stripe webhook: unhandled error for event %s", event['id'])
        return HttpResponse(status=500)

    return HttpResponse(status=200)


def _handle_event(event):
    event_type = event['type']
    data = event['data']['object']

    handlers = {
        'payment_intent.succeeded': _on_payment_intent_succeeded,
        'payment_intent.payment_failed': _on_payment_intent_failed,
        'charge.refunded': _on_charge_refunded,
    }

    handler = handlers.get(event_type)
    if handler:
        handler(data)
    else:
        logger.debug("Stripe webhook: unhandled event type %s", event_type)


def _on_payment_intent_succeeded(payment_intent):
    """
    Mark Transaction as SUCCEEDED and Order as COMPLETED.
    Triggered when the buyer's card is successfully charged.
    """
    from .models import Transaction, TransactionStatusChoices, OrderStatusChoices

    pi_id = payment_intent['id']
    charge_id = payment_intent.get('latest_charge', '')

    with transaction.atomic():
        try:
            txn = Transaction.objects.select_for_update().get(
                stripe_payment_intent_id=pi_id
            )
        except Transaction.DoesNotExist:
            logger.error("payment_intent.succeeded: no Transaction for pi_id=%s", pi_id)
            return

        txn.stripe_charge_id = charge_id or ''
        txn.status = TransactionStatusChoices.SUCCEEDED
        txn.save(update_fields=['stripe_charge_id', 'status', 'updated_at'])

        order = txn.order
        order.status = OrderStatusChoices.COMPLETED
        order.save(update_fields=['status'])

    logger.info("payment_intent.succeeded: order %s completed (pi=%s)", order.id, pi_id)


def _on_payment_intent_failed(payment_intent):
    """
    Mark Transaction as FAILED. The listing stock is NOT restocked here —
    the buyer may retry. Use charge.refunded for explicit restocking.
    """
    from .models import Transaction, TransactionStatusChoices

    pi_id = payment_intent['id']

    try:
        txn = Transaction.objects.get(stripe_payment_intent_id=pi_id)
    except Transaction.DoesNotExist:
        logger.error("payment_intent.payment_failed: no Transaction for pi_id=%s", pi_id)
        return

    txn.status = TransactionStatusChoices.FAILED
    txn.save(update_fields=['status', 'updated_at'])

    logger.info("payment_intent.payment_failed: transaction %s failed (pi=%s)", txn.id, pi_id)


def _on_charge_refunded(charge):
    """
    Mark Transaction as REFUNDED and restock the listing.
    Triggered by seller-initiated refunds or dispute resolutions.
    """
    from .models import Transaction, TransactionStatusChoices, Card_Listing

    charge_id = charge['id']

    with transaction.atomic():
        try:
            txn = Transaction.objects.select_for_update().select_related(
                'order', 'order__listing'
            ).get(stripe_charge_id=charge_id)
        except Transaction.DoesNotExist:
            logger.error("charge.refunded: no Transaction for charge_id=%s", charge_id)
            return

        txn.status = TransactionStatusChoices.REFUNDED
        txn.save(update_fields=['status', 'updated_at'])

        order = txn.order
        listing = (
            Card_Listing.objects
            .select_for_update()
            .get(pk=order.listing_id)
        )
        listing.quantity += order.quantity
        listing.is_available = True
        listing.save(update_fields=['quantity', 'is_available'])

    logger.info(
        "charge.refunded: transaction %s refunded, listing %s restocked +%s",
        txn.id, listing.id, order.quantity,
    )
