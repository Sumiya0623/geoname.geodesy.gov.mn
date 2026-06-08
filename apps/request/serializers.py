from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType

from core.models import (
	Constant, AdminUnit, LegalOrder,
	GeoName, RequestName, NameOption, NameContact, Photo, Attach,
)


# ----------------------------------------------------------------------
# Тогтоол, шийдвэрийн сан (LegalOrder)
# ----------------------------------------------------------------------

class LegalTypeSerializer(serializers.ModelSerializer):
	"""LEGAL_TYPES төрөл (карт).

	code: 0 = нэгж сонгохгүй, 1 = зөвхөн аймаг, 2 = аймаг + сум.
	order_count — тухайн төрөлд бүртгэгдсэн тогтоолын тоо.
	"""
	order_count = serializers.IntegerField(read_only=True, default=0)

	class Meta:
		model = Constant
		fields = ['id', 'name', 'key', 'code', 'label', 'color', 'desc', 'order_count']


class UnitDropSerializer(serializers.ModelSerializer):
	level = serializers.IntegerField(source='level_id', read_only=True)
	parent = serializers.IntegerField(source='parent_id', read_only=True)
	parent_unit = serializers.CharField(source='parent.unit', read_only=True, default=None)

	class Meta:
		model = AdminUnit
		fields = ['id', 'unit', 'parent', 'parent_unit', 'level']


class ConstantDropSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		fields = ['id', 'name', 'code', 'color']


class LegalOrderSerializer(serializers.ModelSerializer):
	# org = LEGAL_TYPES (карт/ангилал, нэгж кодтой)
	org = LegalTypeSerializer(read_only=True)
	org_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='LEGAL_TYPES'),
		source='org', write_only=True, required=False, allow_null=True,
	)
	# type = ORDER_TYPES (баримтын төрөл — Тогтоол/Захирамж/Зөвлөмж/Акт)
	type = ConstantDropSerializer(read_only=True)
	type_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='ORDER_TYPES'),
		source='type', write_only=True, required=False, allow_null=True,
	)
	unit = UnitDropSerializer(read_only=True)
	unit_id = serializers.PrimaryKeyRelatedField(
		queryset=AdminUnit.objects.all(),
		source='unit', write_only=True, required=False, allow_null=True,
	)
	user_name = serializers.CharField(source='user.full_name', read_only=True)

	class Meta:
		model = LegalOrder
		fields = [
			'id', 'name', 'org', 'org_id', 'type', 'type_id', 'unit', 'unit_id',
			'description', 'order_date', 'order_number', 'document', 'signer',
			'user_name', 'created_date', 'views',
		]
		read_only_fields = ['user_name', 'created_date', 'views']


# ----------------------------------------------------------------------
# Иргэний нэрийн хүсэлт (RequestName + NameOption + NameContact)
# ----------------------------------------------------------------------

class GeoNameDropSerializer(serializers.ModelSerializer):
	class Meta:
		model = GeoName
		fields = ['id', 'name', 'number']


class RequestStatusSerializer(serializers.ModelSerializer):
	"""REQUEST_STATUS төрөл (карт). request_count — тухайн төлөвт буй хүсэлтийн тоо."""
	request_count = serializers.IntegerField(read_only=True, default=0)

	class Meta:
		model = Constant
		fields = ['id', 'name', 'key', 'code', 'label', 'color', 'desc', 'request_count']


class NameContactSerializer(serializers.ModelSerializer):
	"""Хүсэлтэд хамаарах холбоо барих хүн (RequestName.namecontacts)."""
	id = serializers.IntegerField(required=False)

	class Meta:
		model = NameContact
		fields = ['id', 'person', 'first_name', 'last_name', 'register',
				  'address', 'phone', 'email']


class NameOptionSerializer(serializers.ModelSerializer):
	"""Санал болгож буй нэр — Санал1 (name), Санал2 (name2), Эх сурвалж (desc)."""
	id = serializers.IntegerField(required=False)

	class Meta:
		model = NameOption
		fields = ['id', 'name', 'name2', 'desc']


