from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_watchlistitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='tracking_number',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('COMPLETED', 'Completed'),
                    ('SHIPPED', 'Shipped'),
                    ('CANCELLED', 'Cancelled'),
                    ('DELIVERED', 'Delivered'),
                ],
                default='PENDING',
                max_length=10,
            ),
        ),
    ]
