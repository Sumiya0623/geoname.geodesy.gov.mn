import json
from collections import OrderedDict
from rest_framework import serializers
from django.contrib.gis.geos import Point, GEOSGeometry
from django.contrib.contenttypes.models import ContentType

from django.db.models import Count, Q

from core.serializers import ProfileDropDownSerializer
from core.models import (Constant, GeoName, LegalOrder, Photo, Attach, PrintMap,
                         Nomek, AdminUnit, Project, ProjectArea, ProjectMember)


class PrintMapSerializer(serializers.ModelSerializer):
    """Хэвлэлийн эх (PDF) жагсаалт — он, аймаг/сум, нэрийн тоо, хэвлэсэн хэрэглэгч."""
    file_url = serializers.SerializerMethodField()
    units_text = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    # Хэрэглэгчийн бүтэн мэдээлэл — frontend дээр ProfileAvatar‑аар харуулна
    user = ProfileDropDownSerializer(read_only=True)
    year = serializers.SerializerMethodField()

    class Meta:
        model = PrintMap
        fields = ['id', 'title', 'units_text', 'name_count', 'is_border',
                  'scale', 'file_url', 'user', 'user_name', 'created_date',
                  'year']

    def get_file_url(self, obj):
        try:
            if not obj.file:
                return None
            url = obj.file.url  # харьцангуй: /api/media/...
            request = self.context.get('request')
            # backend (8002) дээр media байгаа тул ABSOLUTE болгоно (frontend 3002 биш)
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None

    def get_units_text(self, obj):
        us = list(obj.units.all())
        if not us:
            return ''
        aimag = us[0].parent.unit if us[0].parent_id else ''
        sums = ', '.join(u.unit for u in us)
        return f'{aimag} — {sums}' if aimag else sums

    def get_user_name(self, obj):
        u = obj.user
        return (getattr(u, 'full_name', None) or getattr(u, 'username', None)
                or str(u)) if u else ''

    def get_year(self, obj):
        return obj.created_date.year if obj.created_date else None


def _file_url(f):
    try:
        return f.url if f else None
    except Exception:
        return None


class GeoNameDetailSerializer(serializers.ModelSerializer):
    """Дэлгэрэнгүй (retrieve) — ангилал(level1/2/3), солбицол, нэгж, нэрлэвэр,
    зураг, баримт материал, хүсэлт, эрх зүйн баримт бичиг."""
    type_path = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lon = serializers.SerializerMethodField()
    geom_type = serializers.SerializerMethodField()
    units = serializers.SerializerMethodField()
    nomeks = serializers.SerializerMethodField()
    orders = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    attaches = serializers.SerializerMethodField()
    requests = serializers.SerializerMethodField()

    class Meta:
        model = GeoName
        fields = ['id', 'name', 'number', 'is_approved', 'created_date',
                  'lat', 'lon', 'geom_type', 'type_path', 'units', 'nomeks',
                  'orders', 'photos', 'attaches', 'requests']

    def get_type_path(self, obj):
        chain, c, seen = [], obj.type, set()
        while c and c.id not in seen:
            seen.add(c.id)
            chain.append({'id': c.id, 'name': c.name, 'code': c.code})
            c = c.parent
        chain.reverse()
        return chain

    def get_lat(self, obj):
        return obj.geoloc.y if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

    def get_lon(self, obj):
        return obj.geoloc.x if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

    def get_geom_type(self, obj):
        return obj.geoloc.geom_type if obj.geoloc else None

    def get_units(self, obj):
        return [{'id': u.id, 'name': u.unit} for u in obj.unit.all()]

    def get_nomeks(self, obj):
        # Нэрийн байрлалтай ДАВХЦАХ нэрлэвэрүүд, масштабаар нь бүлэглэв.
        if not obj.geoloc:
            return []
        # Зөвхөн M1:25000 / M1:50000 / M1:100000 масштаб (25→50→100 дараалал)
        qs = (Nomek.objects
              .filter(geom__intersects=obj.geoloc,
                      scale__name__in=['M1:25000', 'M1:50000', 'M1:100000'])
              .select_related('scale')
              .order_by('scale__id', 'nomek'))
        groups = OrderedDict()
        for n in qs:
            key = n.scale_id or 0
            if key not in groups:
                groups[key] = {
                    'scale_id': n.scale_id,
                    'scale': n.scale.name if n.scale else 'Тодорхойгүй',
                    'nomeks': [],
                }
            groups[key]['nomeks'].append({'id': n.id, 'code': n.nomek})
        return list(groups.values())

    def get_orders(self, obj):
        return [{
            'id': o.id, 'name': o.name,
            'order_number': getattr(o, 'order_number', None),
            'order_date': getattr(o, 'order_date', None),
        } for o in obj.legalorders.all()]

    def _generic_qs(self, model, obj):
        ct = ContentType.objects.get_for_model(GeoName)
        return model.objects.filter(content_type=ct, object_id=obj.id)

    def get_photos(self, obj):
        return [{'id': p.id, 'url': _file_url(p.file), 'desc': p.desc}
                for p in self._generic_qs(Photo, obj)]

    def get_attaches(self, obj):
        return [{
            'id': a.id, 'url': _file_url(a.attach),
            'name': (a.attach.name.split('/')[-1] if a.attach else None),
        } for a in self._generic_qs(Attach, obj)]

    def get_requests(self, obj):
        return [{
            'id': r.id,
            'description': getattr(r, 'description', None),
            'status': r.status.name if getattr(r, 'status', None) else None,
            'purpose': r.purpose.name if getattr(r, 'purpose', None) else None,
            'created_date': r.created_date,
        } for r in obj.requestnames.all()]


