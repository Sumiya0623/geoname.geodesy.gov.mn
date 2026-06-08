from django.db import migrations

BATCH = 1000

def forwards(apps, schema_editor):
    # Түүхэн загварууд
    StyleRule = apps.get_model("core", "StyleRule")
    Filter = apps.get_model("core", "Filter")
    RuleFilter = apps.get_model("core", "RuleFilter")

    # Хуучин M2M хүснэгтийн нэр (ихэнхдээ app_model_m2mfield)
    # Жишээ: core_stylerule_filters
    old_table = "core_stylerule_filters"

    # DB-с шууд уншина (түүхэн through model байхгүй тул raw SQL илүү найдвартай)
    with schema_editor.connection.cursor() as cur:
        cur.execute(f"SELECT stylerule_id, filter_id FROM {old_table}")
        rows = cur.fetchall()

    # position-ыг дүрэм бүрт 0..n гэж өгнө
    from collections import defaultdict
    pos_map = defaultdict(int)

    buffer = []
    for sr_id, f_id in rows:
        p = pos_map[sr_id]
        pos_map[sr_id] += 1
        buffer.append(RuleFilter(stylerule_id=sr_id, filter_id=f_id, position=p))
        if len(buffer) >= BATCH:
            RuleFilter.objects.bulk_create(buffer, ignore_conflicts=True)
            buffer.clear()
    if buffer:
        RuleFilter.objects.bulk_create(buffer, ignore_conflicts=True)

def backwards(apps, schema_editor):
    # Буцаах шаардлагагүй: шинэ through -> хуучин руу буцаахгүй
    pass

class Migration(migrations.Migration):

    dependencies = [
        ("core", "0141_rulefilter_alter_feature_options_and_more"),  # ДООШ нь тааруул
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]