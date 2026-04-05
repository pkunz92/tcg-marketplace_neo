"""
Phase 5D – Performance: pg_trgm extension + GIN trigram indexes.

These indexes power sub-100 ms fuzzy search on card_master.card_name and
card_listing / card_master text columns under PostgreSQL.

SQLite fallback: the RunSQL operations are wrapped with a database-engine
check so the migration is a no-op on SQLite (dev/CI without Postgres).
"""
from django.db import migrations, connection


def _is_pg():
    return connection.vendor == 'postgresql'


def enable_trgm(apps, schema_editor):
    if not _is_pg():
        return
    schema_editor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")


def disable_trgm(apps, schema_editor):
    # Never drop pg_trgm in reverse – other extensions / indexes may depend on it.
    pass


def create_gin_indexes(apps, schema_editor):
    if not _is_pg():
        return
    schema_editor.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_master_name_trgm
        ON api_card_master USING GIN (card_name gin_trgm_ops);
        """
    )
    schema_editor.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_master_secondary_id_trgm
        ON api_card_master USING GIN (secondary_id gin_trgm_ops);
        """
    )
    # Card_Listing itself has no free-text title column; search hits card_master
    # through the FK. Add a composite btree index to speed up the join + filter.
    schema_editor.execute(
        """
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_listing_available_master
        ON api_card_listing (card_master_id, is_available)
        WHERE is_available = true;
        """
    )


def drop_gin_indexes(apps, schema_editor):
    if not _is_pg():
        return
    schema_editor.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_card_master_name_trgm;")
    schema_editor.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_card_master_secondary_id_trgm;")
    schema_editor.execute("DROP INDEX CONCURRENTLY IF EXISTS idx_card_listing_available_master;")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_price_sold_snapshot'),
    ]

    # Use RunPython so we can gate on DB vendor at runtime.
    operations = [
        migrations.RunPython(enable_trgm, reverse_code=disable_trgm, atomic=False),
        migrations.RunPython(create_gin_indexes, reverse_code=drop_gin_indexes, atomic=False),
    ]
