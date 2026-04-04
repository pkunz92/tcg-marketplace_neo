"""
Reputation calculation helper — isolated to avoid circular imports between
serializers.py and views.py.
"""
import datetime

from django.utils import timezone


def compute_reputation(seller_user):
    """
    Weighted average reputation score for a seller.

    Reviews in last 90 days count ×2, older count ×1.
    Returns (score: float|None, total: int, recent: int).
    """
    from .models import Review

    cutoff = timezone.now() - datetime.timedelta(days=90)
    all_reviews = list(Review.objects.filter(seller=seller_user).values('stars', 'created_at'))
    if not all_reviews:
        return None, 0, 0

    weighted_sum = 0.0
    weight_total = 0.0
    recent_count = 0
    for r in all_reviews:
        w = 2.0 if r['created_at'] >= cutoff else 1.0
        if r['created_at'] >= cutoff:
            recent_count += 1
        weighted_sum += r['stars'] * w
        weight_total += w

    score = round(weighted_sum / weight_total, 2) if weight_total else None
    return score, len(all_reviews), recent_count
