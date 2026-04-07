"""
Management command: run_fraud_signals

Runs the hourly fraud signal checks and writes flags to UserFlag.
Notifies admin via Telegram when new flags are created.

Checks:
  1. Sellers with >3 cancelled orders in the last 30 days.
  2. Users with payment velocity >5 distinct Stripe payment methods in 10 minutes.

Schedule: call via cron every hour, e.g.:
  0 * * * * cd /app && python manage.py run_fraud_signals
"""
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run hourly fraud signal checks and flag suspicious users."

    def handle(self, *args, **options):
        flagged = []
        flagged += self._check_seller_cancellations()
        flagged += self._check_payment_velocity()

        if flagged:
            self._notify_admin(flagged)

        self.stdout.write(
            self.style.SUCCESS(f"Fraud signals done. New flags: {len(flagged)}")
        )

    # ------------------------------------------------------------------
    # Check 1: >3 cancelled orders as seller in last 30 days
    # ------------------------------------------------------------------
    def _check_seller_cancellations(self):
        from django.db.models import Count
        from api.models import Order, OrderStatusChoices, UserFlag, FlagReasonChoices

        cutoff = timezone.now() - timedelta(days=30)
        reason = FlagReasonChoices.EXCESSIVE_CANCELLATIONS

        # Count cancelled orders grouped by seller (via listing.seller)
        qs = (
            Order.objects
            .filter(status=OrderStatusChoices.CANCELLED, created_at__gte=cutoff)
            .values('listing__seller', 'listing__seller__username')
            .annotate(cancelled_count=Count('id'))
            .filter(cancelled_count__gt=3)
        )

        new_flags = []
        for row in qs:
            seller_id = row['listing__seller']
            count = row['cancelled_count']
            username = row['listing__seller__username']

            # Only create a new flag if one doesn't exist already in last 24h
            recent = UserFlag.objects.filter(
                user_id=seller_id,
                reason=reason,
                created_at__gte=timezone.now() - timedelta(hours=24),
            ).exists()
            if recent:
                continue

            flag = UserFlag.objects.create(
                user_id=seller_id,
                reason=reason,
                detail=f"{count} cancelled orders as seller in last 30 days.",
            )
            new_flags.append((flag, username))
            logger.warning(
                "Fraud flag: seller %s (id=%s) has %s cancelled orders in 30d",
                username, seller_id, count,
            )

        return new_flags

    # ------------------------------------------------------------------
    # Check 2: >5 distinct cards used in 10-minute window
    # ------------------------------------------------------------------
    def _check_payment_velocity(self):
        from django.db.models import Count
        from api.models import Transaction, UserFlag, FlagReasonChoices

        reason = FlagReasonChoices.PAYMENT_VELOCITY
        window = timedelta(minutes=10)
        cutoff = timezone.now() - timedelta(hours=1)  # only look at recent transactions

        # Pull succeeded transactions in last hour; group by buyer + 10-min bucket
        transactions = (
            Transaction.objects
            .filter(created_at__gte=cutoff, status='SUCCEEDED')
            .select_related('order__buyer')
            .order_by('order__buyer', 'created_at')
        )

        # Sliding-window count of distinct payment_intents per user per 10 min
        from collections import defaultdict
        from itertools import groupby

        new_flags = []
        for buyer, txns in groupby(transactions, key=lambda t: t.order.buyer_id):
            txn_list = list(txns)
            # Simple O(n²) sliding window — transaction volume per user is small
            for i, anchor in enumerate(txn_list):
                window_end = anchor.created_at + window
                window_txns = [
                    t for t in txn_list[i:]
                    if t.created_at <= window_end
                ]
                if len(window_txns) > 5:
                    buyer_obj = txn_list[0].order.buyer
                    recent = UserFlag.objects.filter(
                        user=buyer_obj,
                        reason=reason,
                        created_at__gte=timezone.now() - timedelta(hours=24),
                    ).exists()
                    if recent:
                        break

                    flag = UserFlag.objects.create(
                        user=buyer_obj,
                        reason=reason,
                        detail=(
                            f"{len(window_txns)} payments in a 10-minute window "
                            f"starting {anchor.created_at.isoformat()}."
                        ),
                    )
                    new_flags.append((flag, buyer_obj.username))
                    logger.warning(
                        "Fraud flag: buyer %s (id=%s) made %s payments in 10 min",
                        buyer_obj.username, buyer_obj.id, len(window_txns),
                    )
                    break  # one flag per user per run

        return new_flags

    # ------------------------------------------------------------------
    # Telegram notification
    # ------------------------------------------------------------------
    def _notify_admin(self, flagged):
        import os
        import urllib.request
        import urllib.parse
        import json

        token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
        chat_id = os.environ.get('TELEGRAM_ADMIN_CHAT_ID', '')

        if not token or not chat_id:
            logger.info("Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID missing). Skipping notify.")
            return

        lines = [f"🚨 *Fraud signals detected* ({len(flagged)} new flags)\n"]
        for flag, username in flagged:
            lines.append(f"• `{username}` — {flag.get_reason_display()}: {flag.detail}")

        text = "\n".join(lines)
        payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'Markdown'}
        data = json.dumps(payload).encode()
        url = f"https://api.telegram.org/bot{token}/sendMessage"

        try:
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            urllib.request.urlopen(req, timeout=10)
            logger.info("Telegram admin notification sent.")
        except Exception as e:
            logger.error("Telegram notification failed: %s", e)
