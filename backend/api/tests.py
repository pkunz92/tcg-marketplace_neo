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
    Set_Master, Transaction, TransactionStatusChoices, Review,
)
from .serializers import CardGradeSerializer, OfferSerializer, TransactionSerializer
from .reputation import compute_reputation as _compute_reputation

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


# ---------------------------------------------------------------------------
# Phase 3 — AnalyzePhotoView tests (POST /api/listings/analyze-photo/)
# ---------------------------------------------------------------------------

from unittest.mock import MagicMock, patch  # noqa: E402


class AnalyzePhotoViewTest(TestCase):
    """
    Unit tests for POST /api/listings/analyze-photo/.

    All ML dependencies (cv2, numpy, photo_validator, card_normalizer,
    card_recognizer, grader) are mocked so no GPU/OpenCV installation is
    required to run the test suite.
    """

    URL = '/api/listings/analyze-photo/'

    def setUp(self):
        self.client = APIClient()
        self.user = make_user('photouser')

    def _upload(self, content=b'fake-image-bytes'):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return SimpleUploadedFile('card.jpg', content, content_type='image/jpeg')

    # -- Auth & input validation ------------------------------------------------

    def test_requires_authentication(self):
        resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertEqual(resp.status_code, 401)

    def test_missing_photo_field_returns_400(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.URL, {}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('photo', resp.data)

    @patch('cv2.imdecode', return_value=None)
    @patch('numpy.frombuffer', return_value=MagicMock())
    def test_undecoded_image_returns_400(self, _frombuffer, _imdecode):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('photo', resp.data)

    # -- Photo quality failure --------------------------------------------------

    @patch('api.ml.photo_validator.validate')
    @patch('cv2.imdecode')
    @patch('numpy.frombuffer')
    def test_photo_quality_failure_returns_400(self, _frombuffer, _imdecode, mock_validate):
        _imdecode.return_value = MagicMock()
        mock_validate.return_value = MagicMock(
            ok=False, errors=['image_too_blurry'], warnings=[]
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['error'], 'photo_quality_failure')
        self.assertIn('image_too_blurry', resp.data['details'])

    @patch('api.ml.photo_validator.validate')
    @patch('cv2.imdecode')
    @patch('numpy.frombuffer')
    def test_low_res_failure_returns_400(self, _frombuffer, _imdecode, mock_validate):
        _imdecode.return_value = MagicMock()
        mock_validate.return_value = MagicMock(
            ok=False, errors=['resolution_too_low'], warnings=[]
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('resolution_too_low', resp.data['details'])

    # -- Successful analysis ---------------------------------------------------

    def _patch_happy_path(self):
        """Return a context manager that mocks the full ML pipeline for a NM Charizard."""
        fake_img = MagicMock()
        patches = [
            patch('numpy.frombuffer', return_value=MagicMock()),
            patch('cv2.imdecode', return_value=fake_img),
            patch('api.ml.photo_validator.validate',
                  return_value=MagicMock(ok=True, errors=[], warnings=[])),
            patch('api.ml.card_normalizer.normalize',
                  return_value=(fake_img, True)),
            patch('api.ml.card_recognizer.recognize_top_k',
                  return_value=[
                      MagicMock(card_name='Charizard', set_name='Base Set',
                                card_id='base1-4', confidence=0.91, method='hash_index'),
                      MagicMock(card_name='Charizard', set_name='Fossil',
                                card_id='fossil-5', confidence=0.65, method='hash_index'),
                  ]),
            patch('api.ml.grader.grade',
                  return_value=MagicMock(
                      suggested_condition='NM',
                      confidence=0.74,
                      confidence_breakdown={
                          'MT': 0.09, 'NM': 0.74, 'LP': 0.13,
                          'MP': 0.03, 'HP': 0.01, 'DMG': 0.0,
                      },
                      issues_detected=[],
                      method='heuristic',
                  )),
        ]
        from contextlib import ExitStack
        stack = ExitStack()
        for p in patches:
            stack.enter_context(p)
        return stack

    def test_successful_analysis_returns_200(self):
        self.client.force_authenticate(user=self.user)
        with self._patch_happy_path():
            resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('card_suggestions', resp.data)
        self.assertIn('grading', resp.data)
        self.assertIn('photo_quality', resp.data)

    def test_card_suggestions_contain_top_matches(self):
        self.client.force_authenticate(user=self.user)
        with self._patch_happy_path():
            resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        suggestions = resp.data['card_suggestions']
        self.assertEqual(len(suggestions), 2)
        self.assertEqual(suggestions[0]['card_name'], 'Charizard')
        self.assertEqual(suggestions[0]['card_id'], 'base1-4')
        self.assertAlmostEqual(float(suggestions[0]['confidence']), 0.91)

    def test_grading_includes_psa_grade(self):
        self.client.force_authenticate(user=self.user)
        with self._patch_happy_path():
            resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        grading = resp.data['grading']
        self.assertEqual(grading['suggested_condition'], 'NM')
        self.assertEqual(grading['suggested_psa_grade'], 9)
        self.assertIn('confidence_breakdown', grading)
        self.assertIn('issues_detected', grading)

    def test_photo_quality_ok_flag_true_on_success(self):
        self.client.force_authenticate(user=self.user)
        with self._patch_happy_path():
            resp = self.client.post(self.URL, {'photo': self._upload()}, format='multipart')
        self.assertTrue(resp.data['photo_quality']['ok'])

    # -- Condition → PSA mapping -----------------------------------------------

    @patch('api.ml.grader.grade')
    @patch('api.ml.card_recognizer.recognize_top_k', return_value=[])
    @patch('api.ml.card_normalizer.normalize')
    @patch('api.ml.photo_validator.validate')
    @patch('cv2.imdecode')
    @patch('numpy.frombuffer')
    def test_condition_to_psa_mapping(
        self, _frombuffer, _imdecode, mock_validate, mock_normalize,
        _recognize, mock_grade,
    ):
        _imdecode.return_value = MagicMock()
        mock_validate.return_value = MagicMock(ok=True, errors=[], warnings=[])
        mock_normalize.return_value = (MagicMock(), False)

        expected = {'MT': 10, 'NM': 9, 'LP': 7, 'MP': 5, 'HP': 3, 'DMG': 1}
        for condition, psa in expected.items():
            with self.subTest(condition=condition):
                mock_grade.return_value = MagicMock(
                    suggested_condition=condition,
                    confidence=0.8,
                    confidence_breakdown={},
                    issues_detected=[],
                    method='heuristic',
                )
                self.client.force_authenticate(user=self.user)
                resp = self.client.post(
                    self.URL, {'photo': self._upload()}, format='multipart'
                )
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(
                    resp.data['grading']['suggested_psa_grade'], psa,
                    f'PSA mapping failed for condition {condition}',
                )


# ---------------------------------------------------------------------------
# Phase 5A: Review & Reputation Tests
# ---------------------------------------------------------------------------

class ReputationCalculationTest(TestCase):
    """Unit tests for _compute_reputation weighted average logic."""

    def setUp(self):
        self.seller = make_user('rep_seller')
        self.buyer = make_user('rep_buyer')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller)

    def _make_delivered_order(self):
        o = make_order(self.listing, self.buyer)
        o.status = OrderStatusChoices.DELIVERED
        o.save()
        return o

    def test_no_reviews_returns_none_score(self):
        score, total, recent = _compute_reputation(self.seller)
        self.assertIsNone(score)
        self.assertEqual(total, 0)
        self.assertEqual(recent, 0)

    def test_single_recent_review(self):
        order = self._make_delivered_order()
        Review.objects.create(order=order, reviewer=self.buyer, seller=self.seller, stars=5)
        score, total, recent = _compute_reputation(self.seller)
        self.assertEqual(score, 5.0)
        self.assertEqual(total, 1)
        self.assertEqual(recent, 1)

    def test_weighted_avg_recent_vs_old(self):
        import datetime
        from django.utils import timezone

        # Recent review: 5 stars (weight 2)
        order1 = self._make_delivered_order()
        r1 = Review.objects.create(order=order1, reviewer=self.buyer, seller=self.seller, stars=5)

        # Old review: 1 star (weight 1)
        order2 = self._make_delivered_order()
        r2 = Review.objects.create(order=order2, reviewer=self.buyer, seller=self.seller, stars=1)
        # Force old created_at (91 days ago)
        old_date = timezone.now() - datetime.timedelta(days=91)
        Review.objects.filter(pk=r2.pk).update(created_at=old_date)

        score, total, recent = _compute_reputation(self.seller)
        # weighted: (5*2 + 1*1) / (2+1) = 11/3 ≈ 3.67
        self.assertAlmostEqual(score, round(11 / 3, 2), places=2)
        self.assertEqual(total, 2)
        self.assertEqual(recent, 1)

    def test_multiple_reviews_same_weight(self):
        for stars in [3, 4, 5]:
            o = self._make_delivered_order()
            Review.objects.create(order=o, reviewer=self.buyer, seller=self.seller, stars=stars)
        score, total, recent = _compute_reputation(self.seller)
        # All recent: weighted avg = (3+4+5)/3 = 4.0
        self.assertEqual(score, 4.0)
        self.assertEqual(total, 3)


class ReviewIntegrationTest(TestCase):
    """Integration tests: submit review → reputation updates."""

    def setUp(self):
        self.client = APIClient()
        self.seller = make_user('int_seller')
        self.buyer = make_user('int_buyer')
        card_set = make_set()
        card = make_card(card_set)
        self.listing = make_listing(card, self.seller)
        self.order = make_order(self.listing, self.buyer)

    def _deliver_order(self):
        self.order.status = OrderStatusChoices.DELIVERED
        self.order.save()

    def test_submit_review_creates_reputation(self):
        self._deliver_order()
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/orders/{self.order.pk}/review/'
        resp = self.client.post(url, {'stars': 4, 'comment': 'Great seller!'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['stars'], 4)

        # Verify reputation updated
        rep_url = f'/api/users/{self.seller.pk}/reputation/'
        rep_resp = self.client.get(rep_url)
        self.assertEqual(rep_resp.status_code, 200)
        self.assertEqual(rep_resp.data['score'], 4.0)
        self.assertEqual(rep_resp.data['total_reviews'], 1)

    def test_cannot_review_non_delivered_order(self):
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/orders/{self.order.pk}/review/'
        resp = self.client.post(url, {'stars': 5, 'comment': 'Too soon'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_cannot_review_twice(self):
        self._deliver_order()
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/orders/{self.order.pk}/review/'
        self.client.post(url, {'stars': 5}, format='json')
        resp = self.client.post(url, {'stars': 4}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_seller_cannot_review_own_order(self):
        self._deliver_order()
        self.client.force_authenticate(user=self.seller)
        url = f'/api/orders/{self.order.pk}/review/'
        resp = self.client.post(url, {'stars': 5}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_stars_validation(self):
        self._deliver_order()
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/orders/{self.order.pk}/review/'
        resp = self.client.post(url, {'stars': 6}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_user_reviews_list(self):
        self._deliver_order()
        Review.objects.create(order=self.order, reviewer=self.buyer, seller=self.seller, stars=3)
        url = f'/api/users/{self.seller.pk}/reviews/'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        # Response may be paginated (count/next/previous/results dict) or a plain list
        results = resp.data.get('results', resp.data) if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['stars'], 3)

    def test_seller_public_profile(self):
        self._deliver_order()
        Review.objects.create(order=self.order, reviewer=self.buyer, seller=self.seller, stars=5)
        url = f'/api/sellers/{self.seller.pk}/'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertIn('reputation', resp.data)
        self.assertEqual(resp.data['reputation']['score'], 5.0)
        self.assertIn('active_listings', resp.data)
