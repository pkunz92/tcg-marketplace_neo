from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_fix_indexes_and_constraints'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='push_token',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
