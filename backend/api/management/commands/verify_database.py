"""
Comprehensive verification of the Pokemon TCG database.
Outputs a detailed gap report showing what's complete and what's missing.
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Q
from api.models import Card_Master, Set_Master, CardTranslation, SetTranslation, CardPrice


class Command(BaseCommand):
    help = 'Verifies database completeness and outputs a gap report.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('=' * 60))
        self.stdout.write(self.style.NOTICE('  POKEMON TCG DATABASE VERIFICATION REPORT'))
        self.stdout.write(self.style.NOTICE('=' * 60))

        self._report_overview()
        self._report_rarity()
        self._report_detail_fields()
        self._report_images()
        self._report_set_completeness()
        self._report_translations()
        self._report_prices()
        self._report_sets_metadata()

        self.stdout.write(self.style.NOTICE('\n' + '=' * 60))
        self.stdout.write(self.style.NOTICE('  END OF REPORT'))
        self.stdout.write(self.style.NOTICE('=' * 60))

    def _report_overview(self):
        self.stdout.write(self.style.NOTICE('\n--- 1. Overview ---'))
        total_cards = Card_Master.objects.count()
        total_sets = Set_Master.objects.count()
        total_translations = CardTranslation.objects.count()
        total_prices = CardPrice.objects.count()

        self.stdout.write(f'Total cards: {total_cards}')
        self.stdout.write(f'Total sets: {total_sets}')
        self.stdout.write(f'Total card translations: {total_translations}')
        self.stdout.write(f'Total price entries: {total_prices}')

        # Cards by supertype
        supertypes = (
            Card_Master.objects
            .exclude(supertype='')
            .values('supertype')
            .annotate(count=Count('api_id'))
            .order_by('-count')
        )
        if supertypes:
            self.stdout.write('\nCards by supertype:')
            for st in supertypes:
                self.stdout.write(f"  {st['supertype']}: {st['count']}")

        no_supertype = Card_Master.objects.filter(
            Q(supertype='') | Q(supertype__isnull=True)
        ).count()
        if no_supertype:
            self.stdout.write(self.style.WARNING(
                f'  Missing supertype: {no_supertype} cards'
            ))

    def _report_rarity(self):
        self.stdout.write(self.style.NOTICE('\n--- 2. Rarity Coverage ---'))

        unknown_rarity = Card_Master.objects.filter(
            Q(card_rarity='Unknown') | Q(card_rarity='') | Q(card_rarity__isnull=True)
        ).count()
        total = Card_Master.objects.count()
        known = total - unknown_rarity

        self.stdout.write(f'Cards with known rarity: {known}/{total} ({known/total*100:.1f}%)' if total else 'No cards')
        if unknown_rarity:
            self.stdout.write(self.style.WARNING(
                f'Cards with Unknown/empty rarity: {unknown_rarity}'
            ))

            # Show which sets have the most unknown rarity cards
            worst_sets = (
                Card_Master.objects
                .filter(Q(card_rarity='Unknown') | Q(card_rarity='') | Q(card_rarity__isnull=True))
                .values('set__set_code', 'set__set_name')
                .annotate(count=Count('api_id'))
                .order_by('-count')[:10]
            )
            self.stdout.write('  Worst sets (top 10):')
            for s in worst_sets:
                self.stdout.write(
                    f"    {s['set__set_code'] or '???'} ({s['set__set_name'] or '???'}): "
                    f"{s['count']} cards"
                )

    def _report_detail_fields(self):
        self.stdout.write(self.style.NOTICE('\n--- 3. Detail Field Coverage ---'))

        total = Card_Master.objects.count()
        if not total:
            return

        # Only Pokemon cards should have HP/attacks/types
        pokemon_cards = Card_Master.objects.filter(supertype='Pokémon').count()

        fields_to_check = [
            ('supertype', Q(supertype='') | Q(supertype__isnull=True), total),
            ('hp (Pokémon only)', Q(hp='') | Q(hp__isnull=True), pokemon_cards),
            ('types (Pokémon only)', Q(types=[]) | Q(types__isnull=True), pokemon_cards),
            ('attacks (Pokémon only)', Q(attacks=[]) | Q(attacks__isnull=True), pokemon_cards),
            ('artist', Q(artist='') | Q(artist__isnull=True), total),
            ('legalities', Q(legalities={}) | Q(legalities__isnull=True), total),
        ]

        for field_name, empty_q, denominator in fields_to_check:
            if 'Pokémon only' in field_name and pokemon_cards == 0:
                self.stdout.write(f'  {field_name}: N/A (no Pokémon cards enriched yet)')
                continue

            if 'Pokémon only' in field_name:
                missing = Card_Master.objects.filter(supertype='Pokémon').filter(empty_q).count()
            else:
                missing = Card_Master.objects.filter(empty_q).count()

            present = denominator - missing
            pct = (present / denominator * 100) if denominator else 0
            status = self.style.SUCCESS if pct > 90 else self.style.WARNING
            self.stdout.write(status(
                f'  {field_name}: {present}/{denominator} ({pct:.1f}%)'
            ))

    def _report_images(self):
        self.stdout.write(self.style.NOTICE('\n--- 4. Image Coverage ---'))

        total = Card_Master.objects.count()
        missing_images = Card_Master.objects.filter(
            Q(image_url='') | Q(image_url__isnull=True)
        ).count()
        has_images = total - missing_images

        self.stdout.write(f'Cards with images: {has_images}/{total}')
        if missing_images:
            self.stdout.write(self.style.WARNING(
                f'Cards missing images: {missing_images}'
            ))

    def _report_set_completeness(self):
        self.stdout.write(self.style.NOTICE('\n--- 5. Set Completeness ---'))

        sets_with_counts = (
            Set_Master.objects
            .annotate(actual_cards=Count('cards'))
            .order_by('set_code')
        )

        incomplete_sets = []
        for s in sets_with_counts:
            if s.total_cards > 0 and s.actual_cards < s.total_cards:
                gap = s.total_cards - s.actual_cards
                incomplete_sets.append((s.set_code, s.set_name, s.actual_cards, s.total_cards, gap))

        if incomplete_sets:
            self.stdout.write(self.style.WARNING(
                f'Incomplete sets: {len(incomplete_sets)}'
            ))
            # Show top 20 worst gaps
            incomplete_sets.sort(key=lambda x: x[4], reverse=True)
            for code, name, actual, total, gap in incomplete_sets[:20]:
                self.stdout.write(
                    f'  {code} ({name}): {actual}/{total} cards (missing {gap})'
                )
        else:
            self.stdout.write(self.style.SUCCESS('All sets are complete!'))

    def _report_translations(self):
        self.stdout.write(self.style.NOTICE('\n--- 6. Translation Coverage ---'))

        total_cards = Card_Master.objects.count()
        total_sets = Set_Master.objects.count()

        lang_stats = (
            CardTranslation.objects
            .values('language')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        if lang_stats:
            self.stdout.write('Card translations:')
            for ls in lang_stats:
                pct = (ls['count'] / total_cards * 100) if total_cards else 0
                self.stdout.write(f"  {ls['language']}: {ls['count']} ({pct:.1f}%)")
        else:
            self.stdout.write(self.style.WARNING('No card translations found.'))

        set_lang_stats = (
            SetTranslation.objects
            .values('language')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        if set_lang_stats:
            self.stdout.write('\nSet translations:')
            for ls in set_lang_stats:
                pct = (ls['count'] / total_sets * 100) if total_sets else 0
                self.stdout.write(f"  {ls['language']}: {ls['count']} ({pct:.1f}%)")

    def _report_prices(self):
        self.stdout.write(self.style.NOTICE('\n--- 7. Price Coverage ---'))

        total_cards = Card_Master.objects.count()
        cards_with_prices = CardPrice.objects.values('card_master').distinct().count()
        pct = (cards_with_prices / total_cards * 100) if total_cards else 0

        self.stdout.write(f'Cards with price data: {cards_with_prices}/{total_cards} ({pct:.1f}%)')

        by_source = (
            CardPrice.objects
            .values('source')
            .annotate(
                entries=Count('id'),
                cards=Count('card_master', distinct=True),
            )
            .order_by('source')
        )

        for bp in by_source:
            self.stdout.write(
                f"  {bp['source']}: {bp['entries']} entries covering {bp['cards']} cards"
            )

    def _report_sets_metadata(self):
        self.stdout.write(self.style.NOTICE('\n--- 8. Set Metadata Quality ---'))

        total = Set_Master.objects.count()
        if not total:
            return

        no_date = Set_Master.objects.filter(release_date__isnull=True).count()
        no_series = Set_Master.objects.filter(
            Q(series='') | Q(series__isnull=True)
        ).count()
        no_logo = Set_Master.objects.filter(
            Q(logo_url='') | Q(logo_url__isnull=True)
        ).count()

        self.stdout.write(f'Sets with release_date: {total - no_date}/{total}')
        self.stdout.write(f'Sets with series: {total - no_series}/{total}')
        self.stdout.write(f'Sets with logo_url: {total - no_logo}/{total}')
