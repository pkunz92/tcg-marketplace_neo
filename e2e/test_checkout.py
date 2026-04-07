"""
E2E tests — Direct purchase / checkout journey.

Journeys covered:
  1. Buyer browses marketplace and opens a listing detail page.
  2. Buyer clicks Buy Now, confirms in the BuyModal → order created.
  3. Order appears in buyer's My Orders page with PENDING status.
  4. Alternatively: buyer uses the full CheckoutPage flow
     (shipping form → payment step → place order → success screen).

Note on Stripe:
  The current implementation uses a placeholder Stripe element (not wired).
  The CheckoutPage flow calls createOrder.mutateAsync directly when
  "Place Order" is clicked, bypassing Stripe in this prototype.
  These tests exercise the full UI flow against the real API.

Prerequisites:
  - Backend running with ACCOUNT_EMAIL_VERIFICATION=none
  - Buyer's shipping address seeded (done in conftest via registration payload)
  - seller_listing fixture from conftest (session-scoped)
"""

import pytest
from playwright.sync_api import Page, expect
from conftest import BASE_URL, _create_listing, _api


# ---------------------------------------------------------------------------
# 1. Direct purchase via BuyModal (quick path from listing detail)
# ---------------------------------------------------------------------------

def test_buyer_buys_via_modal(buyer_page: Page, seller_listing):
    """Buyer clicks Buy Now on a listing detail page and confirms the order."""
    page = buyer_page

    page.goto(f"{BASE_URL}/market/{seller_listing}")
    expect(page.locator('[data-testid="listing-detail"]')).to_be_visible(timeout=10_000)

    # Buy Now button must be enabled
    expect(page.locator('[data-testid="buy-now-btn"]')).to_be_enabled(timeout=5_000)
    page.locator('[data-testid="buy-now-btn"]').click()

    # BuyModal opens — confirm order button should appear
    expect(page.locator('[data-testid="buy-confirm-btn"]')).to_be_visible(timeout=5_000)
    page.locator('[data-testid="buy-confirm-btn"]').click()

    # Wait for toast / modal close
    page.wait_for_timeout(3_000)


# ---------------------------------------------------------------------------
# 2. Order visible in My Orders after purchase
# ---------------------------------------------------------------------------

def test_order_appears_in_my_orders(buyer_page: Page, seller_user, buyer_user, card_api_id):
    """After a direct purchase the order appears in My Orders with PENDING status."""
    from conftest import _create_listing

    # Create a fresh listing so quantity is available
    fresh_listing_id = _create_listing(
        seller_user["token"], card_api_id, price=25.0, quantity=5
    )

    page = buyer_page

    # Navigate to listing and buy
    page.goto(f"{BASE_URL}/market/{fresh_listing_id}")
    expect(page.locator('[data-testid="listing-detail"]')).to_be_visible(timeout=10_000)
    expect(page.locator('[data-testid="buy-now-btn"]')).to_be_enabled(timeout=5_000)
    page.locator('[data-testid="buy-now-btn"]').click()

    expect(page.locator('[data-testid="buy-confirm-btn"]')).to_be_visible(timeout=5_000)
    page.locator('[data-testid="buy-confirm-btn"]').click()

    page.wait_for_timeout(3_000)

    # Go to My Orders
    page.goto(f"{BASE_URL}/dashboard/orders")
    expect(page.locator('[data-testid="order-row"]').first).to_be_visible(timeout=10_000)

    orders_text = page.locator('[data-testid="order-row"]').first.inner_text()
    assert "PENDING" in orders_text


# ---------------------------------------------------------------------------
# 3. Full CheckoutPage flow (shipping → payment → place order → success)
# ---------------------------------------------------------------------------

def test_checkout_page_full_flow(buyer_page: Page, seller_user, buyer_user, card_api_id):
    """Buyer completes the multi-step CheckoutPage flow and sees the success screen."""
    from conftest import _create_listing

    fresh_listing_id = _create_listing(
        seller_user["token"], card_api_id, price=30.0, quantity=5
    )

    page = buyer_page
    page.goto(f"{BASE_URL}/checkout/{fresh_listing_id}")

    # Step 1: Shipping form
    expect(page.locator('[data-testid="shipping-name"]')).to_be_visible(timeout=10_000)
    page.locator('[data-testid="shipping-name"]').fill("E2E Buyer")
    page.locator('[data-testid="shipping-address"]').fill("1 Test Street")
    page.locator('[data-testid="shipping-city"]').fill("Zurich")
    page.locator('[data-testid="shipping-postal-code"]').fill("8001")
    page.locator('[data-testid="shipping-country"]').fill("Switzerland")

    page.locator('[data-testid="continue-to-payment"]').click()

    # Step 2: Payment — Place Order button appears
    expect(page.locator('[data-testid="place-order-btn"]')).to_be_visible(timeout=8_000)
    page.locator('[data-testid="place-order-btn"]').click()

    # Success screen
    expect(page.locator('[data-testid="order-success"]')).to_be_visible(timeout=10_000)
    assert "Order Placed" in page.locator('[data-testid="order-success"]').inner_text()

    # Redirects to /dashboard/orders
    page.wait_for_url(f"{BASE_URL}/dashboard/orders", timeout=8_000)
    expect(page.locator('[data-testid="order-row"]').first).to_be_visible(timeout=8_000)


# ---------------------------------------------------------------------------
# 4. Buy button not shown to unauthenticated users
# ---------------------------------------------------------------------------

def test_unauthenticated_buyer_sees_sign_in_prompt(page: Page, seller_listing):
    """Unauthenticated visitors on a listing detail page see 'Sign in to buy'."""
    page.goto(f"{BASE_URL}/market/{seller_listing}")
    expect(page.locator('[data-testid="listing-detail"]')).to_be_visible(timeout=10_000)

    assert not page.locator('[data-testid="buy-now-btn"]').is_visible()
    assert not page.locator('[data-testid="make-offer-btn"]').is_visible()
    # Sign-in prompt link should be visible
    assert page.get_by_text("Sign in to buy").is_visible()
