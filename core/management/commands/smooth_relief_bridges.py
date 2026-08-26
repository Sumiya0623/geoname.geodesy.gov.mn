"""Нэгтгэлтийн үед үүссэн УРТ ШУЛУУН гүүрүүдийг Безье муруйгаар солино.

merge_relief_contours‑ийн эхний хувилбар завсрыг ST_MakeLine‑аар буюу шулуунаар
гүүрлэдэг байсан. 40–60 м‑ийн завсарт энэ нь үл мэдэгдэх ч 500 м‑ээс урт
завсарт илт харагдаж, DEM дээр хиймэл шулуун ирмэг үүсгэдэг.

Хаяалбарын ердийн оройн хоорондын зай 98% тохиолдолд ≤60 м (өндөр 2060 дээр
1.41 сая сегментийн хэмжилт). Иймд ЗААГ (--threshold, анхдагч 120 м)‑аас урт
сегмент нь бараг тодорхойгүйгээр гүүр мөн — түүнийг хоёр талын шүргэгчээс
байгуулсан кубик Безье муруйгаар солино.

    python manage.py smooth_relief_bridges --dry-run
    python manage.py smooth_relief_bridges --threshold 120
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction

FN_SQL = """
CREATE OR REPLACE FUNCTION smooth_long_segments(g geometry, thr float8)
RETURNS geometry LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  pts geometry[]; out_pts geometry[]; cur geometry[];
  n int; i int; k int; a geometry; b geometry;
BEGIN
  -- ST_PointN‑ийг давталтад дуудвал квадрат зардалтай тул оройг НЭГ удаа
  -- массив болгож аваад индексээр хандана.
  pts := ARRAY(SELECT dp.geom FROM ST_DumpPoints(g) dp ORDER BY dp.path);
  n := array_length(pts, 1);
  IF n IS NULL OR n < 2 THEN RETURN g; END IF;
  out_pts := ARRAY[pts[1]];
  FOR i IN 1..n-1 LOOP
    a := pts[i]; b := pts[i+1];
    IF ST_Distance(a, b) > thr THEN
      -- шүргэгчийн лавлах орой: гүүрийн хоёр талаас 3 орой (~50–90 м)
      cur := ARRAY(SELECT (ST_DumpPoints(bridge_curve(
               a, pts[GREATEST(1, i-3)], b, pts[LEAST(n, i+4)]))).geom);
      IF cur IS NOT NULL AND array_length(cur,1) > 2 THEN
        FOR k IN 2..array_length(cur,1)-1 LOOP
          out_pts := out_pts || cur[k];
        END LOOP;
      END IF;
    END IF;
    out_pts := out_pts || b;
  END LOOP;
  RETURN ST_SetSRID(ST_MakeLine(out_pts), ST_SRID(g));
END $fn$;
"""


class Command(BaseCommand):
	help = 'Урт шулуун гүүрүүдийг Безье муруйгаар солино.'

	def add_arguments(self, p):
		p.add_argument('--threshold', type=float, default=120.0,
			help='Энэ уртаас дээш сегментийг гүүр гэж үзнэ (анхдагч 120 м)')
		p.add_argument('-m', '--min-height', type=float, default=500.0)
		p.add_argument('--only', type=float, default=None)
		p.add_argument('--dry-run', action='store_true',
			help='Бичихгүй — зөвхөн засвар шаардлагатай мөрийг тоолно')

	def handle(self, *a, **o):
		thr, dry = o['threshold'], o['dry_run']
		with connection.cursor() as c:
			c.execute(FN_SQL)
			if o['only'] is not None:
				heights = [o['only']]
			else:
				c.execute('SELECT DISTINCT height FROM relief WHERE height >= %s '
					'ORDER BY height', [o['min_height']])
				heights = [r[0] for r in c.fetchall()]
			self.stdout.write(f'өндрийн утга: {len(heights)}  |  зааг {thr:g} м'
				+ ('  [DRY RUN]' if dry else ''))

			t0, tot, fixed = time.time(), 0, 0
			for i, h in enumerate(heights, 1):
				# урт сегмент АГУУЛСАН мөрийг л шүүнэ
				c.execute("""
					SELECT r.id FROM relief r WHERE r.height = %s AND EXISTS (
					  SELECT 1 FROM (
						SELECT ST_Distance(dp.geom,
						  lag(dp.geom) OVER (PARTITION BY dp.path[1] ORDER BY dp.path)) d
						FROM ST_DumpPoints(r.geom) dp) s WHERE s.d > %s)""", [h, thr])
				ids = [r[0] for r in c.fetchall()]
				tot += len(ids)
				if ids and not dry:
					with transaction.atomic():
						c.execute("""UPDATE relief SET geom = ST_Multi(ST_Force3D(
							smooth_long_segments(ST_LineMerge(geom), %s)))
							WHERE id = ANY(%s)""", [thr, ids])
						fixed += c.rowcount
				el = time.time() - t0
				if i % 20 == 0 or i == len(heights):
					self.stdout.write(f'[{i}/{len(heights)}] h={h:<7g} '
						f'засварласан {tot:,}  ETA {el/i*(len(heights)-i)/60:.1f} мин')
			self.stdout.write(self.style.SUCCESS(
				f'урт гүүртэй мөр: {tot:,} | бичсэн: {fixed:,} | '
				f'{(time.time()-t0)/60:.1f} мин'))
