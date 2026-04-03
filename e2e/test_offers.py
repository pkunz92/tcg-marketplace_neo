"""
Browser test stubs — Make Offer journey.

Journey:
  1. Buyer finds a card listing
  2. Clicks "Make Offer"
  3. Enters offer price and optional message
  4. Submits offer
  5. Seller sees incoming offer in their dashboard
  6. Seller accepts/declines/counters

These are stubs: selectors and page structure must be updated once
the Next.js frontend implements the offer UI.
"""

import pytest


@pytest.mark.skip(reason="Stub — frontend offer UI not yet implemented")
def test_buyer_makes_offer(page, base_url, buyer_credentials):
    """
    Buyer makes an offer on an available listing.
    Expected: offer appears in buyer's "My Offers" with PENDING status.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', buyer_credentials["username"])
    page.fill('[data-testid="password"]', buyer_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    # Navigate to a listing
    page.goto(f"{base_url}/listings")
    page.click('[data-testid="listing-card-0"]')
    page.wait_for_selector('[data-testid="listing-detail"]')

    # Open offer form
    page.click('[data-testid="make-offer-btn"]')
    page.fill('[data-testid="offer-price"]', "35.00")
    page.fill('[data-testid="offer-message"]', "Would you accept this?")
    page.click('[data-testid="offer-submit"]')
    page.wait_for_selector('[data-testid="offer-success"]')

    # Verify in My Offers
    page.goto(f"{base_url}/dashboard/offers")
    assert page.locator('[data-testid="offer-row"]').count() >= 1
    assert "35.00" in page.locator('[data-testid="offer-row"]:first-child').inner_text()
    assert "PENDING" in page.locator('[data-testid="offer-row"]:first-child').inner_text()


@pytest.mark.skip(reason="Stub — frontend offer UI not yet implemented")
def test_seller_accepts_offer(page, base_url, seller_credentials):
    """
    Seller accepts a pending offer from their dashboard.
    Expected: offer status changes to ACCEPTED.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/incoming-offers")
    page.click('[data-testid="offer-accept-0"]')
    page.click('[data-testid="confirm-accept"]')
    page.wait_for_selector('[data-testid="accept-success"]')
    assert "ACCEPTED" in page.locator('[data-testid="offer-row-0"]').inner_text()


@pytest.mark.skip(reason="Stub — frontend offer UI not yet implemented")
def test_seller_counters_offer(page, base_url, seller_credentials):
    """
    Seller counters an offer with a different price.
    Expected: offer status changes to COUNTERED with counter price visible.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/incoming-offers")
    page.click('[data-testid="offer-counter-0"]')
    page.fill('[data-testid="counter-price"]', "42.00")
    page.click('[data-testid="counter-submit"]')
    page.wait_for_selector('[data-testid="counter-success"]')
    assert "COUNTERED" in page.locator('[data-testid="offer-row-0"]').inner_text()
    assert "42.00" in page.locator('[data-testid="offer-row-0"]').inner_text()


@pytest.mark.skip(reason="Stub — frontend offer UI not yet implemented")
def test_buyer_withdraws_offer(page, base_url, buyer_credentials):
    """
    Buyer withdraws a pending offer.
    Expected: offer disappears from My Offers list.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', buyer_credentials["username"])
    page.fill('[data-testid="password"]', buyer_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/offers")
    count_before = page.locator('[data-testid="offer-row"]').count()
    page.click('[data-testid="offer-withdraw-0"]')
    page.click('[data-testid="confirm-withdraw"]')
    page.wait_for_selector('[data-testid="withdraw-success"]')
    count_after = page.locator('[data-testid="offer-row"]').count()
    assert count_after == count_before - 1
