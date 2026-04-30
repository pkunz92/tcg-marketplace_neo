"""
Seed the database with realistic demo data for local development.
Includes sets, cards (with real images), seller accounts, and listings.
No network access required.

Usage:
    python manage.py seed_demo_data
    python manage.py seed_demo_data --reset   # wipe listings/users first
"""
import decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import Set_Master, Card_Master, Card_Listing, UserProfile

User = get_user_model()

SETS = [
    {
        'set_code': 'sv1', 'set_name': 'Scarlet & Violet', 'series': 'Scarlet & Violet',
        'total_cards': 198,
        'symbol_url': 'https://images.pokemontcg.io/sv1/symbol.png',
        'logo_url': 'https://images.pokemontcg.io/sv1/logo.png',
    },
    {
        'set_code': 'swsh1', 'set_name': 'Sword & Shield', 'series': 'Sword & Shield',
        'total_cards': 202,
        'symbol_url': 'https://images.pokemontcg.io/swsh1/symbol.png',
        'logo_url': 'https://images.pokemontcg.io/swsh1/logo.png',
    },
    {
        'set_code': 'base1', 'set_name': 'Base Set', 'series': 'Base',
        'total_cards': 102,
        'symbol_url': 'https://images.pokemontcg.io/base1/symbol.png',
        'logo_url': 'https://images.pokemontcg.io/base1/logo.png',
    },
    {
        'set_code': 'cel25', 'set_name': 'Celebrations', 'series': 'Celebrations',
        'total_cards': 25,
        'symbol_url': 'https://images.pokemontcg.io/cel25/symbol.png',
        'logo_url': 'https://images.pokemontcg.io/cel25/logo.png',
    },
    {
        'set_code': 'sv5', 'set_name': 'Temporal Forces', 'series': 'Scarlet & Violet',
        'total_cards': 218,
        'symbol_url': 'https://images.pokemontcg.io/sv5/symbol.png',
        'logo_url': 'https://images.pokemontcg.io/sv5/logo.png',
    },
]

