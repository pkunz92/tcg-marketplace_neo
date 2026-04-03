"""
Playwright E2E test configuration and fixtures.

Requirements:
    pip install pytest-playwright playwright requests
    playwright install chromium

Environment variables:
    E2E_BASE_URL   — frontend dev server (default: http://localhost:3000)
    E2E_API_URL    — backend API base (default: http://localhost:8000/api)

Run:
    ACCOUNT_EMAIL_VERIFICATION=none python -m pytest e2e/ -v --headed
    ACCOUNT_EMAIL_VERIFICATION=none python -m pytest e2e/ -v  # headless
"""

import os
import uuid
import time
import requests
import pytest
from playwright.sync_api import Page, expect

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
API_URL = os.environ.get("E2E_API_URL", "http://localhost:8000/api")

# ---------------------------------------------------------------------------
# Session-scoped URL fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API_URL


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _api(path, method="GET", **kwargs):
    """Make a request to the backend API."""
    url = f"{API_URL}{path}"
    resp = getattr(requests, method.lower())(url, **kwargs)
    return resp


def _register_and_get_token(username, password, email=None):
    """Register a user via the API and return their auth token.

    Requires the backend to run with ACCOUNT_EMAIL_VERIFICATION=none.
    """
    email = email or f"{username}@e2etest.invalid"
    payload = {
        "username": username,
        "email": email,
        "password1": password,
        "password2": password,
        "shipping_name": f"E2E {username.title()}",
        "shipping_address_line1": "1 Test Street",
        "shipping_city": "Zurich",
        "shipping_postal_code": "8001",
        "shipping_country": "CH",
    }
    r = _api("/auth/registration/", "POST", json=payload)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Registration failed for {username}: {r.status_code} {r.text}")

    # Login to get token
    r2 = _api("/auth/login/", "POST", json={"username": username, "password": password})
    if r2.status_code != 200:
        raise RuntimeError(f"Login failed for {username}: {r2.status_code} {r2.text}")
    data = r2.json()
    return data.get("access") or data.get("key") or data.get("token")


def _get_first_card_api_id(token):
    """Return the api_id of the first card in the catalog."""
    headers = {"Authorization": f"Bearer {token}"}
    r = _api("/cards/list/?page=1", headers=headers)
    r.raise_for_status()
    results = r.json().get("results", [])
    if not results:
        raise RuntimeError("No cards in catalog — seed the DB before running E2E tests")
    return results[0]["api_id"]


def _create_listing(token, card_api_id, price=45.0, condition="NM", quantity=3):
    """Create a listing via the API and return its id."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "card_master": card_api_id,
        "price_chf": price,
        "condition": condition,
        "quantity": quantity,
        "is_graded": False,
        "grading_company": "RAW",
    }
    r = _api("/listings/", "POST", json=payload, headers=headers)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Listing creation failed: {r.status_code} {r.text}")
    return r.json()["id"]


def _create_offer(token, listing_id, price=35.0, message="E2E offer"):
    """Create an offer via the API and return its id."""
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "listing": listing_id,
        "offer_price_chf": price,
        "message": message,
    }
    r = _api("/offers/", "POST", json=payload, headers=headers)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Offer creation failed: {r.status_code} {r.text}")
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Session-scoped user fixtures (created once per test session)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def seller_user():
    """Create a seller test user and return (username, password, token)."""
    suffix = uuid.uuid4().hex[:6]
    username = f"e2e_seller_{suffix}"
    password = "E2ePass123!"
    token = _register_and_get_token(username, password)
    return {"username": username, "password": password, "token": token}


@pytest.fixture(scope="session")
def buyer_user():
    """Create a buyer test user and return (username, password, token)."""
    suffix = uuid.uuid4().hex[:6]
    username = f"e2e_buyer_{suffix}"
    password = "E2ePass123!"
    token = _register_and_get_token(username, password)
    return {"username": username, "password": password, "token": token}


@pytest.fixture(scope="session")
def card_api_id(seller_user):
    """Return the api_id of a card to use in tests."""
    return _get_first_card_api_id(seller_user["token"])


@pytest.fixture(scope="session")
def seller_listing(seller_user, card_api_id):
    """Create a listing as the seller and return its id."""
    return _create_listing(seller_user["token"], card_api_id, price=45.0, quantity=3)


# ---------------------------------------------------------------------------
# Page helpers
# ---------------------------------------------------------------------------

def login_as(page: Page, username: str, password: str):
    """Log in via the UI login form."""
    page.goto(f"{BASE_URL}/login")
    page.locator('[data-testid="login-username"]').fill(username)
    page.locator('[data-testid="login-password"]').fill(password)
    page.locator('[data-testid="login-submit"]').click()
    page.wait_for_url(f"{BASE_URL}/dashboard", timeout=10_000)


@pytest.fixture
def seller_page(page: Page, seller_user):
    """A Playwright page already logged in as the seller."""
    login_as(page, seller_user["username"], seller_user["password"])
    return page


@pytest.fixture
def buyer_page(page: Page, buyer_user):
    """A Playwright page already logged in as the buyer."""
    login_as(page, buyer_user["username"], buyer_user["password"])
    return page
