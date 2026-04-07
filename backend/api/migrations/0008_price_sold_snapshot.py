from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_phase5b_tcg_expansion'),
    ]

    operations = [
        migrations.CreateModel(
            name='PriceSoldSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sold_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('sold_at', models.DateTimeField(auto_now_add=True)),
                ('condition', models.CharField(
                    choices=[('MT', 'Mint'), ('NM', 'Near Mint'), ('LP', 'Lightly Played'),
                             ('MP', 'Moderately Played'), ('HP', 'Heavily Played'), ('DMG', 'Damaged')],
                    max_length=4,
                )),
                ('tcg_type', models.CharField(
                    choices=[('pokemon', 'Pokémon'), ('mtg', 'Magic: The Gathering'),
                             ('yugioh', 'Yu-Gi-Oh!'), ('sports', 'Sports Cards')],
                    db_index=True,
                    default='pokemon',
                    max_length=10,
                )),
                ('card', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sold_snapshots',
                    to='api.card_master',
                )),
                ('listing', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='sold_snapshots',
                    to='api.card_listing',
                )),
            ],
            options={
                'ordering': ['-sold_at'],
                'indexes': [
                    models.Index(fields=['card', 'sold_at'], name='api_pricesoldsnapshot_card_sold_at_idx'),
                    models.Index(fields=['tcg_type', 'sold_at'], name='api_pricesoldsnapshot_tcg_type_idx'),
                    models.Index(fields=['condition', 'sold_at'], name='api_pricesoldsnapshot_condition_idx'),
                ],
            },
        ),
    ]