CARDS = [
    # Scarlet & Violet
    {'api_id': 'sv1-6',   'set_code': 'sv1',   'card_name': 'Charizard ex',  'card_number': '6',   'card_rarity': 'Double Rare',   'image_url': 'https://images.pokemontcg.io/sv1/6_hires.png',   'supertype': 'Pokémon', 'hp': '330', 'types': ['Fire']},
    {'api_id': 'sv1-45',  'set_code': 'sv1',   'card_name': 'Pikachu',       'card_number': '45',  'card_rarity': 'Common',         'image_url': 'https://images.pokemontcg.io/sv1/45_hires.png',  'supertype': 'Pokémon', 'hp': '60',  'types': ['Lightning']},
    {'api_id': 'sv1-81',  'set_code': 'sv1',   'card_name': 'Miraidon ex',   'card_number': '81',  'card_rarity': 'Double Rare',   'image_url': 'https://images.pokemontcg.io/sv1/81_hires.png',  'supertype': 'Pokémon', 'hp': '280', 'types': ['Lightning']},
    {'api_id': 'sv1-120', 'set_code': 'sv1',   'card_name': 'Koraidon ex',   'card_number': '120', 'card_rarity': 'Double Rare',   'image_url': 'https://images.pokemontcg.io/sv1/120_hires.png', 'supertype': 'Pokémon', 'hp': '280', 'types': ['Fighting']},
    {'api_id': 'sv1-190', 'set_code': 'sv1',   'card_name': 'Professor Sada\'s Vitality', 'card_number': '190', 'card_rarity': 'Uncommon', 'image_url': 'https://images.pokemontcg.io/sv1/190_hires.png', 'supertype': 'Trainer'},
    # Sword & Shield
    {'api_id': 'swsh1-138', 'set_code': 'swsh1', 'card_name': 'Zacian V',    'card_number': '138', 'card_rarity': 'Ultra Rare',    'image_url': 'https://images.pokemontcg.io/swsh1/138_hires.png', 'supertype': 'Pokémon', 'hp': '220', 'types': ['Metal']},
    {'api_id': 'swsh1-139', 'set_code': 'swsh1', 'card_name': 'Zamazenta V', 'card_number': '139', 'card_rarity': 'Ultra Rare',    'image_url': 'https://images.pokemontcg.io/swsh1/139_hires.png', 'supertype': 'Pokémon', 'hp': '230', 'types': ['Metal']},
    {'api_id': 'swsh1-169', 'set_code': 'swsh1', 'card_name': 'Marnie',      'card_number': '169', 'card_rarity': 'Rare',          'image_url': 'https://images.pokemontcg.io/swsh1/169_hires.png', 'supertype': 'Trainer'},
    {'api_id': 'swsh1-173', 'set_code': 'swsh1', 'card_name': 'Boss\'s Orders', 'card_number': '173', 'card_rarity': 'Rare',       'image_url': 'https://images.pokemontcg.io/swsh1/173_hires.png', 'supertype': 'Trainer'},
    # Base Set
    {'api_id': 'base1-4',  'set_code': 'base1', 'card_name': 'Charizard',    'card_number': '4',   'card_rarity': 'Rare Holo',     'image_url': 'https://images.pokemontcg.io/base1/4_hires.png',  'supertype': 'Pokémon', 'hp': '120', 'types': ['Fire']},
    {'api_id': 'base1-2',  'set_code': 'base1', 'card_name': 'Blastoise',    'card_number': '2',   'card_rarity': 'Rare Holo',     'image_url': 'https://images.pokemontcg.io/base1/2_hires.png',  'supertype': 'Pokémon', 'hp': '100', 'types': ['Water']},
    {'api_id': 'base1-15', 'set_code': 'base1', 'card_name': 'Venusaur',     'card_number': '15',  'card_rarity': 'Rare Holo',     'image_url': 'https://images.pokemontcg.io/base1/15_hires.png', 'supertype': 'Pokémon', 'hp': '100', 'types': ['Grass']},
    {'api_id': 'base1-10', 'set_code': 'base1', 'card_name': 'Mewtwo',       'card_number': '10',  'card_rarity': 'Rare Holo',     'image_url': 'https://images.pokemontcg.io/base1/10_hires.png', 'supertype': 'Pokémon', 'hp': '60',  'types': ['Psychic']},
    {'api_id': 'base1-58', 'set_code': 'base1', 'card_name': 'Pikachu',      'card_number': '58',  'card_rarity': 'Common',        'image_url': 'https://images.pokemontcg.io/base1/58_hires.png', 'supertype': 'Pokémon', 'hp': '40',  'types': ['Lightning']},
    # Celebrations
    {'api_id': 'cel25-1',  'set_code': 'cel25', 'card_name': 'Pikachu',      'card_number': '1',   'card_rarity': 'Promo',         'image_url': 'https://images.pokemontcg.io/cel25/1_hires.png',  'supertype': 'Pokémon', 'hp': '60',  'types': ['Lightning']},
    {'api_id': 'cel25-4',  'set_code': 'cel25', 'card_name': 'Charizard',    'card_number': '4',   'card_rarity': 'Classic Collection', 'image_url': 'https://images.pokemontcg.io/cel25/4_hires.png', 'supertype': 'Pokémon', 'hp': '120', 'types': ['Fire']},
    {'api_id': 'cel25-25', 'set_code': 'cel25', 'card_name': 'Mew',          'card_number': '25',  'card_rarity': 'Promo',         'image_url': 'https://images.pokemontcg.io/cel25/25_hires.png', 'supertype': 'Pokémon', 'hp': '60',  'types': ['Psychic']},
    # Temporal Forces
    {'api_id': 'sv5-59',  'set_code': 'sv5',   'card_name': 'Iron Thorns ex', 'card_number': '59', 'card_rarity': 'Double Rare',  'image_url': 'https://images.pokemontcg.io/sv5/59_hires.png',  'supertype': 'Pokémon', 'hp': '240', 'types': ['Lightning']},
    {'api_id': 'sv5-182', 'set_code': 'sv5',   'card_name': 'Archaludon ex', 'card_number': '182', 'card_rarity': 'Double Rare',  'image_url': 'https://images.pokemontcg.io/sv5/182_hires.png', 'supertype': 'Pokémon', 'hp': '280', 'types': ['Dragon']},
]

SELLERS = [
    ('trainer_red',     'red@example.com',   'Trainer Red',    'Pallet Town'),
    ('misty_cascade',   'misty@example.com', 'Misty Cascade',  'Cerulean City'),
    ('brock_pewter',    'brock@example.com', 'Brock Pewter',   'Pewter City'),
    ('gary_oak',        'gary@example.com',  'Gary Oak',       'Pallet Town'),
]

