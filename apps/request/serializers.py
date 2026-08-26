import json

from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from django.contrib.gis.geos import GEOSGeometry

from core.serializers import (ProfileDropDownSerializer, PersonSerializerMixin,
                              AdminUnitDropDownSerializer)
from core.models import (
	Constant, AdminUnit, LegalOrder,
	GeoName, RequestName, NameOption, RequestNameContact, Photo, Attach,
	Project, ReCount, ReCountMap, Council, CouncilMember,
)


class GeoNameRefSerializer(serializers.ModelSerializer):
	# Ангиллын 3 түвшин (Үндсэн → Дэд → Ангилал) — тооллогын хүснэгтэд баганаар
	type_l1 = serializers.SerializerMethodField()
	type_l2 = serializers.SerializerMethodField()
	type_l3 = serializers.SerializerMethodField()
	# Геометрийн төрөл + GeoJSON — "Байршил" багана / dialog‑ийн зураг
	geom_type = serializers.SerializerMethodField()
	geom = serializers.SerializerMethodField()

	class Meta:
		model = GeoName
		fields = ['id', 'name', 'number', 'type_l1', 'type_l2', 'type_l3',
		          'geom_type', 'geom', 'is_border']

	def get_geom_type(self, obj):
		return obj.geoloc.geom_type if obj.geoloc else None

	def get_geom(self, obj):
		if not obj.geoloc:
			return None
		import json
		return json.loads(obj.geoloc.geojson)

	@staticmethod
	def _chain(obj):
		out, cur, seen = [], obj.type, set()
		while cur and cur.id not in seen:
			seen.add(cur.id)
			out.append(cur.name)
			cur = cur.parent
		out.reverse()
		return out

	def get_type_l1(self, obj):
		ch = self._chain(obj)
		return ch[0] if len(ch) > 0 else None

	def get_type_l2(self, obj):
		ch = self._chain(obj)
		return ch[1] if len(ch) > 1 else None

	def get_type_l3(self, obj):
		ch = self._chain(obj)
		return ch[2] if len(ch) > 2 else None


# ----------------------------------------------------------------------
# Тогтоол, шийдвэрийн сан (LegalOrder)
# ----------------------------------------------------------------------

