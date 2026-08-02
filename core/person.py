# -*- coding: utf-8 -*-
"""Хүний (иргэний) мэдээллийг РЕГИСТРЭЭР олох/бүртгэх — БҮХ модулийн НЭГ цэг.

Зөвлөлийн гишүүн, төслийн багийн бүрэлдэхүүн, хүсэлтийн «холбоо барих хүн»
бүгд ЭНЭ НЭГ endpoint‑ыг дуудна:

  POST /api/core/person/
    {register, [create], [last_name, first_name, email, phone, role, unit]}

  → {found, source, id, register, last_name, first_name, full_name,
     email, phone}
       source: 'local' — өөрийн баазаас олдсон (id‑тэй, шууд холбоно)
               'hur'   — ХУР‑аас татсан (id=None, хараахан бүртгэгдээгүй)
               'new'   — create=true үед шинээр бүртгэсэн (id‑тэй)
       found=False — аль алинд олдсонгүй, гараар бөглөнө
"""
import requests

from django.conf import settings

from core.models import Constant, AdminUnit, RemoteUser

# ХУР‑ын иргэний мэдээллийн үйлчилгээ (geodesy.gov.mn дамжуулагч)
HUR_CHECK_USER_URL = 'https://geodesy.gov.mn/api/account/check-user/'


def _person_out(register, source, last='', first='', email='', phone='', uid=None):
    """Нэгдсэн хариу — эх сурвалж (local/hur) ялгаагүй ижил бүтэцтэй."""
    return {
        'found': True,
        'source': source,
        'id': uid,
        'register': register,
        'last_name': last or '',
        'first_name': first or '',
        'full_name': f'{last or ""} {first or ""}'.strip(),
        'email': email or '',
        'phone': phone or '',
    }


def _bearer_token(request):
    """Хэрэглэгчийн access token — header, эс бөгөөс cookie‑оос."""
    auth = request.headers.get('Authorization', '') if request else ''
    if auth.lower().startswith('bearer '):
        return auth.split(' ', 1)[1]
    if request is not None:
        return request.COOKIES.get(
            settings.SIMPLE_JWT.get('COOKIE_ACCESS', 'access_token'))
    return None


def lookup_person(register, request=None):
    """Регистрээр хүний мэдээлэл олох.

    Дараалал:
      1. ӨӨРИЙН бааз (RemoteUser) → source='local', id‑тэй (шууд холбоно)
      2. ХУР → source='hur' (овог, нэр, утас, имэйл)
      3. Аль алинд олдохгүй → {'found': False}
    """
    register = str(register or '').strip()
    if len(register) != 10:
        return {'found': False, 'register': register,
                'detail': 'Регистрийн дугаар 10 тэмдэгт байх ёстой'}

    # 1) Өөрийн бааз
    u = RemoteUser.objects.filter(register=register).first()
    if u:
        return _person_out(register, 'local', u.last_name, u.first_name,
                           u.email, getattr(u, 'phone', ''), u.id)

    # 2) ХУР — хэрэглэгчийн token‑оор баталгаажуулж дамжуулна
    token = _bearer_token(request)
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    try:
        r = requests.post(HUR_CHECK_USER_URL, json={'register': register},
                          headers=headers, timeout=15)
    except requests.RequestException:
        return {'found': False, 'register': register,
                'detail': 'ХУР системтэй холбогдож чадсангүй'}
    if r.status_code == 200:
        try:
            d = r.json() or {}
        except ValueError:
            d = {}
        # ХУР нь {result: {...}} эсвэл шууд объектоор буцаана
        d = d.get('result') or d.get('results') or d
        last = d.get('last_name') or d.get('lastname') or d.get('surname') or ''
        first = d.get('first_name') or d.get('firstname') or d.get('name') or ''
        if last or first:
            return _person_out(register, 'hur', last, first,
                               d.get('email'), d.get('phone'))
    # 3) Олдсонгүй — гараар бөглөнө
    return {'found': False, 'register': register}


