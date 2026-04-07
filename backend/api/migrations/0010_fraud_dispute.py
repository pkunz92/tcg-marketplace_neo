"""
Phase 5E – Fraud Detection & Dispute Resolution.

Adds:
  - api_dispute   (disputes tied to orders)
  - api_userflag  (fraud signal flags per user)
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_phase5d_perf_trgm_indexes'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Dispute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(
                    max_length=20,
                    choices=[
                        ('not_received', 'Item Not Received'),
                        ('not_as_described', 'Item Not As Described'),
                        ('unauthorized', 'Unauthorized Payment'),
                        ('other', 'Other'),
                    ],
                )),
                ('description', models.TextField()),
                ('status', models.CharField(
                    max_length=10,
                    choices=[
                        ('open', 'Open'),
                        ('resolved', 'Resolved'),
                        ('closed', 'Closed'),
                    ],
                    default='open',
                )),
                ('resolution', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='disputes',
                    to='api.order',
                )),
                ('opened_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='disputes_opened',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='dispute',
            index=models.Index(fields=['status', 'created_at'], name='api_dispute_status_idx'),
        ),
        migrations.AddIndex(
            model_name='dispute',
            index=models.Index(fields=['order'], name='api_dispute_order_idx'),
        ),
        migrations.CreateModel(
            name='UserFlag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(
                    max_length=30,
                    choices=[
                        ('excess_cancellations', 'Excessive Cancellations as Seller'),
                        ('payment_velocity', 'High Payment Velocity'),
                        ('stripe_dispute', 'Stripe Chargeback'),
                    ],
                )),
                ('detail', models.TextField(blank=True, default='')),
                ('reviewed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='flags',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='userflag',
            index=models.Index(fields=['user', 'reason'], name='api_userflag_user_reason_idx'),
        ),
        migrations.AddIndex(
            model_name='userflag',
            index=models.Index(fields=['reviewed', 'created_at'], name='api_userflag_reviewed_idx'),
        ),
    ]