class LegalTypeSerializer(serializers.ModelSerializer):
	"""LEGAL_LEVELS түвшин (карт) — LegalOrder.govlevel «Дээд тогтоол».

	code: 0 = нэгж сонгохгүй, 1 = зөвхөн аймаг, 2 = аймаг + сум.
	order_count — тухайн түвшинд бүртгэгдсэн тогтоолын тоо.
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
	# govlevel = LEGAL_LEVELS (карт/түвшин, нэгж кодтой) — «Дээд тогтоол»
	govlevel = LegalTypeSerializer(read_only=True)
	govlevel_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='LEGAL_LEVELS'),
		source='govlevel', write_only=True, required=False, allow_null=True,
	)
	# org = LEGAL_ORGS (баримтыг гаргасан байгууллага)
	org = ConstantDropSerializer(read_only=True)
	org_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='LEGAL_ORGS'),
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
	# Тухайн шийдвэрт холбогдсон газар зүйн нэрийн тоо (queryset дээр annotate)
	names_count = serializers.IntegerField(read_only=True, default=0)
	# ?projects=<id> үед — тухайн ТӨСЛИЙН тодруулалтад (ReCount) хамаарах
	# нэрсээс хэд нь энэ баримтад холбогдсон бэ (төслийн хуудсанд харуулна)
	project_names_count = serializers.IntegerField(read_only=True, default=0)
	# Жагсаалтад ХАРУУЛАХ байгууллага. org (LEGAL_ORGS) нь зөвхөн аймаг/сум
	# түвшний шийдвэрт бөглөгддөг тул дээд түвшний (ж: УИХ) баримт дээр хоосон
	# үлдэж «-» болж харагддаг байв — тэр тохиолдолд түвшний нэрийг өгнө.
	org_display = serializers.SerializerMethodField()

	def get_org_display(self, obj):
		if obj.org_id and obj.org.name:
			return obj.org.name
		if obj.govlevel_id and obj.govlevel.name:
			return obj.govlevel.name
		return ''

	def to_internal_value(self, data):
		"""multipart‑аар хоосон мөр ирсэн FK‑г (org_id="") ЦЭВЭРЛЭХ гэж үзнэ.

		Формоос «—» сонгоход хоосон утга илгээгддэг; DRF‑ийн default зан
		байдал нь «Invalid pk ""» гэж алдаа өгдөг тул None болгож хөрвүүлнэ.
		"""
		empty = ('', 'null', 'undefined')
		keys = ('govlevel_id', 'org_id', 'type_id', 'unit_id')
		if hasattr(data, 'copy') and any(
				k in data and str(data.get(k)).strip() in empty for k in keys):
			data = data.copy()
			for k in keys:
				if k in data and str(data.get(k)).strip() in empty:
					data[k] = None
		return super().to_internal_value(data)

	class Meta:
		model = LegalOrder
		fields = [
			'id', 'name', 'govlevel', 'govlevel_id', 'org', 'org_id',
			'org_display',
			'type', 'type_id', 'unit', 'unit_id',
			'description', 'order_date', 'order_number', 'document', 'signer',
			'user_name', 'created_date', 'views', 'names_count',
			'project_names_count',
		]
		read_only_fields = ['user_name', 'created_date', 'views', 'names_count',
		                    'project_names_count', 'org_display']


# ----------------------------------------------------------------------
# Иргэний нэрийн хүсэлт (RequestName + NameOption + RequestNameContact)
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


class RequestNameContactSerializer(PersonSerializerMixin, serializers.ModelSerializer):
	"""Хүсэлтийн холбоо барих хүн. Овог, нэр, регистр, утас, имэйл нь RemoteUser
	(person) дээр — энд зөвхөн хаяг (address) хадгалагдана."""
	id = serializers.IntegerField(required=False)

	class Meta:
		model = RequestNameContact
		fields = ['id', 'person', 'person_profile', 'full_name',
				  'first_name', 'last_name', 'register', 'phone', 'email',
				  'address']


class NameOptionSerializer(serializers.ModelSerializer):
	"""Санал болгож буй нэр — Санал1 (name), Санал2 (name2), Эх сурвалж (desc)."""
	id = serializers.IntegerField(required=False)

	class Meta:
		model = NameOption
		fields = ['id', 'name', 'name2', 'desc']


class GeoJSONField(serializers.Field):
	"""GeoJSON (dict/мөр) ↔ GEOSGeometry. Буруу утга ирвэл ValidationError."""

	def to_representation(self, value):
		if not value:
			return None
		try:
			return json.loads(value.geojson)
		except Exception:
			return None

	def to_internal_value(self, data):
		if data in (None, '', 'null'):
			return None
		try:
			raw = data if isinstance(data, str) else json.dumps(data)
			geom = GEOSGeometry(raw)
			if geom.srid is None:
				geom.srid = 4326
			return geom
		except Exception as exc:
			raise serializers.ValidationError(
				f'Геометр буруу байна: {exc}')


class RequestNameSerializer(serializers.ModelSerializer):
	# Read — nested
	name = GeoNameDropSerializer(read_only=True)
	age = ConstantDropSerializer(read_only=True)
	type = ConstantDropSerializer(read_only=True)
	status = ConstantDropSerializer(read_only=True)
	purpose = ConstantDropSerializer(many=True, read_only=True)
	options = NameOptionSerializer(source='option', many=True, required=False)
	contacts = RequestNameContactSerializer(source='namecontacts', many=True, required=False)
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
	# Газрын зураг дээр зурсан дүрс — GeoJSON (dict эсвэл мөр) хэлбэрээр
	# ирж/буцна. Шугам/талбай ангилалд цэгээр бус өөрийнх нь дүрсээр хадгална.
	geoloc = GeoJSONField(required=False, allow_null=True)

	class Meta:
		model = RequestName
		fields = [
			'id', 'name', 'name_id', 'age', 'age_id', 'type', 'type_id',
			'status', 'status_id', 'purpose', 'purpose_ids', 'options', 'contacts',
			'description', 'lat', 'lon', 'geoloc',
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
		for c in contacts_data:
			c.pop('id', None)
			RequestNameContact.objects.create(request=request_obj, **c)

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


# ----------------------------------------------------------------------
# Дахин тооллого (ReCount) — суурин судалгааны таб
# ----------------------------------------------------------------------

class ReCountSerializer(serializers.ModelSerializer):
	step = ConstantDropSerializer(read_only=True)
	step_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='RECOUNT_STEPS'),
		source='step', write_only=True, required=False, allow_null=True,
	)
	# Төлөв — ОЛОН (M2M). байршил зөрүүтэй + нэр алдаатай зэрэг зэрэг байж болно.
	statuses = ConstantDropSerializer(many=True, read_only=True)
	status_ids = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='RECOUNT_STATUS'),
		source='statuses', many=True, write_only=True, required=False,
	)
	# Ангилал — draft (GeoName‑гүй) тодруулалтын төрөл
	type = ConstantDropSerializer(read_only=True)
	type_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_TYPES'),
		source='type', write_only=True, required=False, allow_null=True,
	)
	# GeoName — заавал биш. Байхгүй бол null (frontend харуулахгүй).
	name = GeoNameRefSerializer(read_only=True)
	name_id = serializers.PrimaryKeyRelatedField(
		queryset=GeoName.objects.all(),
		source='name', write_only=True, required=False, allow_null=True,
	)
	project_id = serializers.PrimaryKeyRelatedField(
		queryset=Project.objects.all(),
		source='project', write_only=True, required=False, allow_null=True,
	)
	# Төслийн нэр/дугаар (тодруулалт дээр дарахад popup‑д харуулна)
	project = serializers.SerializerMethodField()
	loc = serializers.SerializerMethodField()
	# Ангиллын 3 түвшин — GeoName‑тэй бол түүний, эс бөгөөс тодруулалтын
	# ӨӨРИЙН type‑ээс (draft). Хүснэгтэд шууд харуулна.
	type_l1 = serializers.SerializerMethodField()
	type_l2 = serializers.SerializerMethodField()
	type_l3 = serializers.SerializerMethodField()
	# Үүсгэсэн хэрэглэгч (ProfileAvatar‑д зориулж бүтэн профайл) + огноо
	user = ProfileDropDownSerializer(read_only=True)
	# Хилийн цэсийн харьяа нэгжүүд (олон түвшин, олон нэгж)
	borderunits = AdminUnitDropDownSerializer(source='borderunit', many=True, read_only=True)
	borderunit_ids = serializers.PrimaryKeyRelatedField(
		queryset=AdminUnit.objects.all(), source='borderunit',
		many=True, write_only=True, required=False)

	def _type_chain(self, obj):
		"""Язгуураас навч хүртэлх ангиллын нэрсийн жагсаалт."""
		t = (obj.name.type if obj.name_id and obj.name.type_id else None) or obj.type
		chain, seen = [], set()
		while t and t.id not in seen:
			seen.add(t.id)
			chain.append(t.name)
			t = t.parent
		chain.reverse()
		return chain

	def get_type_l1(self, obj):
		c = self._type_chain(obj)
		return c[0] if len(c) > 0 else None

	def get_type_l2(self, obj):
		c = self._type_chain(obj)
		return c[1] if len(c) > 1 else None

	def get_type_l3(self, obj):
		c = self._type_chain(obj)
		return c[2] if len(c) > 2 else None
	# Хээрийн зургууд (Photo — generic FK)
	photos = serializers.SerializerMethodField()

	def get_photos(self, obj):
		from django.contrib.contenttypes.models import ContentType
		from core.models import Photo, ReCount as _RC
		ct = ContentType.objects.get_for_model(_RC)
		req = self.context.get('request')
		out = []
		for p in Photo.objects.filter(content_type=ct, object_id=obj.id):
			try:
				url = p.file.url if p.file else None
			except Exception:
				url = None
			out.append({'id': p.id, 'desc': p.desc,
			            'url': req.build_absolute_uri(url) if (req and url) else url})
		return out

	def get_project(self, obj):
		p = obj.project
		return {'id': p.id, 'name': p.name, 'dugaar': p.dugaar} if p else None

	class Meta:
		model = ReCount
		fields = [
			'id', 'project', 'project_id', 'step', 'step_id',
			'statuses', 'status_ids',
			'name', 'name_id', 'draft', 'loc', 'type', 'type_id', 'photos',
			'user', 'created_date', 'type_l1', 'type_l2', 'type_l3',
			# Хилийн цэс — батлагдсан нэргүй (draft) тодруулалтын өөрийн шинж
			# + аль нэгжүүдийн зааг дээр байгаа нь
			'is_border', 'borderunits', 'borderunit_ids',
		]

	def get_loc(self, obj):
		if obj.loc:
			import json
			return json.loads(obj.loc.geojson)
		return None


class ReCountMapSerializer(serializers.ModelSerializer):
	sources = ConstantDropSerializer(many=True, read_only=True)

	class Meta:
		model = ReCountMap
		fields = ['id', 'names', 'file', 'sources']


# ----------------------------------------------------------------------
# Газар зүйн нэрийн зөвлөл (Council) + гишүүд (CouncilMember) — temporal архив
# ----------------------------------------------------------------------

class LegalOrderMiniSerializer(serializers.ModelSerializer):
	class Meta:
		model = LegalOrder
		fields = ['id', 'name', 'order_number', 'order_date']


class CouncilMemberSerializer(PersonSerializerMixin, serializers.ModelSerializer):
	position = ConstantDropSerializer(read_only=True)
	# «Оролцоо» нь MEMBER_TYPES‑ээс сонгогддог; хуучин бүртгэлүүд
	# COUNCIL_POSITIONS‑ыг ашигласан тул хоёуланг нь зөвшөөрнө.
	position_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(
			key__in=['MEMBER_TYPES', 'COUNCIL_POSITIONS']),
		source='position', write_only=True, required=False, allow_null=True)
	appoint_doc = LegalOrderMiniSerializer(read_only=True)
	appoint_doc_id = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='appoint_doc', write_only=True)
	release_doc = LegalOrderMiniSerializer(read_only=True)
	release_doc_id = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='release_doc',
		write_only=True, required=False, allow_null=True)
	is_active = serializers.SerializerMethodField()

	class Meta:
		model = CouncilMember
		fields = [
			'id', 'council', 'person', 'person_profile', 'full_name',
			'first_name', 'last_name', 'register', 'phone', 'email',
			'position', 'position_id', 'org_title', 'start_date', 'end_date',
			'appoint_doc', 'appoint_doc_id', 'release_doc', 'release_doc_id',
			'is_active', 'created_date',
		]
		read_only_fields = ['created_date']

	def get_is_active(self, obj):
		return obj.end_date is None


class CouncilSerializer(serializers.ModelSerializer):
	kind = ConstantDropSerializer(read_only=True)
	kind_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='COUNCIL_KINDS'),
		source='kind', write_only=True, required=False, allow_null=True)
	status = ConstantDropSerializer(read_only=True)
	status_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='COUNCIL_STATUS'),
		source='status', write_only=True, required=False, allow_null=True)
	unit = UnitDropSerializer(read_only=True)
	unit_id = serializers.PrimaryKeyRelatedField(
		queryset=AdminUnit.objects.all(), source='unit',
		write_only=True, required=False, allow_null=True)
	established_doc = LegalOrderMiniSerializer(read_only=True)
	established_doc_id = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='established_doc',
		write_only=True, required=False, allow_null=True)
	dissolved_doc = LegalOrderMiniSerializer(read_only=True)
	dissolved_doc_id = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='dissolved_doc',
		write_only=True, required=False, allow_null=True)
	member_count = serializers.SerializerMethodField()

	class Meta:
		model = Council
		fields = [
			'id', 'name', 'kind', 'kind_id', 'unit', 'unit_id',
			'status', 'status_id', 'established_doc', 'established_doc_id',
			'dissolved_doc', 'dissolved_doc_id', 'established_date',
			'dissolved_date', 'member_count', 'created_date',
		]
		read_only_fields = ['created_date']

	def get_member_count(self, obj):
		return obj.members.filter(end_date__isnull=True).count()