class RequestNameSerializer(serializers.ModelSerializer):
	# Read — nested
	name = GeoNameDropSerializer(read_only=True)
	age = ConstantDropSerializer(read_only=True)
	type = ConstantDropSerializer(read_only=True)
	status = ConstantDropSerializer(read_only=True)
	purpose = ConstantDropSerializer(many=True, read_only=True)
	options = NameOptionSerializer(source='option', many=True, required=False)
	contacts = NameContactSerializer(source='namecontacts', many=True, required=False)
	# Хэрэглэгчийн мэдээлэл (засахгүй)
	user_name = serializers.CharField(source='user.full_name', read_only=True)
	user_register = serializers.CharField(source='user.register', read_only=True, default=None)
	user_phone = serializers.CharField(source='user.phone', read_only=True, default=None)
	user_email = serializers.CharField(source='user.email', read_only=True, default=None)
	# Хавсаргасан баримтын тоо (Photo=зураг, Attach=бусад файл)
	photo_count = serializers.SerializerMethodField()
	attach_count = serializers.SerializerMethodField()
	# Write — id‑аар
	name_id = serializers.PrimaryKeyRelatedField(
		queryset=GeoName.objects.all(), source='name',
		write_only=True, required=False, allow_null=True)
	age_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_AGES'), source='age',
		write_only=True, required=False, allow_null=True)
	type_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_TYPES'), source='type',
		write_only=True, required=False, allow_null=True)
	status_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='REQUEST_STATUS'), source='status',
		write_only=True)
	purpose_ids = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='REQUEST_PURPOSES'), source='purpose',
		many=True, write_only=True, required=False)

	class Meta:
		model = RequestName
		fields = [
			'id', 'name', 'name_id', 'age', 'age_id', 'type', 'type_id',
			'status', 'status_id', 'purpose', 'purpose_ids', 'options', 'contacts',
			'description', 'lat', 'lon',
			'user_name', 'user_register', 'user_phone', 'user_email',
			'photo_count', 'attach_count', 'created_date', 'views',
		]
		read_only_fields = [
			'user_name', 'user_register', 'user_phone', 'user_email',
			'photo_count', 'attach_count', 'created_date', 'views',
		]

	def _content_type(self, obj):
		return ContentType.objects.get_for_model(obj.__class__)

	def get_photo_count(self, obj):
		return Photo.objects.filter(content_type=self._content_type(obj), object_id=obj.id).count()

	def get_attach_count(self, obj):
		return Attach.objects.filter(content_type=self._content_type(obj), object_id=obj.id).count()

	# -- санал болгож буй нэр (option) — Санал1/Санал2/Эх сурвалж --
	def _save_options(self, request_obj, options_data):
		old = list(request_obj.option.all())
		request_obj.option.clear()
		for o in old:
			if not o.requestoptions.exists():
				o.delete()
		for opt_data in options_data:
			opt_data.pop('id', None)
			opt = NameOption.objects.create(**opt_data)
			request_obj.option.add(opt)

	# -- холбоо барих хүмүүс (RequestName.namecontacts) --
	def _save_contacts(self, request_obj, contacts_data):
		request_obj.namecontacts.all().delete()
		user = getattr(self.context.get('request'), 'user', None)
		for c in contacts_data:
			c.pop('id', None)
			NameContact.objects.create(
				request=request_obj,
				requested_by=user if (user and user.is_authenticated) else None,
				**c,
			)

	def create(self, validated_data):
		options_data = validated_data.pop('option', None)
		contacts_data = validated_data.pop('namecontacts', None)
		purposes = validated_data.pop('purpose', [])
		req = RequestName.objects.create(**validated_data)
		if purposes:
			req.purpose.set(purposes)
		if options_data:
			self._save_options(req, options_data)
		if contacts_data:
			self._save_contacts(req, contacts_data)
		return req

	def update(self, instance, validated_data):
		options_data = validated_data.pop('option', None)
		contacts_data = validated_data.pop('namecontacts', None)
		purposes = validated_data.pop('purpose', None)
		for attr, value in validated_data.items():
			setattr(instance, attr, value)
		instance.save()
		if purposes is not None:
			instance.purpose.set(purposes)
		if options_data is not None:
			self._save_options(instance, options_data)
		if contacts_data is not None:
			self._save_contacts(instance, contacts_data)
		return instance
