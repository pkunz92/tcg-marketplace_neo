"""
Phase 2 unit tests — Offer, Transaction, CardGrade models, serializers, and API endpoints.
All tests use SQLite (Django's default test DB) and require no external services.

Run with:
    python manage.py test api.tests
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Card_Master, Card_Listing, CardGrade, ConditionChoices, GradingChoices,
    Offer, OfferStatusChoices, Order, OrderStatusChoices,
    Set_Master, Transaction, TransactionStatusChoices,
)
from .serializers import CardGradeSerializer, OfferSerializer, TransactionSerializer

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def make_user(username='buyer', password='testpass'):
    return User.objects.create_user(username=username, password=password)


def make_set():
    return Set_Master.objects.create(
        set_code='BASE1',
        language='en',
        set_name='Base Set',
        total_cards=102,
    )


def make_card(card_set):
    return Card_Master.objects.create(
        api_id='base1-4',
        set=card_set,
        card_name='Charizard',
        card_number='4',
        card_rarity='Holo Rare',
        image_url='https://example.com/charizard.jpg',
    )


def make_listing(card, seller, price='25.00', quantity=1):
    return Card_Listing.objects.create(
        card_master=card,
        seller=seller,
        price_chf=Decimal(price),
        quantity=quantity,
        condition=ConditionChoices.NM,
        is_graded=GradingChoices.RAW,
        is_available=True,
    )


def make_order(listing, buyer, quantity=1):
    return Order.objects.create(
        listing=listing,
        buyer=buyer,
        quantity=quantity,
        price_chf=listing.price_chf,
        shipping_name='Test Buyer',
        shipping_address_line1='123 Main St',
        shipping_city='Zurich',
        shipping_postal_code='8001',
        shipping_country='Switzerland',
        status=OrderStatusChoices.PENDING,
    )


# ---------------------------------------------------------------------------
# CardGrade model tests
# ---------------------------------------------------------------------------

class CardGradeModelTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller)

    def test_create_grade(self):
        grade = CardGrade.objects.create(
            listing=self.listing,
            company=GradingChoices.PSA,
            grade=Decimal('9.5'),
            cert_number='12345678',
            graded_at=date(2024, 1, 15),
        )
        self.assertEqual(str(grade), 'PSA 9.5 — cert 12345678')
        self.assertEqual(grade.listing, self.listing)

    def test_cert_number_unique(self):
        CardGrade.objects.create(
            listing=self.listing,
            company=GradingChoices.PSA,
            grade=Decimal('10.0'),
            cert_number='UNIQUE001',
        )
        seller2 = make_user('seller2')
        card_set2 = Set_Master.objects.create(
            set_code='JNG1', language='en', set_name='Jungle', total_cards=64
        )
        card2 = Card_Master.objects.create(
            api_id='jng1-1', set=card_set2, card_name='Clefable',
            card_number='1', card_rarity='Holo Rare',
            image_url='https://example.com/clefable.jpg',
        )
        listing2 = make_listing(card2, seller2)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            CardGrade.objects.create(
                listing=listing2,
                company=GradingChoices.PSA,
                grade=Decimal('9.0'),
                cert_number='UNIQUE001',  # duplicate
            )

    def test_listing_onetoone(self):
        CardGrade.objects.create(
            listing=self.listing,
            company=GradingChoices.BGS,
            grade=Decimal('9.5'),
            cert_number='BGS999',
        )
        self.assertEqual(self.listing.grade_detail.company, GradingChoices.BGS)


class CardGradeSerializerTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller)

    def test_valid_serializer(self):
        data = {
            'listing': self.listing.id,
            'company': GradingChoices.PSA,
            'grade': '9.5',
            'cert_number': 'SER001',
            'graded_at': '2024-03-01',
            'notes': '',
        }
        s = CardGradeSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)

    def test_grade_out_of_range(self):
        data = {
            'listing': self.listing.id,
            'company': GradingChoices.PSA,
            'grade': '11.0',
            'cert_number': 'SER002',
        }
        s = CardGradeSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('grade', s.errors)

    def test_grade_minimum(self):
        data = {
            'listing': self.listing.id,
            'company': GradingChoices.PSA,
            'grade': '0.5',
            'cert_number': 'SER003',
        }
        s = CardGradeSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('grade', s.errors)


# ---------------------------------------------------------------------------
# Offer model tests
# ---------------------------------------------------------------------------

class OfferModelTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        self.buyer = make_user('buyer')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, price='50.00')

    def _make_offer(self, price='40.00'):
        return Offer.objects.create(
            listing=self.listing,
            buyer=self.buyer,
            offer_price_chf=Decimal(price),
            expires_at=timezone.now() + timezone.timedelta(hours=48),
            status=OfferStatusChoices.PENDING,
        )

    def test_create_offer(self):
        offer = self._make_offer()
        self.assertEqual(offer.status, OfferStatusChoices.PENDING)
        self.assertEqual(offer.buyer, self.buyer)

    def test_offer_str(self):
        offer = self._make_offer()
        self.assertIn('40.00', str(offer))
        self.assertIn(str(self.listing.id), str(offer))

    def test_accept_offer(self):
        offer = self._make_offer()
        offer.status = OfferStatusChoices.ACCEPTED
        offer.save()
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.ACCEPTED)

    def test_counter_offer(self):
        offer = self._make_offer()
        offer.status = OfferStatusChoices.COUNTERED
        offer.counter_price_chf = Decimal('45.00')
        offer.save()
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.COUNTERED)
        self.assertEqual(offer.counter_price_chf, Decimal('45.00'))

    def test_multiple_offers_on_one_listing(self):
        buyer2 = make_user('buyer2')
        self._make_offer('40.00')
        Offer.objects.create(
            listing=self.listing,
            buyer=buyer2,
            offer_price_chf=Decimal('42.00'),
            expires_at=timezone.now() + timezone.timedelta(hours=48),
        )
        self.assertEqual(Offer.objects.filter(listing=self.listing).count(), 2)


class OfferSerializerTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        self.buyer = make_user('buyer')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, price='50.00')

    def test_valid_offer(self):
        data = {
            'listing': self.listing.id,
            'offer_price_chf': '40.00',
            'message': 'Please accept!',
            'expires_at': (timezone.now() + timezone.timedelta(hours=48)).isoformat(),
        }
        s = OfferSerializer(data=data)
        self.assertTrue(s.is_valid(), s.errors)

    def test_offer_on_unavailable_listing(self):
        self.listing.is_available = False
        self.listing.save()
        data = {
            'listing': self.listing.id,
            'offer_price_chf': '40.00',
            'expires_at': (timezone.now() + timezone.timedelta(hours=48)).isoformat(),
        }
        s = OfferSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('listing', s.errors or s.non_field_errors().__str__() and s.errors)

    def test_negative_offer_price(self):
        data = {
            'listing': self.listing.id,
            'offer_price_chf': '-5.00',
            'expires_at': (timezone.now() + timezone.timedelta(hours=48)).isoformat(),
        }
        s = OfferSerializer(data=data)
        self.assertFalse(s.is_valid())
        self.assertIn('offer_price_chf', s.errors)


# ---------------------------------------------------------------------------
# Transaction model tests
# ---------------------------------------------------------------------------

class TransactionModelTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        self.buyer = make_user('buyer')
        card_set = make_set()
        card = make_card(card_set)
        listing = make_listing(card, self.seller, price='25.00')
        self.order = make_order(listing, self.buyer)

    def _make_transaction(self, pi_id='pi_test_001'):
        return Transaction.objects.create(
            order=self.order,
            stripe_payment_intent_id=pi_id,
            amount_chf=self.order.price_chf,
            status=TransactionStatusChoices.PENDING,
        )

    def test_create_transaction(self):
        txn = self._make_transaction()
        self.assertEqual(txn.status, TransactionStatusChoices.PENDING)
        self.assertEqual(txn.order, self.order)

    def test_transaction_str(self):
        txn = self._make_transaction()
        self.assertIn('pi_test_001', str(txn))
        self.assertIn('PENDING', str(txn))

    def test_succeed_transaction(self):
        txn = self._make_transaction()
        txn.status = TransactionStatusChoices.SUCCEEDED
        txn.stripe_charge_id = 'ch_test_001'
        txn.save()
        txn.refresh_from_db()
        self.assertEqual(txn.status, TransactionStatusChoices.SUCCEEDED)
        self.assertEqual(txn.stripe_charge_id, 'ch_test_001')

    def test_payment_intent_unique(self):
        self._make_transaction(pi_id='pi_duplicate')
        seller2 = make_user('seller2')
        buyer2 = make_user('buyer2')
        card_set2 = Set_Master.objects.create(
            set_code='FOS1', language='en', set_name='Fossil', total_cards=62
        )
        card2 = Card_Master.objects.create(
            api_id='fos1-1', set=card_set2, card_name='Gengar',
            card_number='5', card_rarity='Holo Rare',
            image_url='https://example.com/gengar.jpg',
        )
        listing2 = make_listing(card2, seller2)
        order2 = make_order(listing2, buyer2)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Transaction.objects.create(
                order=order2,
                stripe_payment_intent_id='pi_duplicate',
                amount_chf=listing2.price_chf,
            )

    def test_order_onetoone(self):
        txn = self._make_transaction()
        self.assertEqual(self.order.transaction, txn)


class TransactionSerializerTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller')
        self.buyer = make_user('buyer')
        card_set = make_set()
        card = make_card(card_set)
        listing = make_listing(card, self.seller)
        self.order = make_order(listing, self.buyer)
        self.txn = Transaction.objects.create(
            order=self.order,
            stripe_payment_intent_id='pi_serial_test',
            amount_chf=self.order.price_chf,
            status=TransactionStatusChoices.PENDING,
        )

    def test_serializes_correctly(self):
        s = TransactionSerializer(self.txn)
        data = s.data
        self.assertEqual(data['stripe_payment_intent_id'], 'pi_serial_test')
        self.assertEqual(data['status'], 'PENDING')
        self.assertEqual(int(data['order_id']), self.order.id)

    def test_read_only_fields_ignored_on_update(self):
        update_data = {
            'order': self.order.id,
            'stripe_payment_intent_id': 'pi_should_not_change',
            'amount_chf': '999.00',
            'status': TransactionStatusChoices.SUCCEEDED,
        }
        s = TransactionSerializer(self.txn, data=update_data, partial=True)
        self.assertTrue(s.is_valid(), s.errors)
        instance = s.save()
        # Read-only fields must not be overwritten
        self.assertEqual(instance.stripe_payment_intent_id, 'pi_serial_test')


# ---------------------------------------------------------------------------
# Offer API endpoint tests
# ---------------------------------------------------------------------------

class OfferViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller = make_user('seller_api')
        self.buyer = make_user('buyer_api')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller, price='50.00', quantity=3)

    def _make_offer(self, price='40.00'):
        return Offer.objects.create(
            listing=self.listing,
            buyer=self.buyer,
            offer_price_chf=Decimal(price),
            expires_at=timezone.now() + timezone.timedelta(hours=48),
            status=OfferStatusChoices.PENDING,
        )

    def test_buyer_can_create_offer(self):
        self.client.force_authenticate(user=self.buyer)
        resp = self.client.post('/api/offers/', {
            'listing': self.listing.id,
            'offer_price_chf': '38.00',
            'message': 'Best offer!',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Offer.objects.filter(buyer=self.buyer).count(), 1)

    def test_seller_can_decline_offer(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/decline/')
        self.assertEqual(resp.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.DECLINED)

    def test_seller_can_counter_offer(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/counter/', {
            'counter_price_chf': '45.00',
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.COUNTERED)
        self.assertEqual(offer.counter_price_chf, Decimal('45.00'))

    def test_seller_accept_creates_order(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/accept/')
        self.assertEqual(resp.status_code, 201)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.ACCEPTED)
        # An order should have been created at the offer price
        order = Order.objects.filter(listing=self.listing, buyer=self.buyer).first()
        self.assertIsNotNone(order)
        self.assertEqual(order.price_chf, Decimal('40.00'))

    def test_accept_decrements_listing_stock(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/accept/')
        self.assertEqual(resp.status_code, 201)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.quantity, 2)

    def test_buyer_cannot_accept_own_offer(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.buyer)
        resp = self.client.post(f'/api/offers/{offer.id}/accept/')
        self.assertEqual(resp.status_code, 403)

    def test_cannot_counter_without_price(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/counter/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_buyer_can_withdraw_pending_offer(self):
        offer = self._make_offer()
        self.client.force_authenticate(user=self.buyer)
        resp = self.client.delete(f'/api/offers/{offer.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Offer.objects.filter(id=offer.id).exists())

    def test_cannot_decline_already_declined_offer(self):
        offer = self._make_offer()
        offer.status = OfferStatusChoices.DECLINED
        offer.save()
        self.client.force_authenticate(user=self.seller)
        resp = self.client.post(f'/api/offers/{offer.id}/decline/')
        self.assertEqual(resp.status_code, 400)


# ---------------------------------------------------------------------------
# Offer expiry management command tests
# ---------------------------------------------------------------------------

class ExpireOffersCommandTest(TestCase):
    def setUp(self):
        self.seller = make_user('seller_exp')
        self.buyer = make_user('buyer_exp')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller)

    def _make_offer(self, expires_delta_hours=48, status=OfferStatusChoices.PENDING):
        return Offer.objects.create(
            listing=self.listing,
            buyer=self.buyer,
            offer_price_chf=Decimal('20.00'),
            expires_at=timezone.now() + timezone.timedelta(hours=expires_delta_hours),
            status=status,
        )

    def test_expires_overdue_pending_offers(self):
        expired = self._make_offer(expires_delta_hours=-1)
        active = self._make_offer(expires_delta_hours=48)

        from django.core.management import call_command
        call_command('expire_offers', verbosity=0)

        expired.refresh_from_db()
        active.refresh_from_db()
        self.assertEqual(expired.status, OfferStatusChoices.EXPIRED)
        self.assertEqual(active.status, OfferStatusChoices.PENDING)

    def test_dry_run_does_not_expire(self):
        offer = self._make_offer(expires_delta_hours=-1)
        from django.core.management import call_command
        call_command('expire_offers', dry_run=True, verbosity=0)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.PENDING)

    def test_does_not_expire_non_pending_offers(self):
        offer = self._make_offer(expires_delta_hours=-1, status=OfferStatusChoices.ACCEPTED)
        from django.core.management import call_command
        call_command('expire_offers', verbosity=0)
        offer.refresh_from_db()
        self.assertEqual(offer.status, OfferStatusChoices.ACCEPTED)
