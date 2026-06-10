# point төслөөс хуулагдаж ирэхэд үлдсэн орфан хүснэгт core_measurement_old.
# Энэ хүснэгтэд geoname-д ямар ч Django модель харгалзахгүй (тиймээс 0249-д
# ороогүй) боловч core_constant руу хийсэн хуучин FK нь хэвээр үлдэж, Constant
# (workspace, network г.м.) устгахад саад болж байсан. Idempotent байдлаар
# (DROP TABLE IF EXISTS ... CASCADE) устгана — хүснэгт байгаа эсэхээс үл хамаарна.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0249_delete_chatlog_remove_message_conversation_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS core_measurement_old CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
