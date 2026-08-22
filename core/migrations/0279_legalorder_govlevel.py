# LegalOrder.org (LEGAL_TYPES) → govlevel (LEGAL_LEVELS «Дээд тогтоол»),
# шинэ org нь LEGAL_ORGS («Байгууллага»).  Хуучин Constant‑ийн түлхүүрийг
# (LEGAL_TYPES) LEGAL_LEVELS болгож нэрлэнэ — өгөгдөл өөрчлөгдөхгүй.
from django.db import migrations, models
import django.db.models.deletion


def types_to_levels(apps, schema_editor):
	Constant = apps.get_model('core', 'Constant')
	Constant.objects.filter(key='LEGAL_TYPES').update(key='LEGAL_LEVELS')


def levels_to_types(apps, schema_editor):
	Constant = apps.get_model('core', 'Constant')
	Constant.objects.filter(key='LEGAL_LEVELS').update(key='LEGAL_TYPES')


class Migration(migrations.Migration):

	dependencies = [
		('core', '0278_borderunit'),
	]

	operations = [
		migrations.RenameField(
			model_name='legalorder',
			old_name='org',
			new_name='govlevel',
		),
		migrations.AlterField(
			model_name='legalorder',
			name='govlevel',
			field=models.ForeignKey(
				blank=True, null=True,
				limit_choices_to={'key': 'LEGAL_LEVELS'},
				on_delete=django.db.models.deletion.CASCADE,
				related_name='orgs', to='core.constant',
				verbose_name='Дээд тогтоол'),
		),
		# Postgres нь баганыг нэрлэхэд index/constraint‑ийн НЭРИЙГ дагуулж
		# өөрчилдөггүй тул хуучин org_id‑гийн нэрс үлдэнэ. Шинэ org багана
		# нэмэхэд ЯГ ижил нэр үүсэх гэж мөргөлддөг — иймд гараар нэрлэнэ.
		migrations.RunSQL(
			sql=[
				"ALTER INDEX IF EXISTS core_legalorder_org_id_6690bb61 "
				"RENAME TO core_legalorder_govlevel_id_6690bb61;",
				"""DO $$ BEGIN
					IF EXISTS (SELECT 1 FROM pg_constraint
					           WHERE conname = 'core_legalorder_org_id_6690bb61_fk_core_constant_id'
					             AND conrelid = 'core_legalorder'::regclass) THEN
						ALTER TABLE core_legalorder RENAME CONSTRAINT
							core_legalorder_org_id_6690bb61_fk_core_constant_id TO
							core_legalorder_govlevel_id_6690bb61_fk_core_constant_id;
					END IF;
				END $$;""",
			],
			reverse_sql=[
				"""DO $$ BEGIN
					IF EXISTS (SELECT 1 FROM pg_constraint
					           WHERE conname = 'core_legalorder_govlevel_id_6690bb61_fk_core_constant_id'
					             AND conrelid = 'core_legalorder'::regclass) THEN
						ALTER TABLE core_legalorder RENAME CONSTRAINT
							core_legalorder_govlevel_id_6690bb61_fk_core_constant_id TO
							core_legalorder_org_id_6690bb61_fk_core_constant_id;
					END IF;
				END $$;""",
				"ALTER INDEX IF EXISTS core_legalorder_govlevel_id_6690bb61 "
				"RENAME TO core_legalorder_org_id_6690bb61;",
			],
		),
		migrations.AddField(
			model_name='legalorder',
			name='org',
			field=models.ForeignKey(
				blank=True, null=True,
				limit_choices_to={'key': 'LEGAL_ORGS'},
				on_delete=django.db.models.deletion.CASCADE,
				related_name='legalorgs', to='core.constant',
				verbose_name='Төрөл'),
		),
		migrations.RunPython(types_to_levels, levels_to_types),
	]
