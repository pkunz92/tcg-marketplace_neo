"""
Downloads the pokemontcg.io card data from their GitHub repo.
This provides full card details (HP, attacks, types, abilities, artist, rarity, etc.)
without hitting the rate-limited API.

NOTE: The static GitHub JSON does NOT include pricing data.
Use fetch_pokemontcg_prices.py for that.
"""

import json
import os
import time
import requests
from pathlib import Path
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Downloads pokemontcg.io card data from GitHub for offline enrichment.'

    GITHUB_API_BASE = 'https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents'
    RAW_BASE = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-download all files even if they already exist.',
        )

    def handle(self, *args, **options):
        force = options['force']
        base_dir = Path(settings.BASE_DIR) / 'api' / 'data' / 'pokemontcg'
        cards_dir = base_dir / 'cards' / 'en'
        sets_dir = base_dir / 'sets'

        os.makedirs(cards_dir, exist_ok=True)
        os.makedirs(sets_dir, exist_ok=True)

        # 1. Download sets/en.json
        self.stdout.write(self.style.NOTICE('--- Downloading sets/en.json ---'))
        sets_path = sets_dir / 'en.json'
        if force or not sets_path.exists():
            self._download_file(f'{self.RAW_BASE}/sets/en.json', sets_path)
        else:
            self.stdout.write(f'  Skipping {sets_path.name} (already exists, use --force to re-download)')

        # 2. List all card files from GitHub API
        self.stdout.write(self.style.NOTICE('\n--- Fetching card file list from GitHub API ---'))
        file_list = self._get_file_list(f'{self.GITHUB_API_BASE}/cards/en')

        if not file_list:
            self.stdout.write(self.style.ERROR('Failed to get file list from GitHub API.'))
            return

        self.stdout.write(f'Found {len(file_list)} card set files to download.')

        # 3. Download each card file
        downloaded = 0
        skipped = 0
        failed = 0

        for file_info in file_list:
            name = file_info['name']
            if not name.endswith('.json'):
                continue

            dest_path = cards_dir / name
            if not force and dest_path.exists():
                skipped += 1
                continue

            download_url = file_info.get('download_url', f'{self.RAW_BASE}/cards/en/{name}')
            if self._download_file(download_url, dest_path):
                downloaded += 1
            else:
                failed += 1

            # Respect GitHub API rate limits
            time.sleep(0.5)

        self.stdout.write(self.style.SUCCESS(
            f'\n--- Download Complete ---\n'
            f'Downloaded: {downloaded}\n'
            f'Skipped (already exist): {skipped}\n'
            f'Failed: {failed}\n'
            f'Data saved to: {base_dir}'
        ))

    def _get_file_list(self, api_url):
        """Fetch directory listing from GitHub API."""
        try:
            resp = requests.get(api_url, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error fetching file list: {e}'))
            return []

    def _download_file(self, url, dest_path):
        """Download a single file from URL to local path."""
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            with open(dest_path, 'w', encoding='utf-8') as f:
                f.write(resp.text)
            self.stdout.write(f'  Downloaded: {dest_path.name}')
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  Failed to download {dest_path.name}: {e}'))
            return False
