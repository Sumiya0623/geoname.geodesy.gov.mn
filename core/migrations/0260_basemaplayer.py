from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0259_printmap'),
    ]

    operations = [
        migrations.CreateModel(
            name='BaseMapLayer',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=64, unique=True, verbose_name='Түлхүүр')),
                ('label', models.CharField(max_length=200, verbose_name='Харагдах нэр')),
                ('layer_type', models.CharField(choices=[('base', 'Суурь давхарга'), ('overlay', 'Нэмэлт давхарга')], default='base', max_length=16, verbose_name='Төрөл')),
                ('source_type', models.CharField(choices=[('xyz', 'XYZ (гадаад тайл)'), ('osm', 'OpenStreetMap'), ('wms', 'WMS (GeoServer/GWC)'), ('wmts', 'WMTS (GeoServer/GWC кэш)')], default='wms', max_length=16, verbose_name='Эх сурвалж')),
                ('workspace', models.CharField(blank=True, default='', max_length=100, verbose_name='Workspace')),
                ('gs_layer', models.CharField(blank=True, default='', max_length=200, verbose_name='GeoServer давхарга')),
                ('url', models.TextField(blank=True, default='', verbose_name='URL')),
                ('params', models.JSONField(blank=True, default=dict, null=True, verbose_name='Нэмэлт параметр')),
                ('color', models.CharField(blank=True, default='', max_length=32, verbose_name='Өнгө/дүрс')),
                ('is_enabled', models.BooleanField(default=True, verbose_name='Идэвхтэй (нээх/хаах)')),
                ('sort_order', models.PositiveIntegerField(default=0, verbose_name='Эрэмбэ')),
                ('created_date', models.DateTimeField(auto_now_add=True)),
                ('modified_date', models.DateTimeField(auto_now=True)),
                ('roles', models.ManyToManyField(blank=True, related_name='basemap_layers', to='core.constant', verbose_name='Харах эрх (role)')),
            ],
            options={
                'verbose_name': 'Суурь/нэмэлт давхарга',
                'verbose_name_plural': 'Газрын зургийн давхаргууд',
                'ordering': ['layer_type', 'sort_order', 'id'],
            },
        ),
    ]
