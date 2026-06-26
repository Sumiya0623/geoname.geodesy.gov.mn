# -*- coding: utf-8 -*-
"""MNS 5217:2012 галиглал + type/unit → DB (Constant/AdminUnit) тулгалт.

Толийн нэг мөр = (name кирилл, aimag, sum). Бүлгийн гарчиг (АРАЛ, АСГА...) → type.
"""
import difflib

# ---- Cyrillic -> Latin, MNS 5217:2012 (хэрэглэгчийн сонголт: Ы→y) ----
MAP = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'Ye', 'Ё': 'Yo',
    'Ж': 'J', 'З': 'Z', 'И': 'I', 'Й': 'I', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'Ө': 'Ö', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
    'У': 'U', 'Ү': 'Ü', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh',
    'Щ': 'Sh', 'Ъ': 'I', 'Ы': 'Y', 'Ь': 'I', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
}


def translit(s):
    out = []
    for ch in s or '':
        up = ch.upper()
        if up in MAP:
            r = MAP[up]
            r = r.lower() if ch.islower() else (r[0] + r[1:].lower() if len(r) > 1 else r)
            out.append(r)
        else:
            out.append(ch)
    return ''.join(out)


def _norm(s):
    return (s or '').strip().lower().replace('ё', 'е')


class Resolver:
    """DB-ийн Constant/AdminUnit-ийг нэг удаа кэшлээд олон мөр шийдвэрлэнэ."""

    def __init__(self):
        from core.models import Constant, AdminUnit
        self.types = {_norm(c.name): c
                      for c in Constant.objects.filter(key='GEONAME_TYPES')}
        self.aimags = {_norm(a.unit): a
                       for a in AdminUnit.objects.filter(level__name='Аймаг/Нийслэл')}
        self.sums = list(AdminUnit.objects.filter(
            level__name='Сум/Дүүрэг').select_related('parent'))

    @staticmethod
    def _clean(s):
        """Цэг, таслал, илүүдэл зайг арилгана ('Мандалын ам.' → 'Мандалын ам')."""
        if not s:
            return s
        s = s.strip().strip('.,;:·•').strip()
        return ' '.join(s.split())

    def resolve_type(self, header):
        """Гарчиг/үг → type Constant. Яг тохирол, эс бөгөөс fuzzy (OCR-зөрүү засна)."""
        if not header:
            return None
        n = _norm(self._clean(header))
        if n in self.types:
            return self.types[n]
        m = difflib.get_close_matches(n, list(self.types), n=1, cutoff=0.84)
        return self.types[m[0]] if m else None

    def resolve_type_from_name(self, name):
        """Нэрийн СҮҮЛИЙН үг = төрөл (Хужиртын ам → Ам). Толийн бүтцийн гол дүрэм."""
        words = self._clean(name).split()
        return self.resolve_type(words[-1]) if words else None

    @staticmethod
    def _fuzzy(name, pool):
        n = _norm(name)
        if n in pool:
            return pool[n], 1.0
        m = difflib.get_close_matches(n, list(pool), n=1, cutoff=0.82)
        if m:
            return pool[m[0]], round(difflib.SequenceMatcher(None, n, m[0]).ratio(), 2)
        return None, 0.0

    def resolve_unit(self, aimag, sm):
        """(аймаг, сум) → (AdminUnit аймаг, AdminUnit сум, оноо)."""
        a, _ = self._fuzzy(aimag, self.aimags)
        cand = {_norm(s.unit): s for s in self.sums if a and s.parent_id == a.id}
        s, sc = self._fuzzy(sm, cand) if cand else (None, 0.0)
        return a, s, sc

    def resolve_row(self, name, header, aimag, sm, uncertain=False):
        """Нэг мөр → dict (name_eng үүсгэх, type/unit тулгах, needs_review тэмдэглэх)."""
        name = self._clean(name)
        aimag, sm = self._clean(aimag), self._clean(sm)
        # type: эхлээд нэрийн СҮҮЛИЙН үгнээс (бат), эс бөгөөс бүлгийн гарчгаас
        t = self.resolve_type_from_name(name) or self.resolve_type(header)
        a, s, sc = self.resolve_unit(aimag, sm)
        needs_review = bool(uncertain) or t is None or a is None or s is None or sc < 0.92
        return {
            'name': name,
            'name_eng': translit(name),
            'type': t,
            'aimag': a,
            'sum': s,
            'unit_score': sc,
            'needs_review': needs_review,
        }
