# portal/auth.py
import uuid
import requests
import logging
from django.db import transaction, IntegrityError
from django.conf import settings
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.exceptions import InvalidToken
from core.models import Constant,SubMenuPermission
User = get_user_model()

class JWTAuthFromCookie(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header:
            raw = self.get_raw_token(header)
            if raw:
                token = self.get_validated_token(raw)
                return (self.get_user(token), token)
        raw = request.COOKIES.get(settings.SIMPLE_JWT.get("COOKIE_ACCESS", "access_token"))
        if raw:
            token = self.get_validated_token(raw)
            return (self.get_user(token), token)
        return None
    @transaction.atomic
    def get_user(self, validated_token):
        claim_name = api_settings.USER_ID_CLAIM    # e.g. "sso_id"
        field_name = api_settings.USER_ID_FIELD    # e.g. "sso_id"
        sso_id = validated_token.get(claim_name)
        if not sso_id:
            raise InvalidToken(f"Token has no '{claim_name}' claim")
        try:
            sso_id_val = uuid.UUID(str(sso_id))
        except Exception:
            raise InvalidToken("Invalid sso_id format")
        incoming = {
            "username":   (validated_token.get("username") or "").strip(),
            "first_name": (validated_token.get("first_name") or "").strip(),
            "last_name":  (validated_token.get("last_name") or "").strip(),
            "email":      (validated_token.get("email") or "").strip(),
            "phone":      (validated_token.get("phone") or "").strip(),
            "is_citizen": bool(validated_token.get("is_citizen", True)),
            "photo":      (validated_token.get("photo") or "").strip(),
            "orgName":      (validated_token.get("orgName") or "").strip(),
            "orgReg":      (validated_token.get("orgRegister") or "").strip(),
        }
        # Fields used for the main RemoteUser instance (no orgName/orgReg)
        user_incoming = dict(incoming)
        user_incoming.pop("orgName", None)
        user_incoming.pop("orgReg", None)
        incoming_register = (validated_token.get("register") or "").strip() or None
        if incoming_register:
            holder = User.objects.filter(register=incoming_register).first()
            if holder:
                setattr(holder, field_name, sso_id_val)
                if incoming["username"] and incoming["username"] != holder.username:
                    holder.username = incoming["username"]
                for k in ["first_name", "last_name", "email", "phone", "is_citizen"]:
                    if hasattr(holder, k):
                        setattr(holder, k, incoming.get(k))
                try:
                    holder.save()
                except IntegrityError:
                    holder.username = User.objects.get(pk=holder.pk).username
                    holder.save()
                user = holder
            else:
                user, created = User.objects.get_or_create(
                    register=incoming_register,
                    defaults={
                        field_name: sso_id_val,
                        **user_incoming,
                    },
                )
        else:
            user = User.objects.create(
                **{field_name: sso_id_val},
                **user_incoming,
            )
        if incoming["orgName"] and incoming["orgReg"]:
            orgStatus, crted = Constant.objects.get_or_create(name="Хуулийн этгээд",key='ROLES')
            # Байгууллага — БАЙВАЛ нэр (first_name) ба is_citizen‑ийг шинэчилнэ,
            # эс бөгөөс шинээр үүсгэнэ (SSO дээр нэр солигдвол энд тусна).
            org = User.objects.filter(register=incoming["orgReg"]).first()
            if org:
                changed = []
                if org.first_name != incoming["orgName"]:
                    org.first_name = incoming["orgName"]
                    changed.append("first_name")
                if org.is_citizen:
                    org.is_citizen = False
                    changed.append("is_citizen")
                if changed:
                    org.save(update_fields=changed)
            else:
                org = User.objects.create(
                    register=incoming["orgReg"],
                    username=incoming["orgReg"],
                    first_name=incoming["orgName"],
                    is_citizen=False,
                )
            user.org =org
            user.save(update_fields=["org"])
            org.roles.add(orgStatus)
        if not user.roles.exists():
            if not user.is_citizen:
                guest, crted = Constant.objects.get_or_create(name="Хуулийн этгээд",key='ROLES')
            else:
                guest, crted = Constant.objects.get_or_create(name="Иргэн", key='ROLES')
            if guest:
                user.roles.add(guest)
        photo_path = incoming["photo"]
        has_name = bool(getattr(user.photo, "name", ""))
        exists = has_name and user.photo.storage.exists(user.photo.name)
        if photo_path and not exists:
            try:
                # Support both absolute and relative URLs coming from SSO token
                if photo_path.startswith("http://") or photo_path.startswith("https://"):
                    photo_url = photo_path
                else:
                    base = str(getattr(settings, "MAIN_DOMAIN", "")).rstrip("/")
                    photo_url = f"{base}/{photo_path.lstrip('/')}" if base else photo_path
                r = requests.get(photo_url, timeout=10)
                if r.status_code == 200 and r.content:
                    filename = f"{user.register}_Profile.png"
                    if user.photo and getattr(user.photo, "name", None):
                        user.photo.delete(save=False)
                    user.photo.save(filename, ContentFile(r.content), save=True)
            except requests.RequestException:
                logging.getLogger(__name__).warning(
                    "Failed to download user photo from %s", photo_path, exc_info=True
                )
        from django.utils import timezone
        user.last_login=timezone.now()
        user.save(update_fields=["last_login"])
        return user
    
from rest_framework.permissions import IsAuthenticated, BasePermission


def function_permission(resource_key):
    """
    submenu.code == resource_key
    + action.code == view.action  (list, retrieve, create, update, destroy, custom ...)

    Ямар ч STATIC жагсаалт ашиглахгүй, зөвхөн
    Constant (ACTION_TYPES).code болон DRF‑ийн view.action
    утгууд таарч байвал зөвшөөрнө.
    """

    class FunctionPermission(BasePermission):
        message = "Танд энэ үйлдэл хийх эрх байхгүй байна."
        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False
            roles = user.roles.all()
            if not roles:
                return False
            action_name = getattr(view, "action", None)
            if not action_name:
                return False
            if action_name in ['me','logout','login','menus']:
                return True
            if action_name in ['retrieve','role']:
                action_name='detail'
            # Бөөнөөр холбох нь ганцаарчилсан 'attach_project'-ийн л өргөтгөл
            if action_name == 'attach_by_units':
                action_name = 'attach_project'
            if action_name in ['sync','partial_update','add_action','remove_action','menus']:
                action_name='update'
            if action_name in ['menus','related','system_registered','network_registered','submenu_actions','nameclass','types','locate','dropdown','unit_tree','type_summary']:
                action_name='list'
            if action_name == 'destroy':
                action_name='delete'
            print(resource_key,action_name)
            for role in roles:
                actions= role.actions.filter(
                    submenu__code=resource_key,
                    action__name=action_name
                )
                if actions.exists():
                    return True
            return False
    FunctionPermission.__name__ = f"FunctionPermission_{resource_key}"
    return [IsAuthenticated, FunctionPermission]
