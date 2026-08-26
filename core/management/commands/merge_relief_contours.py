"""Тасархай хаяалбаруудыг ижил өндрөөр нь бүлэглэж, завсрыг гүүрлэн нэгтгэнэ.

Эх өгөгдөл дээр нэг хаяалбар олон зуун хэсэг болж тасарсан байдаг: хэсгийн
дундаж урт ~400 м, хоорондын завсар ~40–60 м. Үзүүр нь ЯГ давхцаагүй тул
ST_LineMerge дангаараа бараг юу ч хийхгүй (1% бууралт).

Алгоритм (өндөр бүрээр, --passes удаа давтана):
  1. Бүх хэсгийн үзүүр цэгүүдийг гаргана.
  2. Үзүүр бүрийн хамгийн ойр хосыг --tolerance дотроос олно.
  3. ЗӨВХӨН ХАРИЛЦАН хамгийн ойр хосыг гүүрэн шугамаар холбоно — ингэснээр
     нэг үзүүрт олон салаа наалдаж Y‑уулзвар үүсэхээс сэргийлнэ (Y‑уулзвар
     дээр ST_LineMerge нэгтгэж чадахгүй).
  4. Эх хэсгүүд + гүүрүүдийг ST_LineMerge‑ээр нэгтгэнэ.

Хэмжсэн үр дүн (өндөр 1230, 24,848 хэсэг, tolerance 100 м, 2 давталт):
  хэсэг 24,848 → 5,757 (−77%), урт 8,664 → 9,825 км (завсар нөхөгдсөн),
  хаалттай тойм 75% болсон — хаяалбарын байгалийн топологи сэргэсэн.

    python manage.py merge_relief_contours --dry-run
    python manage.py merge_relief_contours -t 100 -p 2
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction

BRIDGE_FN_SQL = """
-- Хоёр үзүүрийг ШУЛУУНААР биш, кубик Безье МУРУЙГААР холбоно. Хяналтын цэгийг
-- үзүүр бүрийн шүргэгч чиглэлд d/3 зайд байрлуулснаар муруй нь шугамын
-- чиглэлийг үргэлжлүүлж гарч, нөгөө талдаа мөн чиглэлийнх нь дагуу орж ирнэ.
-- (Шулуун гүүр 500 м‑ээс урт завсарт илт харагдаж, DEM дээр хиймэл шулуун
-- ирмэг үүсгэдэг.)
CREATE OR REPLACE FUNCTION bridge_curve(a geometry, apv geometry,
                                        b geometry, bpv geometry,
                                        seg_len double precision DEFAULT 25)
RETURNS geometry LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  ax float8; ay float8; bx float8; byy float8; d float8; l float8;
  ux float8; uy float8; vx float8; vy float8;
  p1x float8; p1y float8; p2x float8; p2y float8; n int;
BEGIN
  ax := ST_X(a); ay := ST_Y(a); bx := ST_X(b); byy := ST_Y(b);
  d := sqrt((bx-ax)^2 + (byy-ay)^2);
  IF d = 0 THEN RETURN NULL; END IF;
  ux := ax - ST_X(apv); uy := ay - ST_Y(apv); l := sqrt(ux^2+uy^2);
  IF l = 0 THEN ux := (bx-ax)/d; uy := (byy-ay)/d; ELSE ux := ux/l; uy := uy/l; END IF;
  vx := bx - ST_X(bpv); vy := byy - ST_Y(bpv); l := sqrt(vx^2+vy^2);
  IF l = 0 THEN vx := (ax-bx)/d; vy := (ay-byy)/d; ELSE vx := vx/l; vy := vy/l; END IF;
  p1x := ax + ux*d/3; p1y := ay + uy*d/3;
  p2x := bx + vx*d/3; p2y := byy + vy*d/3;
  n := GREATEST(4, LEAST(64, ceil(d/seg_len)::int));
  RETURN ST_SetSRID(ST_MakeLine(ARRAY(
    SELECT ST_MakePoint(
      (1-t)^3*ax + 3*(1-t)^2*t*p1x + 3*(1-t)*t^2*p2x + t^3*bx,
      (1-t)^3*ay + 3*(1-t)^2*t*p1y + 3*(1-t)*t^2*p2y + t^3*byy, 0)
    FROM (SELECT i::float8/n AS t FROM generate_series(0, n) i ORDER BY 1) q)), 32648);