def ensure_person(data):
    """Регистрээр хэрэглэгчийг ОЛОХ, олдохгүй бол ҮҮСГЭХ.

      data: {register, last_name, first_name, email, phone,
             role: нэмэлт ролийн нэр, unit: AdminUnit id}
    Роль: «Иргэн» (+ өгсөн бол нэмэлт роль). Нэгж өгвөл хэрэглэгчийн unit
    M2M‑д нэмнэ. → (result_dict, error_dict|None)
    """
    register = str(data.get('register') or '').strip()
    if not register:
        return None, {'detail': 'Регистр шаардлагатай'}
    last = str(data.get('last_name') or '').strip()
    first = str(data.get('first_name') or '').strip()

    user = RemoteUser.objects.filter(register=register).first()
    created = False
    if not user:
        if not (last or first):
            return None, {'detail': 'Шинэ хэрэглэгчид овог, нэр шаардлагатай'}
        user = RemoteUser.objects.create(
            register=register, username=register,
            last_name=last, first_name=first,
            email=str(data.get('email') or '').strip(),
            phone=str(data.get('phone') or '').strip() or None,
            is_citizen=True)
        user.set_unusable_password()
        user.save()
        created = True
    else:
        # Байгаа хэрэглэгчийн ДУТУУ талбарыг л нөхнө (дарж бичихгүй)
        changed = []
        for f, v in (('last_name', last), ('first_name', first),
                     ('email', str(data.get('email') or '').strip()),
                     ('phone', str(data.get('phone') or '').strip())):
            if v and not getattr(user, f, None):
                setattr(user, f, v)
                changed.append(f)
        if changed:
            user.save(update_fields=changed)

    # Роль — «Иргэн» + (өгсөн бол) нэмэлт роль
    role_names = ['Иргэн']
    extra = str(data.get('role') or '').strip()
    if extra:
        role_names.append(extra)
    roles = list(Constant.objects.filter(key='ROLES', name__in=role_names))
    if roles:
        user.roles.add(*roles)

    # Засаг захиргааны нэгж (салбар зөвлөл / төслийн сум)
    unit_id = data.get('unit')
    if unit_id:
        au = AdminUnit.objects.filter(id=unit_id).first()
        if au:
            user.unit.add(au)

    return {
        'id': user.id,
        'register': user.register,
        'full_name': f'{user.last_name or ""} {user.first_name or ""}'.strip()
                     or user.username,
        'created': created,
    }, None


# ----------------------------------------------------------------------
# API — БҮХ модулийн дуудах ганц цэг (core/urls.py: /api/core/person/)
# ----------------------------------------------------------------------

from rest_framework.views import APIView          # noqa: E402
from rest_framework.response import Response      # noqa: E402
from rest_framework.permissions import IsAuthenticated  # noqa: E402


class PersonView(APIView):
    """Регистрээр хүн хайх; create=true бол ОЛДООГҮЙ тохиолдолд бүртгэнэ.

    Зөвлөл, багийн бүрэлдэхүүн, хүсэлтийн холбоо барих хүн — бүгд энэ л
    endpoint‑ыг ашиглана (нэмэлт ensure/find endpoint байхгүй).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        register = str(d.get('register') or '').strip()
        res = lookup_person(register, request)

        want_create = str(d.get('create') or '').lower() in ('1', 'true', 'yes')
        if not want_create or res.get('source') == 'local':
            status = 400 if (not res.get('found') and len(register) != 10) else 200
            return Response(res, status=status)

        # Үүсгэх — ХУР‑аас татсан (эсвэл гараар бөглөсөн) мэдээллээр
        payload = {
            'register': register,
            'last_name': d.get('last_name') or res.get('last_name') or '',
            'first_name': d.get('first_name') or res.get('first_name') or '',
            'email': d.get('email') or res.get('email') or '',
            'phone': d.get('phone') or res.get('phone') or '',
            'role': d.get('role'),
            'unit': d.get('unit'),
        }
        created, err = ensure_person(payload)
        if err:
            return Response(err, status=400)
        return Response({**res, 'found': True, 'source': 'new',
                         'id': created['id'],
                         'full_name': created['full_name']}, status=200)