class LegalOrderMiniSerializer(serializers.ModelSerializer):
	"""Эрх зүйн баримт бичиг (LegalOrder) — товч.

	org = LEGAL_TYPES, type = ORDER_TYPES — засах үед dropdown‑уудыг сэргээхэд id‑аар ирнэ.
	"""
	type_name = serializers.CharField(source='type.name', read_only=True, default=None)
	org_name = serializers.CharField(source='org.name', read_only=True, default=None)

	class Meta:
		model = LegalOrder
		fields = ['id', 'name', 'order_number', 'order_date', 'org', 'org_name', 'type', 'type_name']


class ConstantMiniSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		fields = ['id', 'name', 'code', 'color']


class GeoNameDropSerializer(serializers.ModelSerializer):
	"""Газар зүйн нэр сонголт (FK dropdown) — хөнгөн."""
	class Meta:
		model = GeoName
		fields = ['id', 'name', 'number']


class GeoNameTypeCardSerializer(serializers.ModelSerializer):
	"""GEONAME_TYPES үндсэн төрөл (карт). geoname_count = удам дахь GeoName тоо."""
	geoname_count = serializers.IntegerField(read_only=True, default=0)

	class Meta:
		model = Constant
		fields = ['id', 'name', 'code', 'color', 'geoname_count']


class GeoNameSerializer(serializers.ModelSerializer):
	type = ConstantMiniSerializer(read_only=True)
	type_id = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.filter(key='GEONAME_TYPES'),
		source='type', write_only=True, required=False, allow_null=True)
	user_name = serializers.CharField(source='user.full_name', read_only=True)
	# geoloc — Point бол lat/lon‑оор; шугам/талбай бол geom (GeoJSON)‑оор.
	lat = serializers.SerializerMethodField()
	lon = serializers.SerializerMethodField()
	geom = serializers.SerializerMethodField()
	geom_type = serializers.SerializerMethodField()  # Point/LineString/Polygon...
	# Эрх зүйн баримт бичиг (M2M LegalOrder)
	orders = LegalOrderMiniSerializer(many=True, read_only=True)
	order_ids = serializers.PrimaryKeyRelatedField(
		queryset=LegalOrder.objects.all(), source='orders',
		many=True, write_only=True, required=False)
	# Засаг захиргааны нэгж (аймаг/сум) — M2M
	units = serializers.SerializerMethodField()

	class Meta:
		model = GeoName
		fields = [
			'id', 'name', 'number', 'type', 'type_id',
			'is_approved', 'is_border',
			'lat', 'lon', 'geom', 'geom_type', 'orders', 'order_ids',
			'user_name', 'created_date', 'units',
		]
		read_only_fields = ['user_name', 'created_date']

	def get_units(self, obj):
		# Аймаг/Нийслэл эхэнд, дараа нь сум/дүүрэг
		def lvl(u):
			return 0 if (u.level and 'Аймаг' in (u.level.name or '')) else 1
		return [{'id': u.id, 'name': u.unit,
		         'level': u.level.name if u.level else None}
		        for u in sorted(obj.unit.all(), key=lvl)]

	def get_lat(self, obj):
		return obj.geoloc.y if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_lon(self, obj):
		return obj.geoloc.x if obj.geoloc and obj.geoloc.geom_type == 'Point' else None

	def get_geom(self, obj):
		return json.loads(obj.geoloc.geojson) if obj.geoloc else None

	def get_geom_type(self, obj):
		return obj.geoloc.geom_type if obj.geoloc else None

	def _apply_geoloc(self, validated_data):
		# geom (GeoJSON) ирвэл түүгээр; эс бөгөөс lat/lon‑оос Point.
		geom = self.initial_data.get('geom')
		if geom not in (None, ''):
			try:
				geo = geom if isinstance(geom, str) else json.dumps(geom)
				g = GEOSGeometry(geo)
				if not g.srid:
					g.srid = 4326
				validated_data['geoloc'] = g
				return validated_data
			except Exception:
				pass
		lat = self.initial_data.get('lat')
		lon = self.initial_data.get('lon')
		try:
			if lat not in (None, '') and lon not in (None, ''):
				validated_data['geoloc'] = Point(float(lon), float(lat), srid=4326)
		except (TypeError, ValueError):
			pass
		return validated_data

	def create(self, validated_data):
		return super().create(self._apply_geoloc(validated_data))

	def update(self, instance, validated_data):
		return super().update(instance, self._apply_geoloc(validated_data))


