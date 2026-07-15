# -*- coding: utf-8 -*-
"""Батлагдсан xlsx нэрсийг GeoName-д бөөнөөр импортлоно.

Багана (header 2-р мөрөнд): №, Газар зүйн нэрийн жагсаалт (name),
дэвсгэр нэр (type), Газар зүйн нэрийн галиглал (name_eng), Аймгийн нэр, Сумын нэр.

Дүрэм (хэрэглэгчийн шаардлагаар):
  * name болон name_eng-ийг ФАЙЛААС ЯГ ХЭВЭЭР авна (хуулиар батлагдсан формат).
  * is_approved = True.
  * type-ыг «дэвсгэр нэр»-ээр GEONAME_TYPES-д тулгана; олдохгүй бол шинээр үүсгэнэ
    (давхардмал төрлүүд геометрээр ялгардаг тул нэгийг нь авна).
  * unit(M2M)-ыг аймаг+сумаар AdminUnit-т тулгана (core Resolver-ийн логик).
  * геометртэй (geoloc≠NULL) мөрүүдийг ХАДГАЛНА; зөвхөн геометргүйг устгаад дахин бичнэ.

Жишээ:
  manage.py geoname_import_xlsx                 # dry-run (тоолол)
  manage.py geoname_import_xlsx --apply         # бодитоор бичих
"""
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Батлагдсан xlsx нэрсийг GeoName-д импортлоно (геометртэй мөрийг хадгална)."

    def add_arguments(self, p):
        p.add_argument('--xlsx', default='media/geoname_list.xlsx')
        p.add_argument('--apply', action='store_true',
                       help='Бодитоор DB-д бичих (эс бөгөөс dry-run).')
        p.add_argument('--batch', type=int, default=5000)
        p.add_argument('--source-volume', default='geoname_list.xlsx',
                       help='GeoNameSource.volume — эх сурвалж тэмдэглэгээ.')

    def handle(self, *args, **o):
        try:
            import pandas as pd
        except ImportError:
            raise CommandError('pandas/openpyxl шаардлагатай: pip install pandas openpyxl')
        from core.models import GeoName, GeoNameSource, Constant, AdminUnit
        from core.geoname_import.resolver import Resolver, _norm

        path = o['xlsx']
        if not os.path.exists(path):
            raise CommandError(f'Файл олдсонгүй: {path}')

        self.stdout.write(f'Уншиж байна: {path} ...')
        df = pd.read_excel(path, sheet_name=0, dtype=str, header=1)
        df = df.iloc[:, :6]
        df.columns = ['no', 'name', 'type', 'name_eng', 'aimag', 'sum']
        # NaN → None, зөвхөн урд/хойд зайг арилгана (формат хэвээр)
        def cell(v):
            if v is None:
                return None
            s = str(v).strip()
            return s or None
        for c in df.columns:
            df[c] = df[c].map(cell)
        df = df[df['name'].notna()]
        rows = df.to_dict('records')
        self.stdout.write(f'Нэр бүхий мөр: {len(rows)}')

        R = Resolver()
        apply = o['apply']

        # --- 1) type: ЗӨВХӨН стандартад (GEONAME_TYPES) тохирсон төрлийг авна.
        # Тохироогүй/хоосон төрөлтэй мөрийг импортод авахгүй (хэрэглэгчийн шаардлага:
        # «төрөл зөрүүтэй, хоосныг үлдээ»). Дутуу төрлийг ШИНЭЭР ҮҮСГЭХГҮЙ. ---
        type_by_key = {}          # _norm(str) -> Constant | None
        distinct_types = sorted({r['type'] for r in rows if r['type']})
        for t in distinct_types:
            type_by_key[_norm(t)] = R.types.get(_norm(t))  # exact existing only
        matched = sum(1 for k in type_by_key.values() if k is not None)
        self.stdout.write(
            f'Төрөл: distinct={len(distinct_types)}, стандартад тохирсон={matched}, '
            f'тохироогүй(алгасах)={len(distinct_types) - matched}')

        # зөвхөн төрөл тохирсон мөрүүдийг импортлоно
        import_rows, skipped_notype = [], 0
        for r in rows:
            t = type_by_key.get(_norm(r['type'])) if r['type'] else None
            if t is None:
                skipped_notype += 1
                continue
            r['_type'] = t
            import_rows.append(r)
        self.stdout.write(
            f'Импортлох (төрөл тохирсон): {len(import_rows)} | '
            f'алгасах (төрөл зөрүү/хоосон): {skipped_notype}')

        # --- 2) unit: distinct (aimag,sum) → [aimag_id, sum_id] (зөвхөн импортлох мөрд) ---
        unit_cache = {}
        for r in import_rows:
            k = (r['aimag'], r['sum'])
            if k not in unit_cache:
                a, s, _sc = R.resolve_unit(r['aimag'] or '', r['sum'] or '')
                unit_cache[k] = [x for x in (a.id if a else None, s.id if s else None) if x]
        au = sum(1 for k in unit_cache if unit_cache[k])
        self.stdout.write(f'Unit тохирол: {au}/{len(unit_cache)} distinct (aimag,sum) хосод')

        # --- delete geometryless (keep geometry) ---
        del_qs = GeoName.objects.filter(geoloc__isnull=True)
        keep = GeoName.objects.filter(geoloc__isnull=False).count()
        del_cnt = del_qs.count()
        self.stdout.write(
            f'Устгах (геометргүй) GeoName: {del_cnt} | хадгалах (геометртэй): {keep}')

        if not apply:
            self.stdout.write(self.style.WARNING(
                f'DRY-RUN: {len(import_rows)} нэр импортлох БОЛОМЖТОЙ '
                f'({skipped_notype} мөр төрөл зөрүү/хоосон тул алгасна). '
                f'Бодитоор бичихийн тулд --apply нэмнэ үү.'))
            return

        Through = GeoName.unit.through
        src_vol = o['source_volume']
        batch = o['batch']

        with transaction.atomic():
            self.stdout.write('Геометргүй хуучин мөрүүдийг устгаж байна ...')
            del_qs.delete()  # cascade: GeoNameSource, ReCount, M2M ...

            self.stdout.write('Импорт эхэллээ ...')
            total = len(import_rows)
            done = 0
            buf = []
            for i, r in enumerate(import_rows):
                buf.append((r, GeoName(
                    name=r['name'], name_eng=r['name_eng'], type=r['_type'],
                    is_approved=True)))
                if len(buf) >= batch or i == total - 1:
                    objs = [g for _r, g in buf]
                    GeoName.objects.bulk_create(objs, batch_size=batch)
                    through, sources = [], []
                    for (rr, g), gid in zip(buf, (x.id for x in objs)):
                        for uid in unit_cache[(rr['aimag'], rr['sum'])]:
                            through.append(Through(geoname_id=gid, adminunit_id=uid))
                        sources.append(GeoNameSource(
                            name_id=gid, volume=src_vol, page=0,
                            line=int(rr['no']) if (rr['no'] and str(rr['no']).isdigit()) else None,
                            raw_text=f"{rr['name']} | {rr['aimag'] or ''} {rr['sum'] or ''}".strip(),
                            confidence=1.0, needs_review=False))
                    if through:
                        Through.objects.bulk_create(through, batch_size=batch, ignore_conflicts=True)
                    GeoNameSource.objects.bulk_create(sources, batch_size=batch)
                    done += len(buf)
                    buf = []
                    self.stdout.write(f'  {done}/{total} ...')

        self.stdout.write(self.style.SUCCESS(
            f'Дууслаа: {total} нэр импортлов (is_approved=True, төрөл тохирсон). '
            f'Алгассан (төрөл зөрүү/хоосон): {skipped_notype}. '
            f'Геометртэй {keep} мөр хадгалагдсан.'))
