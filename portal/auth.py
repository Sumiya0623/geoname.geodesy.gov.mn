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
from rest_framework import exceptions
from rest_framework.permissions import AllowAny
from core.models import Constant,SubMenuPermission
import os
import hashlib
from urllib.parse import urlparse
from django.core.cache import cache
from django.utils.http import http_date

User = get_user_model()

# Профайл зургийг хэдэн секунд тутам дахин шалгахыг тохируулна (default 1 цаг)
PHOTO_SYNC_TTL = getattr(settings, "SSO_PHOTO_SYNC_TTL", 3600)
photo_logger = logging.getLogger(__name__)
logger = photo_logger


def build_photo_url(photo_path):
    """Токеноос ирсэн зам үнэмлэхүй эсвэл харьцангуй байж болно."""
    if photo_path.startswith("http://") or photo_path.startswith("https://"):
        return photo_path
    base = str(getattr(settings, "MAIN_DOMAIN", "")).rstrip("/")
    return f"{base}/{photo_path.lstrip('/')}" if base else photo_path


def sync_user_photo(user, photo_path):
    """Main дээрх профайл зургийг татаж, ЗӨВХӨН өөрчлөгдсөн үед нь дарж бичнэ.

    Main тал зургийг үргэлж `account/{register}_Profile.png` гэсэн тогтмол нэрээр
    хадгалдаг тул URL нь өөрчлөгддөггүй — нэрээр нь харьцуулж болохгүй.
    Иймд дараах 3 шатаар шалгана:
      1. cache — сүүлд шалгаснаас PHOTO_SYNC_TTL хугацаа өнгөрөөгүй бол алгасна
         (get_user нь хүсэлт бүрт дуудагддаг тул).
      2. If-Modified-Since — локал файлын огноогоор нөхцөлт GET хийнэ; сервер
         304 буцаавал зураг өөрчлөгдөөгүй гэсэн үг, агуулга татагдахгүй.
      3. md5 — татсан агуулгыг локал файлын hash-тай тулгана; ижил бол хөндөхгүй.
    Өөрчлөгдсөн тохиолдолд хуучин файлыг устгаад, ирсэн нэрээр нь ижил зам руу
    дарж бичнэ.
    """
    if not photo_path:
        return
    storage = user.photo.storage
    local_name = getattr(user.photo, "name", "") or ""
    try:
        local_exists = bool(local_name) and storage.exists(local_name)
    except Exception:
        local_exists = False

    cache_key = f"sso_photo_sync:{user.pk}"
    if local_exists and cache.get(cache_key):
        return

    photo_url = build_photo_url(photo_path)
    headers = {}
    if local_exists:
        try:
            headers["If-Modified-Since"] = http_date(
                storage.get_modified_time(local_name).timestamp()
            )
        except Exception:
            pass
    try:
        r = requests.get(photo_url, headers=headers, timeout=10)
    except requests.RequestException:
        photo_logger.warning("Failed to download user photo from %s", photo_url, exc_info=True)
        return

    # Амжилттай холбогдсон тул дараагийн шалгалтыг TTL-ээр хойшлуулна
    cache.set(cache_key, 1, PHOTO_SYNC_TTL)

    if r.status_code == 304:
        return
    if r.status_code != 200 or not r.content:
        return

    new_hash = hashlib.md5(r.content).hexdigest()
    if local_exists:
        try:
            with storage.open(local_name, "rb") as fh:
                old_hash = hashlib.md5(fh.read()).hexdigest()
        except Exception:
            old_hash = None
        if old_hash == new_hash:
            return

    filename = os.path.basename(urlparse(photo_url).path) or f"{user.register}_Profile.png"
    if local_name:
        # Ижил нэрээр дарж бичихийн тулд хуучныг нь эхлээд устгана
        # (эс тэгвээс Django нэр дээр санамсаргүй дагавар нэмнэ)
        try:
            user.photo.delete(save=False)
        except Exception:
            photo_logger.warning("Failed to delete old photo %s", local_name, exc_info=True)
    user.photo.save(filename, ContentFile(r.content), save=True)
    photo_logger.info("Profile photo synced for user %s from %s", user.pk, photo_url)


