"""
Browser test stubs — Buyer Checkout journey.

Journey:
  1. Buyer browses listings
  2. Selects a card and proceeds to checkout
  3. Fills in shipping details
  4. Completes Stripe payment (test card)
  5. Sees order confirmation page
  6. Seller sees new order in their dashboard

These are stubs: selectors and Stripe test-mode integration must be
wired once the Next.js checkout UI is implemented.

Stripe test card: 4242 4242 4242 4242 / any future expiry / any CVC.
"""

import pytest


@pytest.mark.skip(reason="Stub — frontend checkout UI and Stripe integration not yet implemented")
def test_buyer_checkout_happy_path(page, base_url, buyer_credentials):
    """
    Buyer completes a full purchase end-to-end.
    Expected: order confirmation page shown; order appears in buyer's order history.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', buyer_credentials["username"])
    page.fill('[data-testid="password"]', buyer_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    # Browse and select a listing
    page.goto(f"{base_url}/listings")
    page.click('[data-testid="listing-card-0"]')
    page.wait_for_selector('[data-testid="listing-detail"]')

    # Proceed to checkout
    page.click('[data-testid="buy-now-btn"]')
    page.wait_for_url(f"{base_url}/checkout/**")

    # Fill shipping details
    page.fill('[data-testid="shipping-name"]', "Test Buyer")
    page.fill('[data-testid="shipping-address"]', "123 Main St")
    page.fill('[data-testid="shipping-city"]', "Zurich")
    page.fill('[data-testid="shipping-postal-code"]', "8001")
    page.fill('[data-testid="shipping-country"]', "Switzerland")

    # Fill Stripe test card via iframe
    stripe_frame = page.frame_locator('[data-testid="stripe-card-element"] iframe')
    stripe_frame.locator('[placeholder="Card number"]').fill("4242 4242 4242 4242")
    stripe_frame.locator('[placeholder="MM / YY"]').fill("12 / 30")
    stripe_frame.locator('[placeholder="CVC"]').fill("123")

    # Submit payment
    page.click('[data-testid="pay-now-btn"]')
    page.wait_for_url(f"{base_url}/order-confirmation/**", timeout=15_000)
    page.wait_for_selector('[data-testid="order-success"]')

    # Verify order appears in history
    page.goto(f"{base_url}/dashboard/orders")
    assert page.locator('[data-testid="order-row"]').count() >= 1
    assert "PENDING" in page.locator('[data-testid="order-row"]:first-child').inner_text()


@pytest.mark.skip(reason="Stub — frontend checkout UI not yet implemented")
def test_checkout_with_declined_card(page, base_url, buyer_credentials):
    """
    Buyer attempts checkout with a declined Stripe test card.
    Expected: error message shown; order not created.

    Declined test card: 4000 0000 0000 0002
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', buyer_credentials["username"])
    page.fill('[data-testid="password"]', buyer_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/listings")
    page.click('[data-testid="listing-card-0"]')
    page.click('[data-testid="buy-now-btn"]')
    page.wait_for_url(f"{base_url}/checkout/**")

    page.fill('[data-testid="shipping-name"]', "Test Buyer")
    page.fill('[data-testid="shipping-address"]', "123 Main St")
    page.fill('[data-testid="shipping-city"]', "Zurich")
    page.fill('[data-testid="shipping-postal-code"]', "8001")
    page.fill('[data-testid="shipping-country"]', "Switzerland")

    stripe_frame = page.frame_locator('[data-testid="stripe-card-element"] iframe')
    stripe_frame.locator('[placeholder="Card number"]').fill("4000 0000 0000 0002")
    stripe_frame.locator('[placeholder="MM / YY"]').fill("12 / 30")
    stripe_frame.locator('[placeholder="CVC"]').fill("123")

    page.click('[data-testid="pay-now-btn"]')
    page.wait_for_selector('[data-testid="payment-error"]')
    assert page.locator('[data-testid="payment-error"]').is_visible()


@pytest.mark.skip(reason="Stub — frontend checkout UI not yet implemented")
def test_seller_sees_new_order(page, base_url, seller_credentials):
    """
    After a successful purchase, the seller sees the new order in their dashboard.
    Expected: order visible in /dashboard/sales with PENDING status.

    Precondition: a completed checkout has already occurred (run test_buyer_checkout_happy_path first).
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/sales")
    assert page.locator('[data-testid="order-row"]').count() >= 1
    first_order = page.locator('[data-testid="order-row"]:first-child').inner_text()
    assert "PENDING" in first_order
