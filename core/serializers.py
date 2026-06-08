
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
	class Meta:
		model = AdminUnit
		fields = ['id','unit','level']

class ConstantDropDownSerializer(serializers.ModelSerializer):
	class Meta:
		model = Constant
		fields = ['id','name','parent','desc']

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