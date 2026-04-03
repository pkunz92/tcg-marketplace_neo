"""
Browser test stubs — Create Listing journey.

Journey:
  1. Seller logs in
  2. Navigates to "Sell a Card"
  3. Searches for and selects a card from the master database
  4. Fills in price, condition, quantity
  5. Submits the listing form
  6. Verifies the new listing appears in the seller's dashboard

These are stubs: selectors and page structure must be updated once
the Next.js frontend implements the listing creation UI.
"""

import pytest


@pytest.mark.skip(reason="Stub — frontend listing UI not yet implemented")
def test_create_listing_happy_path(page, base_url, seller_credentials):
    """
    Seller creates a new card listing end-to-end.
    Expected: listing appears in seller dashboard with correct price.
    """
    # Step 1: Log in
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    # Step 2: Navigate to sell page
    page.click('[data-testid="nav-sell"]')
    page.wait_for_url(f"{base_url}/sell")

    # Step 3: Search for card
    page.fill('[data-testid="card-search"]', "Charizard")
    page.click('[data-testid="card-result-0"]')

    # Step 4: Fill listing details
    page.fill('[data-testid="listing-price"]', "45.00")
    page.select_option('[data-testid="listing-condition"]', "NM")
    page.fill('[data-testid="listing-quantity"]', "1")

    # Step 5: Submit
    page.click('[data-testid="listing-submit"]')
    page.wait_for_selector('[data-testid="listing-success"]')

    # Step 6: Verify in dashboard
    page.goto(f"{base_url}/dashboard/listings")
    assert page.locator('[data-testid="listing-row"]').count() >= 1
    assert "45.00" in page.locator('[data-testid="listing-row"]:first-child').inner_text()


@pytest.mark.skip(reason="Stub — frontend listing UI not yet implemented")
def test_edit_listing_price(page, base_url, seller_credentials):
    """
    Seller edits the price of an existing listing.
    Expected: updated price reflects immediately in listing detail.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/listings")
    page.click('[data-testid="listing-edit-0"]')
    page.fill('[data-testid="listing-price"]', "39.99")
    page.click('[data-testid="listing-submit"]')
    page.wait_for_selector('[data-testid="listing-success"]')
    assert "39.99" in page.locator('[data-testid="listing-price-display"]').inner_text()


@pytest.mark.skip(reason="Stub — frontend listing UI not yet implemented")
def test_delete_listing(page, base_url, seller_credentials):
    """
    Seller deletes a listing.
    Expected: listing no longer appears in dashboard.
    """
    page.goto(f"{base_url}/login")
    page.fill('[data-testid="username"]', seller_credentials["username"])
    page.fill('[data-testid="password"]', seller_credentials["password"])
    page.click('[data-testid="login-submit"]')
    page.wait_for_url(f"{base_url}/dashboard")

    page.goto(f"{base_url}/dashboard/listings")
    count_before = page.locator('[data-testid="listing-row"]').count()
    page.click('[data-testid="listing-delete-0"]')
    page.click('[data-testid="confirm-delete"]')
    page.wait_for_selector('[data-testid="delete-success"]')
    count_after = page.locator('[data-testid="listing-row"]').count()
    assert count_after == count_before - 1