# ----------------------------------------------------------------------
# Хэрэглэгчийн мэдээлэл бүрэн эсэхийн шалгалт.
# Бүх дэд системд ижил дүрэм үйлчилнэ. Шалгалтыг локал DB биш main-ийн
# олгосон токены claim-ээр хийдэг тул дэд систем дотор (админ гараар имэйл
# оруулах гэх мэт) тойрох боломжгүй — цорын ганц эх сурвалж нь main.
#
# Шаардлага (аль нэг дутвал дэд системд оруулахгүй, superuser ч мөн адил):
#   - Иргэн          → баталгаажсан имэйл, утас, профайл зураг, харьяа байгууллага
#   - Хуулийн этгээд → баталгаажсан имэйл, утас, лого
# ----------------------------------------------------------------------

# Мэдээлэл дутуу хэрэглэгч ч дуудах ёстой action-ууд
# (me — дутуу талбаруудаа харах, logout — гарах).
# Зөвхөн хэрэглэгчийн viewset (queryset.model == User) дээр чөлөөлнө — өөр
# viewset-ийн "me" action (ж: хэрэглэгчийн файлууд) шалгалтыг тойрохгүй.
PROFILE_EXEMPT_ACTIONS = {"me", "logout"}


def _is_exempt_view(view):
    if getattr(view, "action", None) not in PROFILE_EXEMPT_ACTIONS:
        return False
    queryset = getattr(view, "queryset", None)
    return getattr(queryset, "model", None) is User


def _claim(token, key):
    return str((token.get(key) if token else "") or "").strip()


def profile_missing_fields(token):
    """Токены claim-ээс дутуу талбаруудын кодыг буцаана.

    Кодууд: email, email_unconfirmed, phone, photo, orgReg
    """
    missing = []
    if not _claim(token, "email"):
        missing.append("email")
    elif not (token and token.get("is_email_confirmed") is True):
        # Хуучин (claim-гүй) токен баталгаажаагүй гэж тооцогдоно
        missing.append("email_unconfirmed")
    if not _claim(token, "phone"):
        missing.append("phone")
    if not _claim(token, "photo"):
        missing.append("photo")
    is_citizen = bool(token.get("is_citizen", True)) if token else True
    if is_citizen and not _claim(token, "orgRegister"):
        missing.append("orgReg")
    return missing


def is_profile_complete(token):
    return not profile_missing_fields(token)


class ProfileIncomplete(exceptions.PermissionDenied):
    default_detail = "Таны бүртгэлийн мэдээлэл бүрэн бус тул энэ системийг ашиглах боломжгүй. geodesy.gov.mn дээр мэдээллээ гүйцээнэ үү."
    default_code = "profile_incomplete"


def _is_public_view(view):
    """View нь зөвхөн AllowAny эрхтэй (нийтийн) эсэх."""
    try:
        perms = view.get_permissions()
    except Exception:
        return False
    return bool(perms) and all(isinstance(p, AllowAny) for p in perms)


class JWTAuthFromCookie(JWTAuthentication):
    def authenticate(self, request):
        result = self._authenticate_token(request)
        if result is None:
            return None
        return self.enforce_profile(request, result)

    def _authenticate_token(self, request):
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

    def enforce_profile(self, request, result):
        """Мэдээлэл дутуу хэрэглэгчийг me/logout-оос бусад API-д оруулахгүй."""
        user, token = result
        view = (getattr(request, "parser_context", None) or {}).get("view")
        # View-гүй дуудлага (requestLog middleware) зөвхөн хэрэглэгчийг танина
        if view is None:
            return result
        missing = profile_missing_fields(token)
        if not missing:
            return result
        if _is_exempt_view(view):
            return result
        # Нийтийн хуудсыг нэвтрээгүй хэрэглэгч шиг ашиглана
        if _is_public_view(view):
            return None
        logger.info("Profile incomplete, blocked: user=%s missing=%s path=%s", user.pk, missing, request.path)
        raise ProfileIncomplete()

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
        # photo нь URL тул ImageField рүү шууд онооход буруу зам үүсгэдэг —
        # доор sync_user_photo() дотор татаж хадгална.
        user_incoming = dict(incoming)
        user_incoming.pop("orgName", None)
        user_incoming.pop("orgReg", None)
        user_incoming.pop("photo", None)
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
        sync_user_photo(user, incoming["photo"])
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
