# -*- coding: utf-8 -*-
"""Хүний мэдээллийг НЭГ газар (RemoteUser) хадгалах болгож нэгтгэв.

  1. NameContact → RequestNameContact (нэрийг тодруулав)
  2. RequestNameContact, CouncilMember, ProjectMember дээрх овог, нэр, регистр,
     утас, имэйл зэрэг ДАВХАРДСАН талбаруудыг устгаж, зөвхөн person (RemoteUser)
     холбоос үлдээв. Хуучин мөрүүдийн мэдээллийг регистрээр нь RemoteUser рүү
     шилжүүлж (олдохгүй бол шинээр бүртгэж) холбоно.
"""
from django.db import migrations, models
import django.db.models.deletion


def _ensure_user(User, register, last, first, phone, email):
	"""Регистрээр хэрэглэгч олох, олдохгүй бол үүсгэх (дутуу талбарыг нөхнө)."""
	register = (register or '').strip()
	if not register:
		return None
	u = User.objects.filter(register=register).first()
	if u is None:
		u = User.objects.create(
			register=register, username=register,
			last_name=(last or '')[:100], first_name=(first or '')[:100],
			email=(email or ''), phone=(phone or None),
			is_citizen=True, is_active=True, password='!',
		)
		return u
	changed = []
	for f, v in (('last_name', last), ('first_name', first),
	             ('email', email), ('phone', phone)):
		if v and not getattr(u, f, None):
			setattr(u, f, v[:100] if f in ('last_name', 'first_name') else v)
			changed.append(f)
	if changed:
		u.save(update_fields=changed)
	return u


def forwards(apps, schema_editor):
	User = apps.get_model('core', 'RemoteUser')

	# Холбоо барих хүн — person(char) нь зөвхөн нэр байсан
	Contact = apps.get_model('core', 'RequestNameContact')
	for c in Contact.objects.all():
		first = c.first_name or c.old_person or ''
		u = _ensure_user(User, c.register, c.last_name, first, c.phone, c.email)
		if u:
			c.person = u
			c.save(update_fields=['person'])

	# Зөвлөлийн гишүүн / төслийн бүрэлдэхүүн — person хоосон мөрүүдийг нөхнө
	for model, has_phone in (('CouncilMember', False), ('ProjectMember', True)):
		M = apps.get_model('core', model)
		for m in M.objects.filter(person__isnull=True):
			parts = (m.full_name or '').split()
			last = parts[0] if len(parts) > 1 else ''
			first = ' '.join(parts[1:]) if len(parts) > 1 else (parts[0] if parts else '')
			u = _ensure_user(User, m.register, last, first,
			                 getattr(m, 'phone', None) if has_phone else None, None)
			if u:
				m.person = u
				m.save(update_fields=['person'])


def backwards(apps, schema_editor):
	# Буцаах шаардлагагүй — person холбоос үлдэнэ
	pass


class Migration(migrations.Migration):

	dependencies = [
		('core', '0274_recount_created_date_recount_last_view_and_more'),
	]

	operations = [
		migrations.RenameModel(old_name='NameContact', new_name='RequestNameContact'),
		# person (char) → түр нэр, дараа нь FK нэмнэ
		migrations.RenameField(model_name='requestnamecontact', old_name='person', new_name='old_person'),
		migrations.AddField(
			model_name='requestnamecontact', name='person',
			field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
				related_name='namecontacts', to='core.remoteuser', verbose_name='Хүн'),
		),
		migrations.RunPython(forwards, backwards),
		# Давхардсан талбаруудыг устгана
		migrations.RemoveField(model_name='requestnamecontact', name='old_person'),
		migrations.RemoveField(model_name='requestnamecontact', name='first_name'),
		migrations.RemoveField(model_name='requestnamecontact', name='last_name'),
		migrations.RemoveField(model_name='requestnamecontact', name='register'),
		migrations.RemoveField(model_name='requestnamecontact', name='phone'),
		migrations.RemoveField(model_name='requestnamecontact', name='email'),
		migrations.RemoveField(model_name='requestnamecontact', name='photo'),
		migrations.RemoveField(model_name='requestnamecontact', name='requested_by'),
		migrations.RemoveField(model_name='councilmember', name='full_name'),
		migrations.RemoveField(model_name='councilmember', name='register'),
		migrations.RemoveField(model_name='projectmember', name='full_name'),
		migrations.RemoveField(model_name='projectmember', name='register'),
		migrations.RemoveField(model_name='projectmember', name='phone'),
		migrations.AlterField(
			model_name='councilmember', name='person',
			field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
				related_name='council_memberships', to='core.remoteuser', verbose_name='Хүн'),
		),
		migrations.AlterField(
			model_name='projectmember', name='person',
			field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
				related_name='projects', to='core.remoteuser', verbose_name='Хүн'),
		),
	]
