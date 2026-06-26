# -*- coding: utf-8 -*-
"""Толийн PDF → GeoName импортын pipeline.

Үе шатууд (--stage):
  extract : хуудсуудыг рендер→Claude vision (Batch API)→ <workdir>/<vol>.jsonl
  resolve : jsonl → бүлгийн гарчгийг хуудсаар дамжуулж тээх → type/unit тулгах → <vol>.csv
  commit  : csv → GeoName + unit(M2M) + GeoNameSource үүсгэх (is_approved=True), идемпотент

Жишээ:
  manage.py geoname_import --stage extract --pdf ~/disk5/geoname/5-1352-1.pdf \
        --volume 5-1352-1 --pages 500-502 --workdir /tmp/gimport
  manage.py geoname_import --stage resolve --volume 5-1352-1 --workdir /tmp/gimport
  manage.py geoname_import --stage commit  --volume 5-1352-1 --workdir /tmp/gimport [--apply]

API key: ANTHROPIC_API_KEY орчны хувьсагчид. Batch ~256MB/100k хязгаартай тул
хуудсуудыг хэмжээгээр нь автоматаар хэд хэдэн batch болгож хуваана.
"""
import csv
import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Толийн PDF-ээс баталгаажсан газрын нэрсийг GeoName-д импортлоно."

    def add_arguments(self, p):
        p.add_argument('--stage', required=True, choices=['extract', 'resolve', 'commit'])
        p.add_argument('--volume', required=True, help='Ботийн нэр, ж: 5-1352-1')
        p.add_argument('--workdir', required=True, help='jsonl/csv хадгалах хавтас')
        p.add_argument('--pdf', help='extract үед PDF зам')
        p.add_argument('--pages', help='ж: 500-502 эсвэл 1-502 (default: бүх хуудас)')
        p.add_argument('--dpi', type=int, default=300)
        p.add_argument('--batch-bytes', type=int, default=180 * 1024 * 1024,
                       help='Нэг batch-ийн зургийн дээд хэмжээ (default ~180MB)')
        p.add_argument('--stub-jsonl', help='extract алгасаж бэлэн jsonl ашиглах (тест)')
        p.add_argument('--apply', action='store_true',
                       help='commit үед бодитоор DB-д бичих (эс бөгөөс dry-run)')

    # ---- helpers ----
    def _paths(self, opts):
        os.makedirs(opts['workdir'], exist_ok=True)
        base = os.path.join(opts['workdir'], opts['volume'])
        return base + '.jsonl', base + '.csv'

    def _page_range(self, opts, pdf):
        from core.geoname_import.render import page_count
        if opts.get('pages'):
            a, _, b = opts['pages'].partition('-')
            return range(int(a), int(b or a) + 1)
        return range(1, page_count(pdf) + 1)

    # ---- stage: extract ----
    def stage_extract(self, opts):
        jsonl_path, _ = self._paths(opts)
        if opts.get('stub_jsonl'):
            raise CommandError('stub-jsonl нь resolve үе шатанд хэрэглэгдэнэ, extract-д биш')
        pdf = opts.get('pdf')
        if not pdf or not os.path.exists(pdf):
            raise CommandError('--pdf буруу эсвэл олдсонгүй')
        import anthropic
        from core.geoname_import import render, vision

        # backend/.env-ээс ANTHROPIC_API_KEY автоматаар уншина
        if not os.environ.get('ANTHROPIC_API_KEY'):
            try:
                from dotenv import load_dotenv
                load_dotenv(os.path.join(os.getcwd(), '.env'))
            except Exception:
                pass
        if not os.environ.get('ANTHROPIC_API_KEY'):
            raise CommandError('ANTHROPIC_API_KEY алга — backend/.env-д нэмнэ үү')
        client = anthropic.Anthropic()  # ANTHROPIC_API_KEY орчноос
        pages = list(self._page_range(opts, pdf))
        self.stdout.write(f'Рендер: {len(pages)} хуудас @ {opts["dpi"]}dpi ...')

        # хэмжээгээр нь batch болгож хуваах
        batches, cur, cur_bytes = [], [], 0
        imgs = {}
        for pg in pages:
            png = render.render_page_png(pdf, pg, dpi=opts['dpi'])
            imgs[pg] = png
            if cur and cur_bytes + len(png) > opts['batch_bytes']:
                batches.append(cur); cur, cur_bytes = [], 0
            cur.append(pg); cur_bytes += len(png)
        if cur:
            batches.append(cur)
        self.stdout.write(f'{len(batches)} batch болгож хуваав')

        results = {}
        for i, grp in enumerate(batches, 1):
            items = [(f'{opts["volume"]}_p{pg}', imgs[pg]) for pg in grp]
            bid = vision.submit_batch(client, items)
            self.stdout.write(f'[{i}/{len(batches)}] batch={bid} ({len(grp)} хуудас) илгээв')
            vision.wait_batch(client, bid, log=lambda m: self.stdout.write('  ' + m))
            results.update(vision.collect_results(client, bid))

        with open(jsonl_path, 'w') as f:
            for pg in pages:
                r = results.get(f'{opts["volume"]}_p{pg}', {'items': [], 'error': 'missing'})
                f.write(json.dumps({'page': pg, **r}, ensure_ascii=False) + '\n')
        self.stdout.write(self.style.SUCCESS(f'Бичив: {jsonl_path}'))

    # ---- stage: resolve ----
    def stage_resolve(self, opts):
        jsonl_path, csv_path = self._paths(opts)
        src = opts.get('stub_jsonl') or jsonl_path
        if not os.path.exists(src):
            raise CommandError(f'jsonl олдсонгүй: {src}')
        from core.geoname_import.resolver import Resolver
        R = Resolver()

        pages = [json.loads(l) for l in open(src) if l.strip()]
        pages.sort(key=lambda d: d['page'])
        rows, header, n_auto = [], None, 0
        for pg in pages:
            line = 0
            for it in pg.get('items', []):
                # --- Гарчиг мөр ---
                if it.get('kind') == 'header':
                    h = (it.get('header') or '').strip()
                    if R.resolve_type(h):
                        # Жинхэнэ type — идэвхтэй гарчгийг солино
                        header = h
                        continue
                    # type-д тохирохгүй "гарчиг": бичлэгийг андуурсан байж магадгүй.
                    # "нэр, аймаг, сум" хэлбэртэй бол бичлэг болгон сэргээнэ.
                    parts = [x.strip() for x in h.split(',')]
                    if len(parts) >= 2 and len(parts[0].split()) <= 4:
                        it = {'name': parts[0], 'aimag': parts[1] if len(parts) > 1 else '',
                              'sum': parts[2] if len(parts) > 2 else '', 'uncertain': True}
                    else:
                        # Танигдахгүй гарчиг — идэвхтэй гарчгийг ХЭВЭЭР үлдээнэ (хордуулахгүй)
                        continue
                line += 1
                rr = R.resolve_row(it.get('name', ''), header,
                                   it.get('aimag', ''), it.get('sum', ''),
                                   it.get('uncertain', False))
                n_auto += not rr['needs_review']
                rows.append({
                    'volume': opts['volume'], 'page': pg['page'], 'line': line,
                    'name': rr['name'], 'name_eng': rr['name_eng'],
                    'type': rr['type'].name if rr['type'] else '',
                    'type_id': rr['type'].id if rr['type'] else '',
                    'aimag': rr['aimag'].unit if rr['aimag'] else '',
                    'sum': rr['sum'].unit if rr['sum'] else '',
                    'sum_id': rr['sum'].id if rr['sum'] else '',
                    'aimag_id': rr['aimag'].id if rr['aimag'] else '',
                    'unit_score': rr['unit_score'],
                    'needs_review': int(rr['needs_review']),
                })
        with open(csv_path, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else
                               ['volume', 'page', 'line', 'name', 'name_eng', 'type',
                                'type_id', 'aimag', 'sum', 'sum_id', 'aimag_id',
                                'unit_score', 'needs_review'])
            w.writeheader(); w.writerows(rows)
        n = len(rows)
        self.stdout.write(self.style.SUCCESS(
            f'{csv_path}: {n} мөр, автомат {n_auto}/{n} '
            f'({100 * n_auto // n if n else 0}%), хяналт {n - n_auto}'))

    # ---- stage: commit ----
    def stage_commit(self, opts):
        _, csv_path = self._paths(opts)
        if not os.path.exists(csv_path):
            raise CommandError(f'csv олдсонгүй: {csv_path}')
        from core.models import GeoName, GeoNameSource, Constant, AdminUnit

        rows = list(csv.DictReader(open(csv_path)))
        apply = opts.get('apply')
        created = skipped = 0
        with transaction.atomic():
            for r in rows:
                # идемпотент: ижил (volume, page, line) аль хэдийн орсон эсэх.
                # NB: нэрээр давхардал шалгаж БОЛОХГҮЙ — нэг хуудсан дээр ижил нэртэй
                # ялгаатай бодит газрууд байдаг (ж: "Их арал" 3 өөр сум).
                if GeoNameSource.objects.filter(
                        volume=r['volume'], page=int(r['page']),
                        line=int(r['line']) if r['line'] else None).exists():
                    skipped += 1
                    continue
                if not apply:
                    created += 1
                    continue
                t = Constant.objects.filter(id=r['type_id']).first() if r['type_id'] else None
                g = GeoName.objects.create(
                    name=r['name'], name_eng=r['name_eng'] or None,
                    type=t, is_approved=True)
                units = [u for u in (r.get('aimag_id'), r.get('sum_id')) if u]
                if units:
                    g.unit.add(*AdminUnit.objects.filter(id__in=units))
                GeoNameSource.objects.create(
                    name=g, volume=r['volume'], page=int(r['page']),
                    line=int(r['line']) if r['line'] else None,
                    raw_text=f"{r['name']} | {r['aimag']} {r['sum']}",
                    confidence=float(r['unit_score']) if r['unit_score'] else None,
                    needs_review=bool(int(r['needs_review'])))
                created += 1
            if not apply:
                transaction.set_rollback(True)
        verb = 'Үүсгэх (бодит)' if apply else 'Үүсгэх БОЛОМЖТОЙ (dry-run)'
        self.stdout.write(self.style.SUCCESS(
            f'{verb}: {created}, алгассан(давхардсан): {skipped}'))
        if not apply:
            self.stdout.write('Бодитоор бичихийн тулд --apply нэмнэ үү.')

    def handle(self, *args, **opts):
        getattr(self, 'stage_' + opts['stage'])(opts)
