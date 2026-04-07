"""
Management command: expire_offers

Marks all PENDING offers whose expires_at timestamp has passed as EXPIRED.
Intended to be run periodically (e.g. every hour via cron or a task scheduler).

Usage:
    python manage.py expire_offers
    python manage.py expire_offers --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "Expire PENDING offers whose expires_at has passed."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report how many offers would be expired without updating them.',
        )

    def handle(self, *args, **options):
        from api.models import Offer, OfferStatusChoices

        now = timezone.now()
        expired_qs = Offer.objects.filter(
            status=OfferStatusChoices.PENDING,
            expires_at__lt=now,
        )

        count = expired_qs.count()

        if options['dry_run']:
            self.stdout.write(
                self.style.WARNING(f"[dry-run] {count} offer(s) would be expired.")
            )
            return

        updated = expired_qs.update(status=OfferStatusChoices.EXPIRED)
        self.stdout.write(
            self.style.SUCCESS(f"Expired {updated} offer(s) (run at {now.isoformat()}).")
        )
