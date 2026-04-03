"""
Playwright E2E test configuration.

Requires:
    pip install pytest-playwright playwright
    playwright install chromium

Set BASE_URL env var to override the default dev server URL.

Run:
    python -m pytest e2e/ -v
"""

import os
import pytest

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
API_URL = os.environ.get("E2E_API_URL", "http://localhost:8000/api")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API_URL


@pytest.fixture
def seller_credentials():
    return {"username": "e2e_seller", "password": "e2epass123"}


@pytest.fixture
def buyer_credentials():
    return {"username": "e2e_buyer", "password": "e2epass123"}
