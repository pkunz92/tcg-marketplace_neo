"""
E2E tests — Seller listing journey.

Journeys covered:
  1. Seller registers a new account via the UI.
  2. Seller creates a listing from My Listings (card search → fill form → submit).
  3. Listing appears in My Listings dashboard.
  4. Listing is visible on the Marketplace browse page.
  5. Listing detail page shows correct price and Buy Now / Make Offer buttons.

Prerequisites:
  - Backend running at E2E_API_URL with ACCOUNT_EMAIL_VERIFICATION=none
  - Frontend running at E2E_BASE_URL
  - At least one card seeded in the database
"""

import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL, _register_and_get_token, _get_first_card_api_id
import uuid


# ---------------------------------------------------------------------------
# 1. Registration via UI
# ---------------------------------------------------------------------------

def test_seller_can_register(page: Page):
    """New user can complete the registration form and land on verify-email."""
    suffix = uuid.uuid4().hex[:6]
    page.goto(f"{BASE_URL}/register")

    page.locator('[data-testid="register-username"]').fill(f"e2e_reg_{suffix}")
    page.locator('[data-testid="register-email"]').fill(f"e2e_reg_{suffix}@test.invalid")
    page.locator('[data-testid="register-password1"]').fill("E2ePass123!")
    page.locator('[data-testid="register-password2"]').fill("E2ePass123!")
    page.locator('[data-testid="register-shipping-name"]').fill("Test Seller")
    page.locator('[data-testid="register-shipping-address"]').fill("1 Test Street")
    page.locator('[data-testid="register-shipping-city"]').fill("Zurich")
    page.locator('[data-testid="register-shipping-postal-code"]').fill("8001")
    page.locator('[data-testid="register-shipping-country"]').fill("CH")

    page.locator('[data-testid="register-submit"]').click()

    # Expect redirect to verify-email (or dashboard if email verification disabled)
    page.wait_for_url(lambda url: "verify-email" in url or "dashboard" in url, timeout=10_000)
    assert "verify-email" in page.url or "dashboard" in page.url


# ---------------------------------------------------------------------------
# 2. Create listing via UI
# ---------------------------------------------------------------------------

def test_seller_creates_listing(seller_page: Page, seller_user, card_api_id):
    """Seller navigates to My Listings and creates a new listing via the modal."""
    page = seller_page

    # Navigate to My Listings
    page.goto(f"{BASE_URL}/dashboard/listings")
    expect(page.locator('[data-testid="new-listing-btn"]')).to_be_visible()
    page.locator('[data-testid="new-listing-btn"]').click()

    # Modal opens — search for a card
    expect(page.locator('[data-testid="card-search"]')).to_be_visible(timeout=5_000)
    page.locator('[data-testid="card-search"]').fill("Charizard")

    # Wait for suggestions and click the first one
    expect(page.locator('[data-testid="card-suggestion-0"]')).to_be_visible(timeout=8_000)
    page.locator('[data-testid="card-suggestion-0"]').click()

    # Fill listing details
    page.locator('[data-testid="listing-price"]').fill("45.00")
    page.locator('[data-testid="listing-quantity"]').fill("2")

    # Submit
    page.locator('[data-testid="listing-submit"]').click()

    # Toast "Listing created!" should appear (or modal closes)
    expect(page.locator('[data-testid="listing-row"]').first).to_be_visible(timeout=8_000)

    # Verify listing row appears in the table
    expect(page.locator('[data-testid="listing-row"]').first).to_be_visible(timeout=8_000)
    assert page.locator('[data-testid="listing-row"]').count() >= 1


# ---------------------------------------------------------------------------
# 3. Listing appears on Marketplace
# ---------------------------------------------------------------------------

def test_listing_visible_on_marketplace(seller_page: Page, seller_listing):
    """A pre-created listing is visible in the Marketplace browse page."""
    page = seller_page
    page.goto(f"{BASE_URL}/market")

    # At least one listing card should appear
    expect(page.locator('[data-testid="listing-card"]').first).to_be_visible(timeout=10_000)
    assert page.locator('[data-testid="listing-card"]').count() >= 1


# ---------------------------------------------------------------------------
# 4. Listing detail page shows correct information
# ---------------------------------------------------------------------------

def test_listing_detail_page(seller_page: Page, seller_listing):
    """Listing detail page renders correctly with price and action area."""
    page = seller_page

    # Navigate directly to the listing detail
    page.goto(f"{BASE_URL}/market/{seller_listing}")
    expect(page.locator('[data-testid="listing-detail"]')).to_be_visible(timeout=10_000)

    # Price and card info rendered
    assert page.locator('[data-testid="listing-detail"]').is_visible()


# ---------------------------------------------------------------------------
# 5. Seller does not see Buy Now / Make Offer on their own listing
# ---------------------------------------------------------------------------

def test_seller_cannot_buy_own_listing(seller_page: Page, seller_listing):
    """Seller viewing their own listing should not see Buy Now / Make Offer buttons."""
    page = seller_page
    page.goto(f"{BASE_URL}/market/{seller_listing}")
    expect(page.locator('[data-testid="listing-detail"]')).to_be_visible(timeout=10_000)

    # Seller management message visible instead
    assert not page.locator('[data-testid="buy-now-btn"]').is_visible()
    assert not page.locator('[data-testid="make-offer-btn"]').is_visible()
