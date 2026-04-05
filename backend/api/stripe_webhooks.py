"""
Stripe webhook handler for TCG Marketplace.

Setup required:
  1. pip install stripe
  2. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
  3. Add to urls.py:
       path('api/webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
  4. Register endpoint in Stripe dashboard pointing to /api/webhooks/stripe/

Supported events:
  - payment_intent.succeeded     -> mark Transaction SUCCEEDED, Order COMPLETED
  - payment_intent.payment_failed -> mark Transaction FAILED
  - charge.refunded               -> mark Transaction REFUNDED, restock listing
  - charge.dispute.created        -> auto-open Dispute record, flag user
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
        'charge.dispute.created': _on_charge_dispute_created,
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


def _on_charge_dispute_created(charge_dispute):
    """
    Auto-open a Dispute record when Stripe notifies us of a chargeback.
    Also flags the buyer in UserFlag for admin review.
    """
    from .models import Transaction, Dispute, DisputeStatusChoices, DisputeReasonChoices, UserFlag, FlagReasonChoices

    charge_id = charge_dispute.get('charge', '')
    stripe_reason = charge_dispute.get('reason', 'other')

    # Map Stripe dispute reasons to our internal choices
    reason_map = {
        'fraudulent': DisputeReasonChoices.UNAUTHORIZED,
        'not_received': DisputeReasonChoices.NOT_RECEIVED,
        'product_not_received': DisputeReasonChoices.NOT_RECEIVED,
        'product_unacceptable': DisputeReasonChoices.NOT_AS_DESCRIBED,
        'not_as_described': DisputeReasonChoices.NOT_AS_DESCRIBED,
    }
    reason = reason_map.get(stripe_reason, DisputeReasonChoices.OTHER)

    with transaction.atomic():
        try:
            txn = Transaction.objects.select_related('order__buyer').get(stripe_charge_id=charge_id)
        except Transaction.DoesNotExist:
            logger.error("charge.dispute.created: no Transaction for charge_id=%s", charge_id)
            return

        order = txn.order

        # Only open a new dispute if there isn't one already
        if not order.disputes.filter(status=DisputeStatusChoices.OPEN).exists():
            Dispute.objects.create(
                order=order,
                opened_by=order.buyer,
                reason=reason,
                description=f"Auto-opened from Stripe chargeback. Stripe reason: {stripe_reason}.",
            )
            logger.info(
                "charge.dispute.created: auto-opened dispute for order %s (charge=%s)",
                order.id, charge_id,
            )

        # Flag the buyer
        UserFlag.objects.create(
            user=order.buyer,
            reason=FlagReasonChoices.STRIPE_DISPUTE,
            detail=f"Stripe chargeback on order {order.id}. charge_id={charge_id}.",
        )

    logger.info(
        "charge.dispute.created: buyer %s flagged for chargeback on order %s",
        order.buyer_id, order.id,
    )
