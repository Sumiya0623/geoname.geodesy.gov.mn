import django.db.models.deletion
import portal.utils.functions
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """Хэвлэлийн эх (PrintMap). report.measurements drift-ийг ЗОРИУДААР хөндөхгүй."""

    dependencies = [
        ('core', '0258_geoname_height_geoname_other_geonamesource'),
    ]

    operations = [
        migrations.CreateModel(
            name='PrintMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_date', models.DateTimeField(auto_now_add=True, help_text='Энэхүү бичлэг үүссэн огноо, цаг.', verbose_name='Бүртгэсэн')),
                ('modified_date', models.DateTimeField(auto_now=True, help_text='Сүүлд шинэтгэл хийгдсэн огноо, цаг.', verbose_name='Шинэчилсэн')),
                ('last_view', models.DateTimeField(auto_now_add=True, help_text='Хэрэглэгч хамгийн сүүлд үзсэн огноо, цаг.', verbose_name='Сүүлд үзсэн')),
                ('views', models.IntegerField(default=1, help_text='Энэ бичлэг рүү хандсан нийт тоо.', verbose_name='Хандалт')),
                ('is_border', models.BooleanField(default=False, verbose_name='Хилийн цэс')),
                ('name_count', models.IntegerField(default=0, verbose_name='Багтсан нэрийн тоо')),
                ('title', models.CharField(blank=True, max_length=500, null=True, verbose_name='Зургийн нэр (авто)')),
                ('scale', models.IntegerField(blank=True, null=True, verbose_name='Масштаб')),
                ('file', models.FileField(blank=True, null=True, upload_to=portal.utils.functions.file_upload_path, verbose_name='Хэвлэлийн эх (PDF)')),
                ('units', models.ManyToManyField(blank=True, related_name='printmaps', to='core.adminunit', verbose_name='Сонгогдсон сумд')),
                ('user', models.ForeignKey(blank=True, help_text='Энэхүү бичлэгийг үүсгэсэн хэрэглэгч.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='%(class)ss', to=settings.AUTH_USER_MODEL, verbose_name='Бүртгэсэн')),
            ],
            options={
                'verbose_name': 'Хэвлэлийн эх',
                'verbose_name_plural': 'Хэвлэлийн эх',
            },
        ),
    ]