# (card_api_id, seller_index, price_chf, condition, quantity, is_graded)
LISTINGS = [
    ('sv1-6',     0, '45.00',  'NM', 1, 'RAW'),
    ('sv1-6',     1, '39.99',  'LP', 2, 'RAW'),
    ('sv1-6',     3, '52.00',  'NM', 1, 'PSA'),
    ('sv1-45',    0,  '2.50',  'NM', 5, 'RAW'),
    ('sv1-81',    2, '28.00',  'NM', 1, 'RAW'),
    ('sv1-120',   1, '25.00',  'NM', 1, 'RAW'),
    ('sv1-190',   3,  '1.50',  'NM', 8, 'RAW'),
    ('swsh1-138', 0, '18.50',  'NM', 3, 'RAW'),
    ('swsh1-139', 2, '12.00',  'MP', 1, 'RAW'),
    ('swsh1-169', 1,  '8.00',  'NM', 4, 'RAW'),
    ('swsh1-173', 3,  '6.50',  'NM', 2, 'RAW'),
    ('base1-4',   0, '320.00', 'LP', 1, 'RAW'),
    ('base1-4',   3, '850.00', 'NM', 1, 'PSA'),
    ('base1-2',   2,  '95.00', 'NM', 1, 'RAW'),
    ('base1-15',  1,  '80.00', 'NM', 1, 'RAW'),
    ('base1-10',  0, '145.00', 'NM', 1, 'RAW'),
    ('base1-58',  2,   '4.00', 'NM', 3, 'RAW'),
    ('cel25-1',   0,   '5.00', 'NM', 3, 'RAW'),
    ('cel25-4',   1,  '12.00', 'NM', 2, 'RAW'),
    ('cel25-25',  3,   '8.00', 'NM', 1, 'RAW'),
    ('sv5-59',    2,  '15.00', 'NM', 1, 'RAW'),
    ('sv5-182',   0,  '22.00', 'NM', 2, 'RAW'),
]


class Command(BaseCommand):
    help = 'Seed database with demo cards, sellers, and listings for local development.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Delete existing listings and demo users first.')

    def handle(self, *args, **options):
        if options['reset']:
            Card_Listing.objects.filter(seller__username__in=[s[0] for s in SELLERS]).delete()
            User.objects.filter(username__in=[s[0] for s in SELLERS]).delete()
            self.stdout.write('  Cleared existing demo data.')

        # Sets
        self.stdout.write('Creating sets...')
        set_objs = {}
        for s in SETS:
            obj, created = Set_Master.objects.get_or_create(
                set_code=s['set_code'], language='en', defaults=s
            )
            set_objs[s['set_code']] = obj
            self.stdout.write(f'  {"+" if created else "·"} {obj.set_name}')

        # Cards
        self.stdout.write('Creating cards...')
        card_objs = {}
        for c in CARDS:
            set_code = c.pop('set_code')
            obj, created = Card_Master.objects.get_or_create(
                api_id=c['api_id'],
                defaults={**c, 'set': set_objs[set_code]}
            )
            card_objs[obj.api_id] = obj
            self.stdout.write(f'  {"+" if created else "·"} {obj.card_name} ({set_code})')

        # Sellers
        self.stdout.write('Creating seller accounts...')
        seller_objs = []
        for username, email, name, city in SELLERS:
            u, created = User.objects.get_or_create(username=username, defaults={'email': email})
            if created:
                u.set_password('demo1234')
                u.save()
            UserProfile.objects.get_or_create(user=u, defaults={
                'shipping_name': name,
                'shipping_address_line1': '1 Main Street',
                'shipping_city': city,
                'shipping_postal_code': '8001',
                'shipping_country': 'CH',
            })
            seller_objs.append(u)
            self.stdout.write(f'  {"+" if created else "·"} {username}')

        # Listings
        self.stdout.write('Creating listings...')
        created_count = 0
        for card_id, seller_idx, price, cond, qty, grading in LISTINGS:
            card = card_objs.get(card_id)
            if not card:
                continue
            _, created = Card_Listing.objects.get_or_create(
                card_master=card,
                seller=seller_objs[seller_idx],
                condition=cond,
                is_graded=grading,
                defaults={'price_chf': decimal.Decimal(price), 'quantity': qty, 'is_available': True}
            )
            if created:
                created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! {Card_Master.objects.count()} cards, '
            f'{Card_Listing.objects.count()} listings, '
            f'{User.objects.filter(username__in=[s[0] for s in SELLERS]).count()} sellers.\n'
            f'Login with any seller (password: demo1234) or create a new buyer account.'
        ))
