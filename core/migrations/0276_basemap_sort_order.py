# -*- coding: utf-8 -*-
"""Суурь/нэмэлт давхаргын ЭРЭМБИЙГ цэгцлэв.

Эрэмбэ нь газрын зурагт давхаргын байрлалыг (zIndex) тодорхойлдог болсон тул
төрөл (base/overlay) тус бүрд 1‑ээс эхэлж давхардалгүй дугаарлана (0 болон
давхардсан утгууд байсныг арилгав).
"""
from django.db import migrations


def forwards(apps, schema_editor):
	BaseMapLayer = apps.get_model('core', 'BaseMapLayer')
	for ltype in ('base', 'overlay'):
		qs = BaseMapLayer.objects.filter(layer_type=ltype).order_by('sort_order', 'id')
		for i, lyr in enumerate(qs, start=1):
			if lyr.sort_order != i:
				lyr.sort_order = i
				lyr.save(update_fields=['sort_order'])


class Migration(migrations.Migration):

	dependencies = [('core', '0275_person_unify')]

	operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
