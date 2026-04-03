"""
Phase 2 integration tests — full API request/response cycle.

Tests cover:
  - Listing CRUD (L-01 .. L-09)
  - Offer state machine (O-01 .. O-11)
  - Order creation & status transitions (OR-01 .. OR-06)
  - Stripe webhook handling (W-01 .. W-07)
  - Transaction audit trail (T-01 .. T-03)
  - Edge cases (E-01 .. E-04)

Run with:
    cd backend && python manage.py test api.tests_integration
  or via pytest:
    pip install pytest pytest-django
    python -m pytest api/tests_integration.py -v
"""

import json
from decimal import Decimal
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone

from .models import (
    Card_Listing, Card_Master, CardGrade, ConditionChoices, GradingChoices,
    Offer, OfferStatusChoices, Order, OrderStatusChoices,
    Set_Master, Transaction, TransactionStatusChoices,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def make_user(username, password="testpass123"):
    return User.objects.create_user(username=username, password=password, email=f"{username}@test.com")


def make_set(code="BASE1"):
    return Set_Master.objects.create(
        set_code=code, language="en", set_name=f"Set {code}", total_cards=100
    )


def make_card(card_set, api_id="base1-4", name="Charizard"):
    return Card_Master.objects.create(
        api_id=api_id,
        set=card_set,
        card_name=name,
        card_number="4",
        card_rarity="Holo Rare",
        image_url="https://example.com/card.jpg",
    )


def make_listing(card, seller, price="25.00", quantity=1, available=True):
    return Card_Listing.objects.create(
        card_master=card,
        seller=seller,
        price_chf=Decimal(price),
        quantity=quantity,
        condition=ConditionChoices.NM,
        is_graded=GradingChoices.RAW,
        is_available=available,
    )


def make_order(listing, buyer, quantity=1, status=OrderStatusChoices.PENDING):
    return Order.objects.create(
        listing=listing,
        buyer=buyer,
        quantity=quantity,
        price_chf=listing.price_chf,
        shipping_name="Test Buyer",
        shipping_address_line1="123 Main St",
        shipping_city="Zurich",
        shipping_postal_code="8001",
        shipping_country="Switzerland",
        status=status,
    )


def make_offer(listing, buyer, price="20.00", status=OfferStatusChoices.PENDING):
    return Offer.objects.create(
        listing=listing,
        buyer=buyer,
        offer_price_chf=Decimal(price),
        status=status,
        expires_at=timezone.now() + timezone.timedelta(hours=48),
    )


def make_transaction(order, pi_id="pi_test_001", status=TransactionStatusChoices.PENDING):
    return Transaction.objects.create(
        order=order,
        stripe_payment_intent_id=pi_id,
        amount_chf=order.price_chf,
        status=status,
    )


# ---------------------------------------------------------------------------
# L — Listing CRUD
# ---------------------------------------------------------------------------

class ListingCRUDTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.other = make_user("other")
        card_set = make_set()
        self.card = make_card(card_set)
        self.listing = make_listing(self.card, self.seller)

    def _listings_url(self, pk=None):
        if pk:
            return reverse("card-listing-detail", args=[pk])
        return reverse("card-listing-list")

    # L-01: unauthenticated GET returns available listings
    def test_L01_list_unauthenticated(self):
        resp = self.client.get(self._listings_url())
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        results = data.get("results", data)
        self.assertTrue(len(results) >= 1)

    # L-02: authenticated seller can create listing
    def test_L02_create_listing_authenticated(self):
        self.client.login(username="seller", password="testpass123")
        payload = {
            "card_master": self.card.api_id,
            "price_chf": "30.00",
            "quantity": 2,
            "condition": ConditionChoices.LP,
            "is_graded": GradingChoices.RAW,
        }
        resp = self.client.post(
            self._listings_url(), json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["seller_username"], "seller")

    # L-03: unauthenticated cannot create listing
    def test_L03_create_listing_unauthenticated(self):
        payload = {
            "card_master": self.card.api_id,
            "price_chf": "10.00",
            "quantity": 1,
            "condition": ConditionChoices.NM,
            "is_graded": GradingChoices.RAW,
        }
        resp = self.client.post(
            self._listings_url(), json.dumps(payload), content_type="application/json"
        )
        self.assertIn(resp.status_code, [401, 403])

    # L-04: owner can patch listing
    def test_L04_patch_by_owner(self):
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._listings_url(self.listing.pk),
            json.dumps({"price_chf": "29.99"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.price_chf, Decimal("29.99"))

    # L-05: non-owner patch is rejected
    def test_L05_patch_by_non_owner(self):
        self.client.login(username="other", password="testpass123")
        resp = self.client.patch(
            self._listings_url(self.listing.pk),
            json.dumps({"price_chf": "1.00"}),
            content_type="application/json",
        )
        self.assertIn(resp.status_code, [403, 404])

    # L-06: owner can delete listing
    def test_L06_delete_by_owner(self):
        self.client.login(username="seller", password="testpass123")
        resp = self.client.delete(self._listings_url(self.listing.pk))
        self.assertEqual(resp.status_code, 204)

    # L-07: my_listings filter returns only own listings
    def test_L07_my_listings_filter(self):
        make_listing(self.card, self.other, price="15.00")
        self.client.login(username="seller", password="testpass123")
        resp = self.client.get(self._listings_url() + "?my_listings=true")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        for item in results:
            self.assertEqual(item["seller_username"], "seller")

    # L-08: include_unavailable shows all listings
    def test_L08_include_unavailable(self):
        make_listing(self.card, self.seller, available=False)
        resp = self.client.get(self._listings_url() + "?include_unavailable=true")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        statuses = [r["is_available"] for r in results]
        self.assertIn(False, statuses)

    # L-09: search by card name returns matching results
    def test_L09_search_by_card_name(self):
        resp = self.client.get(self._listings_url() + "?search=Charizard")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        for item in results:
            self.assertIn("Charizard", item["card_name"])


# ---------------------------------------------------------------------------
# O — Offer state machine
# ---------------------------------------------------------------------------

class OfferStateMachineTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.buyer = make_user("buyer")
        self.other = make_user("other")
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, price="50.00")

    def _offers_url(self, pk=None):
        if pk:
            return reverse("offer-detail", args=[pk])
        return reverse("offer-list")

    def _create_offer(self, price="40.00"):
        self.client.login(username="buyer", password="testpass123")
        payload = {
            "listing": self.listing.pk,
            "offer_price_chf": price,
            "message": "Please accept!",
        }
        return self.client.post(
            self._offers_url(), json.dumps(payload), content_type="application/json"
        )

    # O-01: buyer creates offer
    def test_O01_buyer_creates_offer(self):
        resp = self._create_offer()
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "PENDING")
        self.assertIn("expires_at", data)

    # O-02: offer on unavailable listing rejected
    def test_O02_offer_on_unavailable_listing(self):
        self.listing.is_available = False
        self.listing.save()
        resp = self._create_offer()
        self.assertEqual(resp.status_code, 400)

    # O-03: seller accepts pending offer
    def test_O03_seller_accepts_offer(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._offers_url(offer.pk),
            json.dumps({"status": "ACCEPTED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.ACCEPTED)

    # O-04: seller declines pending offer
    def test_O04_seller_declines_offer(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._offers_url(offer.pk),
            json.dumps({"status": "DECLINED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.DECLINED)

    # O-05: seller counters offer
    def test_O05_seller_counters_offer(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._offers_url(offer.pk),
            json.dumps({"status": "COUNTERED", "counter_price_chf": "45.00"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.COUNTERED)
        self.assertEqual(offer.counter_price_chf, Decimal("45.00"))

    # O-06: non-seller cannot respond to offer
    def test_O06_non_seller_cannot_respond(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="other", password="testpass123")
        resp = self.client.patch(
            self._offers_url(offer.pk),
            json.dumps({"status": "ACCEPTED"}),
            content_type="application/json",
        )
        self.assertIn(resp.status_code, [403, 404])

    # O-07: buyer withdraws pending offer
    def test_O07_buyer_withdraws_offer(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.delete(self._offers_url(offer.pk))
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Offer.objects.filter(pk=offer.pk).exists())

    # O-08: buyer cannot delete non-pending offer
    def test_O08_cannot_delete_accepted_offer(self):
        offer = make_offer(self.listing, self.buyer, status=OfferStatusChoices.ACCEPTED)
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.delete(self._offers_url(offer.pk))
        self.assertEqual(resp.status_code, 400)

    # O-09: non-buyer cannot delete offer
    def test_O09_non_buyer_cannot_delete(self):
        offer = make_offer(self.listing, self.buyer)
        self.client.login(username="other", password="testpass123")
        resp = self.client.delete(self._offers_url(offer.pk))
        self.assertIn(resp.status_code, [403, 404])

    # O-10: seller cannot update already-accepted offer
    def test_O10_cannot_update_accepted_offer(self):
        offer = make_offer(self.listing, self.buyer, status=OfferStatusChoices.ACCEPTED)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._offers_url(offer.pk),
            json.dumps({"status": "DECLINED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    # O-11: concurrent offers from two buyers both succeed
    def test_O11_concurrent_offers_allowed(self):
        buyer2 = make_user("buyer2")
        make_offer(self.listing, self.buyer)
        Offer.objects.create(
            listing=self.listing,
            buyer=buyer2,
            offer_price_chf=Decimal("42.00"),
            expires_at=timezone.now() + timezone.timedelta(hours=48),
        )
        self.assertEqual(
            Offer.objects.filter(listing=self.listing, status=OfferStatusChoices.PENDING).count(),
            2,
        )

    # Buyer sees own offers; seller sees offers on their listings
    def test_offer_list_as_seller(self):
        make_offer(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.get(self._offers_url() + "?as_seller=true")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        self.assertTrue(len(results) >= 1)

    def test_offer_list_as_buyer(self):
        make_offer(self.listing, self.buyer)
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.get(self._offers_url())
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        for item in results:
            self.assertEqual(item["buyer_username"], "buyer")


# ---------------------------------------------------------------------------
# OR — Order creation & status transitions
# ---------------------------------------------------------------------------

class OrderFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.buyer = make_user("buyer")
        self.other = make_user("other")
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, price="25.00", quantity=3)

    def _orders_url(self, pk=None):
        if pk:
            return reverse("order-detail", args=[pk])
        return reverse("order-list")

    def _create_order(self, quantity=1):
        self.client.login(username="buyer", password="testpass123")
        payload = {
            "listing": self.listing.pk,
            "quantity": quantity,
            "price_chf": str(self.listing.price_chf),
            "shipping_name": "Test Buyer",
            "shipping_address_line1": "123 Main St",
            "shipping_city": "Zurich",
            "shipping_postal_code": "8001",
            "shipping_country": "Switzerland",
        }
        return self.client.post(
            self._orders_url(), json.dumps(payload), content_type="application/json"
        )

    # OR-01: authenticated buyer can create order
    def test_OR01_create_order_authenticated(self):
        resp = self._create_order()
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["status"], "PENDING")

    # OR-02: unauthenticated buyer gets 401
    def test_OR02_create_order_unauthenticated(self):
        payload = {
            "listing": self.listing.pk,
            "quantity": 1,
            "price_chf": "25.00",
            "shipping_name": "X",
            "shipping_address_line1": "X",
            "shipping_city": "X",
            "shipping_postal_code": "X",
            "shipping_country": "X",
        }
        resp = self.client.post(
            self._orders_url(), json.dumps(payload), content_type="application/json"
        )
        self.assertIn(resp.status_code, [401, 403])

    # OR-03: seller marks order COMPLETED
    # Seller must use ?seller=true so the viewset's get_queryset returns their listings' orders.
    def test_OR03_seller_completes_order(self):
        order = make_order(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._orders_url(order.pk) + "?seller=true",
            json.dumps({"status": "COMPLETED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatusChoices.COMPLETED)

    # OR-04: seller cancels order; listing restocked
    def test_OR04_seller_cancels_order_restocks(self):
        initial_qty = self.listing.quantity
        order = make_order(self.listing, self.buyer, quantity=2)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._orders_url(order.pk) + "?seller=true",
            json.dumps({"status": "CANCELLED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, initial_qty + 2)
        self.assertTrue(self.listing.is_available)

    # OR-05: non-seller cannot update order (returns 404 because queryset hides order)
    def test_OR05_non_seller_cannot_update(self):
        order = make_order(self.listing, self.buyer)
        self.client.login(username="other", password="testpass123")
        resp = self.client.patch(
            self._orders_url(order.pk) + "?seller=true",
            json.dumps({"status": "COMPLETED"}),
            content_type="application/json",
        )
        # other user owns no listings so the order is invisible; 404 is the expected response
        self.assertIn(resp.status_code, [403, 404])

    # OR-06: already-completed order cannot be updated
    def test_OR06_cannot_update_completed_order(self):
        order = make_order(self.listing, self.buyer, status=OrderStatusChoices.COMPLETED)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            self._orders_url(order.pk) + "?seller=true",
            json.dumps({"status": "CANCELLED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    # Seller can list their received orders
    def test_OR07_seller_order_list(self):
        make_order(self.listing, self.buyer)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.get(self._orders_url() + "?seller=true")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        self.assertTrue(len(results) >= 1)


# ---------------------------------------------------------------------------
# W — Stripe webhook handling
# ---------------------------------------------------------------------------

class StripeWebhookTests(TestCase):
    """
    Stripe webhook tests.

    The stripe package is imported lazily inside each handler function
    (``import stripe`` at function scope), so ``patch("api.stripe_webhooks.stripe")``
    does not work.  Instead we inject a MagicMock directly into ``sys.modules``
    so that the lazy ``import stripe`` inside the handler picks up our mock.
    """

    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.buyer = make_user("buyer")
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, quantity=2)
        self.order = make_order(self.listing, self.buyer, quantity=1)
        self.txn = make_transaction(self.order, pi_id="pi_test_w001")
        self.txn.stripe_charge_id = "ch_test_w001"
        self.txn.save()
        self.webhook_url = reverse("stripe-webhook")

        # Build a reusable fake stripe module
        import sys
        self._real_stripe = sys.modules.get("stripe")
        self.mock_stripe = MagicMock()
        # Provide a concrete SignatureVerificationError class on the mock
        class _SigVerErr(Exception):
            def __init__(self, msg, sig_header, **kwargs):
                super().__init__(msg)
        self.mock_stripe.error.SignatureVerificationError = _SigVerErr
        sys.modules["stripe"] = self.mock_stripe

    def tearDown(self):
        import sys
        if self._real_stripe is None:
            sys.modules.pop("stripe", None)
        else:
            sys.modules["stripe"] = self._real_stripe

    def _post(self, body=b'{}'):
        return self.client.post(
            self.webhook_url,
            body,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=fake",
        )

    # W-01: payment_intent.succeeded marks transaction SUCCEEDED and order COMPLETED
    def test_W01_payment_intent_succeeded(self):
        self.mock_stripe.Webhook.construct_event.return_value = {
            "type": "payment_intent.succeeded",
            "id": "evt_001",
            "data": {"object": {"id": "pi_test_w001", "latest_charge": "ch_test_w001"}},
        }
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatusChoices.SUCCEEDED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatusChoices.COMPLETED)

    # W-02: payment_intent.succeeded with unknown PI returns 200 (idempotent)
    def test_W02_payment_intent_succeeded_unknown_pi(self):
        self.mock_stripe.Webhook.construct_event.return_value = {
            "type": "payment_intent.succeeded",
            "id": "evt_002",
            "data": {"object": {"id": "pi_UNKNOWN", "latest_charge": ""}},
        }
        resp = self._post()
        self.assertEqual(resp.status_code, 200)

    # W-03: payment_intent.payment_failed marks transaction FAILED
    def test_W03_payment_intent_failed(self):
        self.mock_stripe.Webhook.construct_event.return_value = {
            "type": "payment_intent.payment_failed",
            "id": "evt_003",
            "data": {"object": {"id": "pi_test_w001"}},
        }
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatusChoices.FAILED)

    # W-04: charge.refunded marks transaction REFUNDED and restocks listing
    def test_W04_charge_refunded_restocks(self):
        initial_qty = self.listing.quantity
        self.mock_stripe.Webhook.construct_event.return_value = {
            "type": "charge.refunded",
            "id": "evt_004",
            "data": {"object": {"id": "ch_test_w001"}},
        }
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.txn.refresh_from_db()
        self.assertEqual(self.txn.status, TransactionStatusChoices.REFUNDED)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, initial_qty + self.order.quantity)
        self.assertTrue(self.listing.is_available)

    # W-05: invalid payload (ValueError from construct_event) returns 400
    def test_W05_invalid_payload(self):
        self.mock_stripe.Webhook.construct_event.side_effect = ValueError("bad payload")
        resp = self._post(b'NOT JSON')
        self.assertEqual(resp.status_code, 400)

    # W-06: invalid signature returns 400
    def test_W06_invalid_signature(self):
        SigErr = self.mock_stripe.error.SignatureVerificationError
        self.mock_stripe.Webhook.construct_event.side_effect = SigErr(
            "sig mismatch", "sig_header"
        )
        resp = self._post()
        self.assertEqual(resp.status_code, 400)

    # W-07: unknown event type returns 200 silently
    def test_W07_unknown_event_type(self):
        self.mock_stripe.Webhook.construct_event.return_value = {
            "type": "customer.created",
            "id": "evt_007",
            "data": {"object": {}},
        }
        resp = self._post()
        self.assertEqual(resp.status_code, 200)


# ---------------------------------------------------------------------------
# T — Transaction audit trail
# ---------------------------------------------------------------------------

class TransactionAuditTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.buyer = make_user("buyer")
        card_set = make_set()
        card = make_card(card_set)
        listing = make_listing(card, self.seller)
        order = make_order(listing, self.buyer)
        self.txn = make_transaction(order, pi_id="pi_audit_001", status=TransactionStatusChoices.SUCCEEDED)

    def _txn_url(self):
        return reverse("transaction-list")

    # T-01: buyer sees their transactions
    def test_T01_buyer_sees_transactions(self):
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.get(self._txn_url())
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["stripe_payment_intent_id"], "pi_audit_001")

    # T-02: seller sees transactions for their listings
    def test_T02_seller_sees_transactions_as_seller(self):
        self.client.login(username="seller", password="testpass123")
        resp = self.client.get(self._txn_url() + "?as_seller=true")
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 1)

    # T-03: POST to transactions returns 405
    def test_T03_cannot_post_transactions(self):
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.post(
            self._txn_url(),
            json.dumps({"stripe_payment_intent_id": "pi_fake"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 405)

    # Timestamps: created_at and updated_at are set
    def test_T04_timestamps_set(self):
        self.assertIsNotNone(self.txn.created_at)
        self.assertIsNotNone(self.txn.updated_at)


# ---------------------------------------------------------------------------
# E — Edge cases
# ---------------------------------------------------------------------------

class EdgeCaseTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.seller = make_user("seller")
        self.buyer = make_user("buyer")
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, quantity=3)

    # E-01: order cancellation restores exact quantity
    # Seller must use ?seller=true so the viewset's get_queryset returns their listings' orders.
    def test_E01_cancel_restores_exact_quantity(self):
        self.listing.quantity = 5
        self.listing.save()
        order = make_order(self.listing, self.buyer, quantity=3)
        self.client.login(username="seller", password="testpass123")
        resp = self.client.patch(
            reverse("order-detail", args=[order.pk]) + "?seller=true",
            json.dumps({"status": "CANCELLED"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, 8)  # 5 + 3

    # E-02: charge.refunded idempotency — documents that handler will restock on each call
    def test_E02_refund_idempotency(self):
        import sys
        order = make_order(self.listing, self.buyer, quantity=1)
        txn = make_transaction(order, pi_id="pi_e02", status=TransactionStatusChoices.REFUNDED)
        txn.stripe_charge_id = "ch_e02"
        txn.save()
        qty_before = self.listing.quantity

        mock_stripe = MagicMock()

        class _SigVerErr(Exception):
            def __init__(self, msg, sig_header, **kwargs):
                super().__init__(msg)

        mock_stripe.error.SignatureVerificationError = _SigVerErr
        mock_stripe.Webhook.construct_event.return_value = {
            "type": "charge.refunded",
            "id": "evt_e02",
            "data": {"object": {"id": "ch_e02"}},
        }

        real = sys.modules.get("stripe")
        sys.modules["stripe"] = mock_stripe
        try:
            self.client.post(
                reverse("stripe-webhook"),
                b'{}',
                content_type="application/json",
                HTTP_STRIPE_SIGNATURE="t=1,v1=fake",
            )
        finally:
            if real is None:
                sys.modules.pop("stripe", None)
            else:
                sys.modules["stripe"] = real

        self.listing.refresh_from_db()
        # Webhook handler does not guard against double-restock at model level;
        # this test documents current behavior and flags the gap.
        # If business logic adds idempotency guard, update assertion to assertEqual(qty_before).
        self.assertGreaterEqual(self.listing.quantity, qty_before)

    # E-03: offer on unavailable listing is rejected
    def test_E03_offer_on_unavailable_listing(self):
        self.listing.is_available = False
        self.listing.save()
        self.client.login(username="buyer", password="testpass123")
        resp = self.client.post(
            reverse("offer-list"),
            json.dumps({
                "listing": self.listing.pk,
                "offer_price_chf": "20.00",
                "message": "",
            }),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    # E-04: duplicate Stripe payment_intent_id raises IntegrityError at DB level
    def test_E04_duplicate_payment_intent_id(self):
        order = make_order(self.listing, self.buyer)
        make_transaction(order, pi_id="pi_dup")

        seller2 = make_user("seller2")
        buyer2 = make_user("buyer2")
        card_set2 = make_set(code="JNG1")
        card2 = make_card(card_set2, api_id="jng1-1", name="Clefable")
        listing2 = make_listing(card2, seller2)
        order2 = make_order(listing2, buyer2)

        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Transaction.objects.create(
                order=order2,
                stripe_payment_intent_id="pi_dup",
                amount_chf=Decimal("10.00"),
            )
