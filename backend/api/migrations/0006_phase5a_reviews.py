from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_phase3_photo_pipeline'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add DELIVERED status to Order (CharField — just extend max_length if needed; statuses stored as strings)
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('COMPLETED', 'Completed'),
                    ('CANCELLED', 'Cancelled'),
                    ('DELIVERED', 'Delivered'),
                ],
                default='PENDING',
                max_length=10,
            ),
        ),
        # Create reviews table
        migrations.CreateModel(
            name='Review',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stars', models.PositiveSmallIntegerField(help_text='Rating 1-5')),
                ('comment', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='review',
                    to='api.order',
                )),
                ('reviewer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reviews_given',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('seller', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reviews_received',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['seller', 'created_at'], name='api_review_seller_created_idx'),
                ],
            },
        ),
    ]
