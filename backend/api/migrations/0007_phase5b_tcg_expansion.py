from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_phase5a_reviews'),
    ]

    operations = [
        # Add tcg_type to Set_Master
        migrations.AddField(
            model_name='set_master',
            name='tcg_type',
            field=models.CharField(
                choices=[
                    ('pokemon', 'Pokémon'),
                    ('mtg', 'Magic: The Gathering'),
                    ('yugioh', 'Yu-Gi-Oh!'),
                    ('sports', 'Sports Cards'),
                ],
                default='pokemon',
                db_index=True,
                max_length=10,
            ),
        ),
        # Add tcg_type to Card_Master
        migrations.AddField(
            model_name='card_master',
            name='tcg_type',
            field=models.CharField(
                choices=[
                    ('pokemon', 'Pokémon'),
                    ('mtg', 'Magic: The Gathering'),
                    ('yugioh', 'Yu-Gi-Oh!'),
                    ('sports', 'Sports Cards'),
                ],
                default='pokemon',
                db_index=True,
                max_length=10,
            ),
        ),
    ]
