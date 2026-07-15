from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0260_basemaplayer'),
    ]

    operations = [
        migrations.AddField(
            model_name='constant',
            name='is_map_active',
            field=models.BooleanField(default=True, verbose_name='Газрын зурагт харуулах'),
        ),
    ]
