"""Батлагдсан газар зүйн нэрийн ЛАВЛАГАА — HTML баримт (point.geodesy‑тэй ижил
толгой/хөл) + нийтийн хүчинтэй эсэхийг шалгах хуудас.

  /inquire/<code>/         → лавлагааны баримт (амьд газрын зураг, хэсгүүд, QR)
  /inquire/<code>/verify/  → QR‑аас нээгддэг энгийн хүчинтэй эсэх хуудас
"""
import json

from django.conf import settings
from django.shortcuts import render, get_object_or_404
from django.utils import timezone

from core.models import GeoNameInquire, AdminUnit


def _current_domain(request):
    return f"{request.scheme}://{request.get_host()}"


def _type_path(geoname):
    chain, c, seen = [], geoname.type, set()
    while c and c.id not in seen:
        seen.add(c.id)
        chain.append(c.name)
        c = c.parent
    chain.reverse()
    return ' › '.join(chain)


def _utm_epsg(lon):
    """Уртрагаас UTM бүсийн EPSG (умард хагас бөмбөрцөг) — урт/талбай тооцоход."""
    zone = int((lon + 180) / 6) + 1
    return 32600 + zone


def _dms(value, is_lat):
    """Аравтын градусыг DMS (град°мин'сек")‑т — секунд таслалын 1 орны нарийвчлалтай."""
    hemi = ('N' if value >= 0 else 'S') if is_lat else ('E' if value >= 0 else 'W')
    v = abs(value)
    d = int(v)
    m_full = (v - d) * 60
    m = int(m_full)
    s = (m_full - m) * 60
    return f"{d}°{m:02d}'{s:04.1f}\"{hemi}"


def _mn_date(d):
    """Огноо: «2003.09.30»."""
    return f'{d.year}.{d.month:02d}.{d.day:02d}' if d else ''


# Геометрийн төрөл → баруун баганын гарчиг. Template дотор {% if %}{% elif %}
# бичихээс зайлсхийв — HTML форматтер уг мөрийг таслахад Django таг эвдэрдэг.
_MEASURE_LABELS = {'point': 'Солбицол', 'line': 'Урт', 'area': 'Талбай'}


def _measure(geom):
    """Геометрийн төрлөөр хэмжээ: цэг→солбицол(DMS), шугам→урт, талбай→км².
    Урт/талбайг геометрийн центроидын UTM бүс рүү хувиргаж тооцно.
    Буцаах dict‑д template‑д шууд хэвлэх `label` талбар багтана."""

    def out(kind, text, **extra):
        return {'kind': kind, 'text': text,
                'label': _MEASURE_LABELS.get(kind, 'Байрлал'), **extra}

    if not geom:
        return out(None, '—')
    gt = geom.geom_type
    if gt == 'Point':
        return out('point', f'{_dms(geom.y, True)}, {_dms(geom.x, False)}',
                   lat=geom.y, lon=geom.x)
    try:
        c = geom.centroid
        epsg = _utm_epsg(c.x)
        g2 = geom.clone()
        g2.transform(epsg)
        if 'Line' in gt:
            m = g2.length
            txt = f'{m/1000:.3f} км' if m >= 1000 else f'{m:.1f} м'
            return out('line', txt)
        if 'Polygon' in gt:
            km2 = g2.area / 1_000_000.0
            return out('area', f'{km2:.1f} км²')
    except Exception:
        pass
    return out(gt, '—')


def _admin_overlaps(geom):
    """Объекттой ДАВХЦАХ (intersects) Аймаг/Нийслэл + Сум/Дүүрэг нэгжүүд."""
    if not geom:
        return []
    qs = (AdminUnit.objects
          .filter(geom__intersects=geom,
                  level__name__in=['Аймаг/Нийслэл', 'Сум/Дүүрэг'])
          .select_related('level', 'parent')
          .order_by('level__name', 'unit'))
    out = []
    for u in qs:
        out.append({'level': u.level.name if u.level else '',
                    'name': u.unit,
                    'parent': u.parent.unit if u.parent_id else ''})
    return out


def _inquire_context(request, inq):
    g = inq.name
    geom = g.geoloc if g else None
    now = timezone.now()
    valid = bool(g and g.is_approved) and (inq.valid_until is None or inq.valid_until >= now)
    # Эрх зүйн баримт (батлагдсан) — LegalOrder
    orders = [{'name': o.name,
               'type': (o.type.name if o.type_id else ''),
               'org': (o.org.name if o.org_id else ''),
               'number': (f'№ {o.order_number}' if o.order_number else ''),
               'date': _mn_date(o.order_date)}
              for o in (g.legalorders.select_related('type', 'org').all() if g else [])]
    # Зураг (generic FK) — desc‑тэй
    from django.contrib.contenttypes.models import ContentType
    from core.models import Photo, GeoName
    ct = ContentType.objects.get_for_model(GeoName)
    photos = [{'url': (p.file.url if p.file else ''), 'desc': p.desc or ''}
              for p in Photo.objects.filter(content_type=ct, object_id=g.id)] if g else []
    # Тодруулалт (ReCount) — "<он> онд '<төсөл>' гэрээт ажлын хүрээнд тодруулсан"
    recounts = []
    for r in (g.recounts.select_related('project').all() if g else []):
        recounts.append({
            'year': r.created_date.year if getattr(r, 'created_date', None) else '',
            'project': (r.project.name if r.project_id else ''),
        })
    # Засаг захиргаа — газрын зургийн баруун талд хүснэгтгүйгээр нэг мөрөнд:
    # "Хөвсгөл аймаг, Баянзүрх сум"
    admins = _admin_overlaps(geom)
    parts = []
    for a in admins:
        name = a['name']
        if not name:
            continue
        if 'Аймаг' in a['level']:
            suffix = 'нийслэл' if 'Улаанбаатар' in name else 'аймаг'
        elif 'Сум' in a['level']:
            suffix = 'дүүрэг' if 'Улаанбаатар' in (a['parent'] or '') else 'сум'
        else:
            suffix = ''
        parts.append(f'{name} {suffix}'.strip())
    admin_text = ', '.join(parts)
    geojson = json.loads(geom.geojson) if geom else None
    requester = ''
    if inq.user:
        requester = (getattr(inq.user, 'full_name', '') or inq.user.get_full_name()
                     or inq.user.username or '')
    valid_until_str = (inq.valid_until.strftime('%Y-%m-%d')
                       if inq.valid_until else 'хугацаагүй')
    return {
        'requester': requester,
        'valid_until_str': valid_until_str,
        'current_domain': _current_domain(request),
        'inq': inq,
        'g': g,
        'valid': valid,
        'type_path': _type_path(g) if g else '',
        'measure': _measure(geom),
        'admins': admins,
        'admin_text': admin_text,
        'orders': orders,
        'photos': photos,
        'recounts': recounts,
        'geojson': json.dumps(geojson) if geojson else 'null',
        'coord_system': 'WGS84 (EPSG:4326)',
        # QR нь FRONTEND‑ийн хүчинтэй шалгах хуудас руу (лавлагааны дугаараар)
        'verify_url': f"{(settings.MY_FRONT_DOMAIN or '').rstrip('/')}/inquire/{inq.code}",
    }


def inquire_document(request, code):
    """Лавлагааны баримт (босоо A4, амьд газрын зураг, хэсгүүд, QR)."""
    inq = get_object_or_404(
        GeoNameInquire.objects.select_related('name', 'name__type', 'user'),
        code=code)
    return render(request, 'inquire/geonameInquire.html', _inquire_context(request, inq))
