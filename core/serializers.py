
from rest_framework import  serializers
from notifications.models import Notification
from collections import OrderedDict
from core.models import (
	Constant,
	RemoteUser,
	SubMenuPermission,
	AdminUnit,
	MailLog
	)
class AdminUnitDropDownSerializer(serializers.ModelSerializer):
	level=serializers.CharField(read_only=True,source='level.name')
	# Дэд түвшний сонголтыг эцгээр нь бүлэглэхэд (ж: аль аймгийн сум бэ)
	parent_unit=serializers.CharField(read_only=True,source='parent.unit',default=None)
	class Meta:
		model = AdminUnit
		fields = ['id','unit','level','parent','parent_unit']

class AdminUnitSerializer(serializers.ModelSerializer):
	# Засаг захиргааны нэгжийн мод (Аймаг→Сум→Баг). subcount нь хүүхдийн тоо (lazy expand).
	parent_id = serializers.PrimaryKeyRelatedField(
		queryset=AdminUnit.objects.all(), source='parent', write_only=True, required=False)
	subcount = serializers.IntegerField(read_only=True)
	class Meta:
		model = AdminUnit
		fields = ['id', 'unit', 'parent_id', 'parent', 'subcount', 'level']

class ConstantDropDownSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		# color — газрын зураг/legend/chip‑үүд төлвийн өнгийг ЭНДЭЭС авна
		# code  — тогтмолыг НЭРЭЭР нь биш кодоор нь таних (нэр өөрчлөгдөж болно)
		# label — тухайн тогтмолын нэмэлт ТУГ (true/false гэх мэт) — код дотор
		# статик текстээр ялгахын оронд DB‑ээс удирдана
		fields = ['id','name','parent','desc','color','code','label']

class MailLogSerializer(serializers.ModelSerializer):
	category = ConstantDropDownSerializer(read_only=True)
	category_color = serializers.CharField(source='category.color', read_only=True)
	status_display = serializers.CharField(source='get_status_display', read_only=True)
	class Meta:
		model = MailLog
		fields = [
			'id', 'category', 'category_color', 'to_email', 'to_user',
			'subject', 'body', 'status', 'status_display', 'error', 'created_at',
		]

class ProfileDropDownSerializer(serializers.ModelSerializer):
	roles=ConstantDropDownSerializer(many=True,read_only=True)
	class Meta:
		model = RemoteUser
		fields = ['id','full_name','photo','roles','phone','email']


class PersonSerializerMixin(serializers.Serializer):
	"""Хүний мэдээллийг RemoteUser‑ээс УНШИХ, регистрээр нь БИЧИХ нэгдсэн mixin.

	Зөвлөлийн гишүүн, төслийн багийн бүрэлдэхүүн, хүсэлтийн холбоо барих хүн —
	бүгд person (FK RemoteUser) талбартай бөгөөд овог, нэр, регистр, утас, имэйлээ
	энэ mixin‑ээр л уншина (баазад давхардуулж хадгалахгүй).

	Бичихдээ: person (id) шууд өгч болно; эсвэл register (+ овог, нэр) өгвөл
	core.person.ensure_person‑оор хэрэглэгчийг олж/үүсгээд person‑д онооно.
	"""
	person_profile = ProfileDropDownSerializer(source='person', read_only=True)
	full_name = serializers.CharField(source='person.full_name', read_only=True, default=None)
	last_name = serializers.CharField(source='person.last_name', read_only=True, default=None)
	first_name = serializers.CharField(source='person.first_name', read_only=True, default=None)
	register = serializers.CharField(source='person.register', read_only=True, default=None)
	phone = serializers.CharField(source='person.phone', read_only=True, default=None)
	email = serializers.CharField(source='person.email', read_only=True, default=None)

	def to_internal_value(self, data):
		ret = super().to_internal_value(data)
		if ret.get('person'):
			return ret
		register = str((data.get('register') if hasattr(data, 'get') else '') or '').strip()
		if not register:
			return ret
		last = str(data.get('last_name') or '').strip()
		first = str(data.get('first_name') or '').strip()
		if not (last or first):
			# Зөвхөн full_name ирвэл эхний үгийг овог, үлдсэнийг нэр гэж үзнэ
			parts = str(data.get('full_name') or '').split()
			last, first = (parts[0] if len(parts) > 1 else ''), ' '.join(parts[1:] or parts)
		from core.person import ensure_person
		res, err = ensure_person({
			'register': register, 'last_name': last, 'first_name': first,
			'email': data.get('email'), 'phone': data.get('phone'),
			'role': data.get('role'), 'unit': data.get('person_unit'),
		})
		if err:
			raise serializers.ValidationError(err)
		ret['person'] = RemoteUser.objects.get(id=res['id'])
		return ret


class ConstantSerializer(serializers.ModelSerializer):
	count1=serializers.IntegerField(read_only=True)
	count2=serializers.IntegerField(read_only=True)
	count3=serializers.IntegerField(read_only=True)
	count4=serializers.IntegerField(read_only=True)
	parent=ConstantDropDownSerializer(read_only=True)
	parent_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(), source='parent', write_only=True, required=False, allow_null=True)
	class Meta:
		model = Constant
		fields = ['id','name', 'key','color','code','label','desc','parent','parent_id','count1','count2','count3','count4','actions']

class ConstantStatusSerializer(serializers.ModelSerializer):
    count=serializers.IntegerField(read_only=True,default=0)
    class Meta:
        model = Constant
        fields = ['id','name','count','color']

