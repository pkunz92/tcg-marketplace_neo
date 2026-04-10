"""
Management command that seeds the database with a minimal card catalogue
for E2E tests. Does NOT require network access or local JSON files.

Usage:
    python manage.py seed_e2e_data
"""
from django.core.management.base import BaseCommand
from api.models import Set_Master, Card_Master


_CARDS = [
    {"api_id": "e2e-base1-4",  "name": "Charizard",   "number": "4",  "rarity": "Rare Holo"},
    {"api_id": "e2e-base1-7",  "name": "Squirtle",    "number": "7",  "rarity": "Common"},
    {"api_id": "e2e-base1-15", "name": "Venusaur",    "number": "15", "rarity": "Rare Holo"},
    {"api_id": "e2e-base1-26", "name": "Pikachu",     "number": "26", "rarity": "Common"},
    {"api_id": "e2e-base1-58", "name": "Mewtwo",      "number": "58", "rarity": "Rare Holo"},
]


class Command(BaseCommand):
    help = "Seed a minimal card catalogue for E2E tests (no network required)."

    def handle(self, *args, **options):
        set_obj, created = Set_Master.objects.get_or_create(
            set_code="e2e-base1",
            language="en",
            defaults={
                "set_name": "E2E Base Set",
                "series": "Base",
                "ptcgo_code": "BS",
                "total_cards": len(_CARDS),
            },
        )
        action = "Created" if created else "Found existing"
        self.stdout.write(f"{action} set: {set_obj.set_name}")

        for card in _CARDS:
            obj, created = Card_Master.objects.get_or_create(
                api_id=card["api_id"],
                defaults={
                    "set": set_obj,
                    "card_name": card["name"],
                    "card_number": card["number"],
                    "card_rarity": card["rarity"],
                    "image_url": "",
                    "secondary_id": f"BS {card['number']}/{len(_CARDS)} {card['name']}",
                },
            )
            action = "Created" if created else "Found existing"
            self.stdout.write(f"  {action} card: {obj.card_name} ({obj.api_id})")

        self.stdout.write(self.style.SUCCESS(
            f"E2E seed complete — {len(_CARDS)} cards available."
        ))