# ----------------------------------------------------------------------
# ТӨСӨЛ (гэрээт ажил) ба түүнд хамаарах бүртгэлүүд:
#   • ProjectUnitSerializer   — төслийн хамрах засаг захиргааны нэгж
#   • ProjectAreaSerializer   — газрын зураг дээр зурсан ажлын талбай
#   • ProjectMemberSerializer — багийн бүрэлдэхүүн (үе шат + сум тус бүрээр)
#   • ProjectSerializer       — төсөл өөрөө
# ----------------------------------------------------------------------


class ProjectUnitSerializer(serializers.ModelSerializer):
    """Төслийн хамрах ЗЗ нэгж — толгойн chip‑д зориулж эцгийн нэртэй."""
    parent_unit = serializers.CharField(source='parent.unit', read_only=True,
                                        default=None)
    level_name = serializers.CharField(source='level.name', read_only=True,
                                       default=None)

    class Meta:
        model = AdminUnit
        fields = ['id', 'unit', 'parent', 'parent_unit', 'level_name']


class ProjectAreaSerializer(serializers.ModelSerializer):
    """Төслийн ажлын талбай — газрын зураг дээр зурсан polygon.

    area нь GeoJSON‑оор орж/гарна. Зурагт label болгон харуулахад
    user_name (үүсгэсэн хэрэглэгч) + is_finished (төлөв) хэрэгтэй.
    """
    area = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectArea
        fields = ['id', 'project', 'area', 'is_finished',
                  'user', 'user_name', 'created_date']
        read_only_fields = ['user', 'created_date']

    def get_area(self, obj):
        return json.loads(obj.area.geojson) if obj.area else None

    def get_user_name(self, obj):
        u = obj.user
        return (getattr(u, 'full_name', None) or getattr(u, 'username', None)
                or '') if u else ''

    def _apply_area(self, validated_data):
        raw = self.initial_data.get('area')
        if raw in (None, ''):
            return validated_data
        try:
            g = GEOSGeometry(raw if isinstance(raw, str) else json.dumps(raw))
            if not g.srid:
                g.srid = 4326
            validated_data['area'] = g
        except Exception:
            raise serializers.ValidationError({'area': 'Буруу геометр'})
        return validated_data

    def create(self, validated_data):
        return super().create(self._apply_area(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._apply_area(validated_data))


class ProjectMemberSerializer(serializers.ModelSerializer):
    """Төслийн багийн бүрэлдэхүүн — унших талд нэр/албан тушаал/шийдвэр дэлгэрнэ."""
    unit_name = serializers.CharField(source='unit.unit', read_only=True, default=None)
    parent_unit = serializers.CharField(source='unit.parent.unit', read_only=True, default=None)
    position_name = serializers.CharField(source='position.name', read_only=True, default=None)
    step_name = serializers.CharField(source='step.name', read_only=True, default=None)
    doc_name = serializers.CharField(source='doc.name', read_only=True, default=None)
    doc_number = serializers.CharField(source='doc.order_number', read_only=True, default=None)
    person_name = serializers.SerializerMethodField()
    # Системийн хэрэглэгчийн профайл — ProfileAvatar‑д зориулав
    person_profile = ProfileDropDownSerializer(source='person', read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'project', 'unit', 'unit_name', 'parent_unit',
                  'full_name', 'register', 'phone', 'org_title',
                  'position', 'position_name', 'step', 'step_name',
                  'doc', 'doc_name', 'doc_number',
                  'person', 'person_name', 'person_profile', 'created_date']
        read_only_fields = ['created_date']

    def get_person_name(self, obj):
        u = obj.person
        return (getattr(u, 'full_name', None) or getattr(u, 'username', None)) if u else None


class ProjectSerializer(serializers.ModelSerializer):
	org=ProfileDropDownSerializer(read_only=True)
	# Бэлтгэл табын chip‑үүд: ЗӨВХӨН энэ төсөлд бүртгэгдсэн (≥1 legal орд бүхий)
	# LEGAL_TYPES төрлүүд + орд тоо. Зөвхөн detail (retrieve) дээр (жагсаалтад null).
	registered_types = serializers.SerializerMethodField()
	# Хамрах ЗЗ нэгж — уншихад дэлгэрэнгүй, бичихэд id‑гийн жагсаалт
	units = ProjectUnitSerializer(many=True, read_only=True)
	unit_ids = serializers.PrimaryKeyRelatedField(
		queryset=AdminUnit.objects.all(), source='units',
		many=True, write_only=True, required=False,
	)

	class Meta:
		model = Project
		fields = '__all__'

	def get_registered_types(self, obj):
		view = self.context.get('view')
		if not view or getattr(view, 'action', None) != 'retrieve':
			return None
		types = (
			Constant.objects.filter(key='LEGAL_TYPES')
			.annotate(order_count=Count('legalorgs', filter=Q(legalorgs__projects=obj), distinct=True))
			.filter(order_count__gt=0)
			.order_by('id')
		)
		return [
			{
				'id': t.id,
				'name': t.name,
				'label': t.label or t.name,
				'code': t.code,
				'order_count': t.order_count,
			}
			for t in types
		]