class ConstantUpdateOrCreateSerializer(serializers.ModelSerializer):
	parent_id=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(), source='parent', write_only=True, required=False, allow_null=True)
	parent=serializers.PrimaryKeyRelatedField(queryset=Constant.objects.all(),write_only=True, required=False, allow_null=True)
	class Meta:
		model = Constant
		fields = ['id','name', 'key',"parent_id", 'parent','desc','code','color','label']

class SubMenuActionSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='action.label', read_only=True)
    key  = serializers.CharField(source='action.name', read_only=True)
    action_id = serializers.IntegerField(source='action.id', read_only=True)
    role_count = serializers.SerializerMethodField()
    class Meta:
        model = SubMenuPermission
        fields = ['id', 'name', 'key', 'action_id', 'role_count']
    def get_role_count(self, obj):
        return obj.roles.count()

class SubMenuSerializer(serializers.ModelSerializer):
	actions = SubMenuActionSerializer(source='role_permissions', many=True, read_only=True)
	class Meta:
		model = Constant
		fields = ['id', 'name', 'key','actions']
	
class MenuSerializer(serializers.ModelSerializer):
	children = serializers.SerializerMethodField(read_only=True)
	class Meta:
		model = Constant
		fields = '__all__'
	def get_children(self, obj):
		qs = obj.children.filter(key='SUBMENUS').prefetch_related('role_permissions__action')
		return SubMenuSerializer(qs, many=True).data
		
class NotificationSerializer(serializers.ModelSerializer):
	recipient=serializers.CharField(source='recipient.full_name',default='Admin')
	actor=serializers.SerializerMethodField()
	class Meta:
		model = Notification
		fields = '__all__'
	def get_actor(self, obj):
		if obj.actor_object_id:
			user=RemoteUser.objects.filter(id=obj.actor_object_id).first()
			return ProfileDropDownSerializer(user).data
		return None

class NotificationDetailSerializer(NotificationSerializer):
    extra_description = serializers.SerializerMethodField()
    class Meta(NotificationSerializer.Meta):
        fields = [NotificationSerializer.Meta.fields] + ['extra_description']
    def get_extra_description(self, obj):
        return f"Мэдэгдэл: {obj.description}"

class UserListSerializer(serializers.ModelSerializer):
	roles=ConstantDropDownSerializer(read_only=True, many=True)
	org=ProfileDropDownSerializer(read_only=True)
	unit=AdminUnitDropDownSerializer(read_only=True, many=True)
	class Meta:
		model = RemoteUser
		fields = ['id','full_name','roles','is_citizen','org','phone','email','last_login','date_joined','is_active','photo','unit']
		read_only_fields = ['id','photo']

class MeSerializer(serializers.ModelSerializer):
	menus = serializers.SerializerMethodField(read_only=True)
	roles=ConstantDropDownSerializer(read_only=True, many=True)
	class Meta:
		model = RemoteUser
		fields = ['id','full_name','is_citizen','phone','photo','email','roles','is_active','register','last_login','date_joined','menus']
		read_only_fields = ['id','photo','menus']
	def get_menus(self, obj):
		user_roles = Constant.objects.filter(id__in=obj.roles.all())
		user_actions = Constant.objects.filter(id__in=user_roles).values_list('actions', flat=True).distinct()
		if not user_roles:
			return []
		actions=SubMenuPermission.objects.filter(id__in=user_actions)
		perms = actions.select_related('submenu__parent', 'action').all()
		groups: dict[int, dict] = OrderedDict()
		submenu_index: dict[int, dict[int, dict]] = {}
		act_order = {"list": 0, "create": 1, "detail": 2, "update": 3, "delete": 4}
		for p in perms:
			sm = p.submenu
			parent = sm.parent  # Constant эсвэл None
			gid = parent.id if parent else 0
			if gid not in groups:
				groups[gid] = {
					"id": (parent.id if parent else 0),
					"name": (parent.name if parent else "Ерөнхий"),
					"order": int(1),  # танайд 'order' талбар байвал
					"submenus": [],
				}
				submenu_index[gid] = {}
			if sm.id not in submenu_index[gid]:
				submenu_entry = {
					"id": sm.id,
					"name": sm.name,
					"icon": getattr(sm, "color", None),
					"path": getattr(sm, "desc", 'hidden'),
					"order": getattr(sm, "code", 0),
					"content": sm.code if sm.code else '-',
					"actions": [],
				}
				submenu_index[gid][sm.id] = submenu_entry
				groups[gid]["submenus"].append(submenu_entry)
			submenu_entry = submenu_index[gid][sm.id]
			submenu_entry["actions"].append({
				"id": p.id,
				"name": p.action.label,
				"key":  p.action.name,   # 'delete' | 'update' | ...
			})
		for gid, g in groups.items():
			for sm in g["submenus"]:
				sm["actions"].sort(key=lambda a: act_order.get(a["key"], 999))
			g["submenus"].sort(key=lambda s: (s["order"], s["name"] or ""))
		out = list(groups.values())
		out.sort(key=lambda g: (g["order"], g["name"] or ""))
		return out
	
class UserRoleUpdateOrCreateSerializer(serializers.ModelSerializer):
	unit_ids = serializers.PrimaryKeyRelatedField(queryset=AdminUnit.objects.all(),required=False, source='unit', write_only=True, many=True)
	role_ids = serializers.PrimaryKeyRelatedField(
		queryset=Constant.objects.all(),
		many=True,
		required=False,		
		source='roles',
	)
	class Meta:
		model = RemoteUser
		fields = ['unit_ids','role_ids']