END $fn$;
"""

ANGDIFF_SQL = """
CREATE OR REPLACE FUNCTION angdiff(a double precision, b double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT LEAST(abs(degrees(a - b)), 360 - abs(degrees(a - b)));
$$;
"""

PASS_SQL = """
DROP TABLE IF EXISTS mrg_ep, mrg_nn, mrg_br, mrg_p2;
-- ХААЛТТАЙ ЦАГИРГИЙГ ХАСНА: тэдгээрийн эхлэл = төгсгөл тул өөртэйгөө 0 урттай
-- «гүүр» үүсгээд, огтлолцлын шалгуурыг дэмий ачаалдаг (2500 м дээр 5,324
-- гүүрийн 3,807 нь ийм байсан — шалгуур 37 с‑ээс 2 с болж багассан).
-- Хаалттай тойм аль хэдийн бүтэн хаяалбар тул цаашид нэгтгэх зүйлгүй.
-- pv = үзүүрийн ӨМНӨХ орой. Түүнээс үзүүр рүү чиглэсэн вектор нь шугамын
-- «гарах чиглэл» — урт гүүрийг зөвшөөрөх эсэхийг үүгээр шалгана.
-- pv = үзүүрээс ~50 м ДОТОГШ орших цэг. Зэргэлдээ оройг авбал тоон зурагжуулалтын
-- чимээ шуугиан шүргэгчийг гажуудуулдаг тул тодорхой зай ухрааж авна.
CREATE TEMP TABLE mrg_ep AS SELECT row_number() OVER () eid, p.pt g, p.pv pv
  FROM mrg_part, LATERAL (SELECT LEAST(0.5, 50.0/GREATEST(ST_Length(g), 1)) f) k,
    LATERAL (VALUES
      (ST_StartPoint(g), ST_LineInterpolatePoint(g, k.f)),
      (ST_EndPoint(g),   ST_LineInterpolatePoint(g, 1 - k.f))
    ) p(pt, pv)
  WHERE NOT ST_IsClosed(mrg_part.g) AND ST_NPoints(mrg_part.g) >= 2
    AND ST_Length(mrg_part.g) > 0;
CREATE INDEX ON mrg_ep USING gist(g);
ANALYZE mrg_ep;
CREATE TEMP TABLE mrg_nn AS SELECT e.eid, x.eid oid FROM mrg_ep e, LATERAL (
  SELECT o.eid FROM mrg_ep o WHERE o.eid <> e.eid AND ST_DWithin(e.g, o.g, %s)
  ORDER BY e.g <-> o.g LIMIT 1) x;
-- ЧИГЛЭЛИЙН ШАЛГУУР зөвхөн МАШ УРТ гүүрт (--straight-below‑оос дээш).
-- Хаяалбар жалга, хамарт хурц эргэлт хийдэг тул өнцгийн шалгуур энэ өгөгдөлд
-- ЗАРЧМЫН ХУВЬД СУЛ: 5388730/5388685 (1740 м, 171 м завсар, огтлолцолгүй) хос
-- зөвхөн B талын шүргэгч 121° байсны улмаас буруугаар татгалзсан. Иймд заагийг
-- сулруулж (--max-angle), богино/дунд завсарт бүрмөсөн алгасна — найдвартай
-- шалгуур нь огтлолцлын тест.
CREATE TEMP TABLE mrg_br AS SELECT
    CASE WHEN ST_Distance(a.g, b.g) <= %s THEN ST_MakeLine(a.g, b.g)
         ELSE coalesce(bridge_curve(a.g, a.pv, b.g, b.pv), ST_MakeLine(a.g, b.g))
    END g
  FROM mrg_nn p JOIN mrg_nn q ON p.oid = q.eid AND q.oid = p.eid AND p.eid < q.eid
  JOIN mrg_ep a ON a.eid = p.eid JOIN mrg_ep b ON b.eid = q.eid
  WHERE ST_Distance(a.g, b.g) <= %s
     OR (angdiff(ST_Azimuth(a.pv, a.g), ST_Azimuth(a.g, b.g)) < %s
     AND angdiff(ST_Azimuth(b.pv, b.g), ST_Azimuth(b.g, a.g)) < %s);
-- ТОПОЛОГИЙН ШАЛГУУР: хаяалбарууд хэзээ ч огтлолцдоггүй. Хэрэв гүүр ӨӨР
-- өндрийн хаяалбарыг огтолж байвал энэ нь буруу хос — устгана. (Өндөргүй
-- EAST өгөгдлийг шалгуурт оруулахгүй — давхцах бүсэд худал татгалзал өгнө.)
-- ГҮҮРИЙН ХҮЧИНТЭЙ БАЙДЛЫН ШАЛГУУР. Хаяалбар нь ӨӨРТЭЙГӨӨ ч, өөр
-- хаяалбартай ч ХЭЗЭЭ Ч огтлолцдоггүй — энэ бол хатуу топологийн хууль.
--   (a) ижил өндрийн ЛЮБОЙ хэсгийг огтлох (өөрийгөө оруулаад) — ST_Crosses.
--       Холбогдож буй хоёр хэсэгтэйгээ гүүр нь ҮЗҮҮРЭЭРЭЭ шүргэлцэх нь
--       хэвийн тул ST_Intersects биш ST_Crosses хэрэглэнэ (ST_Crosses нь
--       зөвхөн ДОТООД огтлолцлыг үнэн гэж үзнэ).
--   (b) ±150 м доторх ӨӨР өндрийн хаяалбарт хүрэх — энд шүргэлцэх ч болохгүй
--       тул ST_Intersects. (2 км‑ийн гүүр ±150 м‑ээс хол өндөртэй огтлолцох
--       боломжгүй, мөн нэгтгэсэн хаяалбарын bbox том тул хязгаар нь хурдны
--       үүднээс ч хэрэгтэй.)
--   (c) өөр ГҮҮРИЙГ огтлох — хоёуланг нь хаяна.
CREATE INDEX ON mrg_part USING gist(g);
ANALYZE mrg_part;
DELETE FROM mrg_br b WHERE
  EXISTS (SELECT 1 FROM mrg_part p WHERE p.g && b.g AND ST_Crosses(p.g, b.g))
  OR EXISTS (SELECT 1 FROM relief r
       WHERE r.height BETWEEN %s - 150 AND %s + 150 AND r.height <> %s
         AND r.geom && b.g AND ST_Intersects(r.geom, b.g));
DELETE FROM mrg_br b WHERE EXISTS (
  SELECT 1 FROM mrg_br o WHERE o.ctid <> b.ctid AND o.g && b.g AND ST_Crosses(o.g, b.g));
CREATE TEMP TABLE mrg_p2 AS SELECT (ST_Dump(ST_LineMerge(ST_Collect(g)))).geom g
  FROM (SELECT g FROM mrg_part UNION ALL SELECT g FROM mrg_br) u;
DROP TABLE mrg_part;
ALTER TABLE mrg_p2 RENAME TO mrg_part;
"""


class Command(BaseCommand):
	help = 'Ижил өндөртэй тасархай хаяалбаруудыг завсрыг гүүрлэн нэгтгэнэ.'

	def add_arguments(self, p):
		p.add_argument('-t', '--tolerance', type=float, default=100.0,
			help='Гүүрлэх дээд зай, метр (анхдагч 100). Үүнээс дээш утга дээр '
			     'огтлолцлын шалгуур чухал болно — 1000 м‑т гүүрийн 21%% нь өөр '
			     'өндрийн хаяалбарыг огтолж байсан.')
		p.add_argument('-p', '--passes', type=int, default=2,
			help='Давталтын тоо (анхдагч 2; 3 дахь давталтад өөрчлөлт гарахгүй)')
		p.add_argument('-m', '--min-height', type=float, default=500.0,
			help='Энэ өндрөөс дээш хаяалбарыг л боловсруулна (анхдагч 500)')
		p.add_argument('--dry-run', action='store_true',
			help='Бичихгүй — өндөр бүрийн бууралтыг л хэвлэнэ')
		p.add_argument('-s', '--straight-below', type=float, default=500.0,
			help='Энэ уртаас БОГИНО гүүрт чиглэлийн шалгуур хийхгүй (анхдагч 500 м)')
		p.add_argument('--curve-above', type=float, default=80.0,
			help='Энэ уртаас ДЭЭШ гүүрийг Безье муруйгаар зурна (анхдагч 80 м). '
			     'Үүнээс богино завсарт шулуун нь үл мэдэгдэнэ.')
		p.add_argument('--max-angle', type=float, default=135.0,
			help='Урт гүүрийн зөвшөөрөх дээд өнцгийн зөрүү, градус (анхдагч 135)')
		p.add_argument('--only', type=float, default=None,
			help='Зөвхөн энэ нэг өндрийг боловсруулна (тест хийхэд)')

	def handle(self, *a, **o):
		tol, passes, dry = o['tolerance'], o['passes'], o['dry_run']
		with connection.cursor() as c:
			c.execute(BRIDGE_FN_SQL)
			c.execute(ANGDIFF_SQL)
			if o['only'] is not None:
				heights = [o['only']]
			else:
				c.execute('SELECT DISTINCT height FROM relief WHERE height >= %s '
					'ORDER BY height', [o['min_height']])
				heights = [r[0] for r in c.fetchall()]
			self.stdout.write(f'өндрийн утга: {len(heights)}  |  зай ≤{tol:g} м  |  '
				f'давталт {passes}' + ('  [DRY RUN]' if dry else ''))

			t0, tot_in, tot_out = time.time(), 0, 0
			for i, h in enumerate(heights, 1):
				c.execute('DROP TABLE IF EXISTS mrg_part')
				c.execute('CREATE TEMP TABLE mrg_part AS SELECT (ST_Dump(geom)).geom g '
					'FROM relief WHERE height = %s', [h])
				c.execute('SELECT count(*) FROM mrg_part')
				n_in = c.fetchone()[0]
				if n_in == 0:
					continue
				for _ in range(passes):
					c.execute(PASS_SQL, [tol, o['curve_above'], o['straight_below'],
						o['max_angle'], o['max_angle'], h, h, h])
				c.execute('SELECT count(*) FROM mrg_part')
				n_out = c.fetchone()[0]
				tot_in += n_in
				tot_out += n_out

				if not dry:
					with transaction.atomic():
						c.execute('DELETE FROM relief WHERE height = %s', [h])
						c.execute('INSERT INTO relief (height, geom, confirmed) '
							'SELECT %s, ST_Multi(ST_Force3D(g)), FALSE FROM mrg_part', [h])

				el = time.time() - t0
				eta = el / i * (len(heights) - i)
				self.stdout.write(f'[{i}/{len(heights)}] h={h:<7g} {n_in:>7,} → '
					f'{n_out:>7,}  ({100 - 100 * n_out / n_in:4.1f}%)  '
					f'ETA {eta / 60:.1f} мин')

			c.execute('DROP TABLE IF EXISTS mrg_part')
			pct = 100 - 100 * tot_out / tot_in if tot_in else 0
			self.stdout.write(self.style.SUCCESS(
				f'нийт {tot_in:,} → {tot_out:,} хэсэг ({pct:.1f}% бууралт), '
				f'{(time.time() - t0) / 60:.1f} мин'))
			if not dry:
				self.stdout.write('ДАРАА НЬ: VACUUM ANALYZE relief; (устсан мөрийн '
					'зайг чөлөөлнө)')
