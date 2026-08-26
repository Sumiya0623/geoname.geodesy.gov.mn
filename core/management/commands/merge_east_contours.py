"""EAST (өндөргүй) хаяалбарын хэлтэрхийг ӨНДРӨӨР БҮЛЭГЛЭЛГҮЙ нэгтгэнэ.

WEST‑ийн [[merge_relief_contours]] нь ижил өндрөөр бүлэглэж ажилладаг. EAST‑д
өндөр огт байхгүй тул бүлэглэх боломжгүй — оронд нь орон зайн ХАВТАНГААР
хуваан, хавтан тус бүрд харилцан хамгийн ойр үзүүрүүдийг гүүрлэнэ. Буруу
хосыг ОГТЛОЛЦЛЫН шалгуур зогсооно (хаяалбар хэзээ ч огтлолцдоггүй).

Хэмжсэн үр дүн (N44 E108, 1°×1°, tol 500, 3 давталт):
  хэсэг 51,484 → 15,918 (−69%), ХААЛТТАЙ тойм 8,069 → 15,111 (16% → 95%).
95% хаалттай болсноор үүрлэлтийн (nesting) топологи барих боломжтой болно —
шошгоос өндөр тараахад энэ нь зайлшгүй.

    python manage.py merge_east_contours --list          # хавтангуудыг хэвлэнэ
    python manage.py merge_east_contours --tile 12,64    # нэг хавтан
    python manage.py merge_east_contours                 # бүгд (удаан!)
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction

TILE = 80000.0          # хавтангийн хэмжээ, метр (~1° өргөрөгт)

PASS_SQL = """
DROP TABLE IF EXISTS mrg_ep, mrg_nn, mrg_br, mrg_p2;
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
  SELECT o.eid FROM mrg_ep o WHERE o.eid <> e.eid AND ST_DWithin(e.g, o.g, %(tol)s)
  ORDER BY e.g <-> o.g LIMIT 1) x;
CREATE TEMP TABLE mrg_br AS SELECT
    CASE WHEN ST_Distance(a.g, b.g) <= %(curve)s THEN ST_MakeLine(a.g, b.g)
         ELSE coalesce(bridge_curve(a.g, a.pv, b.g, b.pv), ST_MakeLine(a.g, b.g))
    END g, ST_Distance(a.g, b.g) d
  FROM mrg_nn p JOIN mrg_nn q ON p.oid = q.eid AND q.oid = p.eid AND p.eid < q.eid
  JOIN mrg_ep a ON a.eid = p.eid JOIN mrg_ep b ON b.eid = q.eid
  WHERE ST_Distance(a.g, b.g) <= %(straight)s
     OR (angdiff(ST_Azimuth(a.pv, a.g), ST_Azimuth(a.g, b.g)) < %(ang)s
     AND angdiff(ST_Azimuth(b.pv, b.g), ST_Azimuth(b.g, a.g)) < %(ang)s);
CREATE INDEX ON mrg_br USING gist(g);
ANALYZE mrg_br;
-- ОГТЛОЛЦЛЫН ШАЛГУУР. Богино гүүр (<%(skip)s м) бараг хэзээ ч юу ч огтолдоггүй
-- тул шалгахгүй — энэ нь ажлын хугацааг хэд дахин богиносгоно.
CREATE INDEX ON mrg_part USING gist(g);
ANALYZE mrg_part;
DELETE FROM mrg_br b WHERE b.d > %(skip)s AND EXISTS (
  SELECT 1 FROM mrg_part p WHERE p.g && b.g AND ST_Crosses(p.g, b.g));
DELETE FROM mrg_br b WHERE b.d > %(skip)s AND EXISTS (
  SELECT 1 FROM mrg_br o WHERE o.ctid <> b.ctid AND o.g && b.g AND ST_Crosses(o.g, b.g));
CREATE TEMP TABLE mrg_p2 AS SELECT (ST_Dump(ST_LineMerge(ST_Collect(g)))).geom g
  FROM (SELECT g FROM mrg_part UNION ALL SELECT g FROM mrg_br) u;
DROP TABLE mrg_part;
ALTER TABLE mrg_p2 RENAME TO mrg_part;
"""


class Command(BaseCommand):
	help = 'EAST хаяалбарын хэлтэрхийг хавтангаар нэгтгэнэ (өндөр шаардахгүй).'

	def add_arguments(self, p):
		p.add_argument('-t', '--tolerance', type=float, default=500.0)
		p.add_argument('-p', '--passes', type=int, default=3)
		p.add_argument('--curve-above', type=float, default=80.0)
		p.add_argument('--straight-below', type=float, default=500.0)
		p.add_argument('--max-angle', type=float, default=135.0)
		p.add_argument('--skip-cross-below', type=float, default=100.0,
			help='Энэ уртаас БОГИНО гүүрт огтлолцлын шалгуур хийхгүй (анхдагч 100 м)')
		p.add_argument('--tile', default=None, help='Зөвхөн энэ хавтан: "tx,ty"')
		p.add_argument('--list', action='store_true', help='Хавтангуудыг хэвлээд гарна')
		p.add_argument('--seam', action='store_true',
			help='ЗААГ ООХ горим. Хавтангаар боловсруулахад нэг хаяалбарын '
			     'хэсгүүд өөр өөр хавтанд орж (хэсэг бүр ӨӨРИЙНХӨӨ төвөөр '
			     'хуваарилагддаг), хавтангийн зааг дээр холбогдоогүй үлддэг. '
			     'Энэ горим нь хавтангүйгээр, ЗӨВХӨН үзүүр нь бараг давхцаж '
			     'байгаа мөрүүдийг олж нэгтгэнэ (--seam-tol, анхдагч 1 м).')
		p.add_argument('--seam-tol', type=float, default=1.0,
			help='Зааг оох зай, метр (анхдагч 1). Хавтангийн зааг дээр хэсгүүд '
			     'ЯГ шүргэлцдэг тул бага утга л хангалттай — том утга нь өөр '
			     'хаяалбартай холбох эрсдэлтэй.')
		p.add_argument('--dry-run', action='store_true')

	def tiles(self, c):
		c.execute("""SELECT floor(ST_X(ST_Centroid(geom))/%s)::int tx,
		                    floor(ST_Y(ST_Centroid(geom))/%s)::int ty, count(*)
		             FROM relief WHERE height IS NULL
		             GROUP BY 1,2 HAVING count(*) > 0 ORDER BY count(*) DESC""",
		          [TILE, TILE])
		return c.fetchall()

	def seam(self, c, tol, dry):
		"""Хавтангийн зааг дээр тасарсан хаяалбарыг оёно."""
		t0 = time.time()
		c.execute("""
			DROP TABLE IF EXISTS s_ep, s_pair, s_new;
			CREATE TEMP TABLE s_ep AS
			SELECT t.id, p.pt g FROM (
			  SELECT id, (ST_Dump(ST_Force2D(geom))).geom g FROM relief WHERE height IS NULL
			) t, LATERAL (VALUES (ST_StartPoint(t.g)), (ST_EndPoint(t.g))) p(pt)
			WHERE NOT ST_IsClosed(t.g) AND ST_NPoints(t.g) >= 2;
			CREATE INDEX ON s_ep USING gist (g);
			ANALYZE s_ep;""")
		c.execute('SELECT count(*), count(DISTINCT id) FROM s_ep')
		n_ep, n_row = c.fetchone()
		self.stdout.write(f'нээлттэй мөр {n_row:,}, үзүүр {n_ep:,} ({time.time()-t0:.0f}с)')
		# ХАРИЛЦАН хамгийн ойр үзүүрийн хосыг л авна — нэг үзүүрт олон салаа
		# наалдаж Y‑уулзвар үүсэхээс сэргийлнэ (ST_LineMerge Y дээр нэгтгэхгүй).
		c.execute("""
			CREATE TEMP TABLE s_nn AS
			SELECT e.ctid ec, e.id, x.ctid oc, x.id oid FROM s_ep e, LATERAL (
			  SELECT o.ctid, o.id FROM s_ep o
			  WHERE o.id <> e.id AND ST_DWithin(e.g, o.g, %s)
			  ORDER BY e.g <-> o.g LIMIT 1) x""", [tol])
		c.execute("""
			CREATE TEMP TABLE s_pair AS
			SELECT DISTINCT least(p.id, q.id) ia, greatest(p.id, q.id) ib,
			       a.g ga, b.g gb
			FROM s_nn p JOIN s_nn q ON p.oc = q.ec AND q.oc = p.ec AND p.ec < q.ec
			JOIN s_ep a ON a.ctid = p.ec JOIN s_ep b ON b.ctid = q.ec""")
		c.execute('SELECT count(*) FROM s_pair')
		n_pair = c.fetchone()[0]
		c.execute("""SELECT count(DISTINCT id) FROM (
			SELECT ia id FROM s_pair UNION SELECT ib FROM s_pair) t""")
		n_touch = c.fetchone()[0]
		self.stdout.write(f'зааг дээр шүргэлцэх хос: {n_pair:,} | хамрагдах мөр: {n_touch:,}')
		if not n_pair:
			return
		# Шүргэлцэж буй мөрүүдийг НЭГ цуглуулга болгон ST_LineMerge хийнэ —
		# зөвхөн үзүүрээрээ нийлдэг шугамууд нэгдэнэ, бусад нь хэвээр салангид
		# хэсэг болж гарна. Гүүр нэмэхгүй тул шинэ геометр үүсэхгүй.
		# Үзүүр нь ЯГ давхцаагүй (хэдхэн см зөрүүтэй) бол ST_LineMerge холбохгүй
		# тул хосын хооронд МАШ БОГИНО гүүр (≤ tol) тавина.
		c.execute("""
			CREATE TEMP TABLE s_new AS
			SELECT (ST_Dump(ST_LineMerge(ST_Collect(g)))).geom g FROM (
			  SELECT ST_Force2D(geom) g FROM relief WHERE id IN (
			    SELECT ia FROM s_pair UNION SELECT ib FROM s_pair)
			  UNION ALL
			  SELECT ST_MakeLine(ga, gb) FROM s_pair WHERE NOT ST_Equals(ga, gb)
			) u""")
		c.execute('SELECT count(*), round(sum(ST_Length(g))/1000) FROM s_new')
		n_new, km_new = c.fetchone()
		c.execute("""SELECT round(sum(ST_Length(geom))/1000) FROM relief WHERE id IN (
			SELECT ia FROM s_pair UNION SELECT ib FROM s_pair)""")
		km_old = c.fetchone()[0]
		self.stdout.write(f'{n_touch:,} → {n_new:,} мөр | урт {km_old:,} → {km_new:,} км '
			f'(урт хадгалагдах ёстой)  ({time.time()-t0:.0f}с)')
		if dry:
			self.stdout.write(self.style.WARNING('DRY RUN — юу ч бичсэнгүй'))
			return
		with transaction.atomic():
			c.execute("""DELETE FROM relief WHERE id IN (
				SELECT ia FROM s_pair UNION SELECT ib FROM s_pair)""")
			c.execute('INSERT INTO relief (geom, confirmed) '
			          'SELECT ST_Multi(ST_Force3D(g)), FALSE FROM s_new')
			n = c.rowcount
		self.stdout.write(self.style.SUCCESS(
			f'зааг оёгдлоо: {n_touch:,} мөр устаж {n:,} мөр бичигдлээ. '
			f'ШОШГЫГ ДАХИН ОНООНО УУ (label_relief_from_anno)  ({time.time()-t0:.0f}с)'))

	def handle(self, *a, **o):
		with connection.cursor() as c:
			if o['seam']:
				self.seam(c, o['seam_tol'], o['dry_run'])
				return
			if o['list']:
				for tx, ty, n in self.tiles(c):
					self.stdout.write(f'{tx},{ty}\t{n}')
				return
			if o['tile']:
				tx, ty = (int(v) for v in o['tile'].split(','))
				c.execute("""SELECT count(*) FROM relief WHERE height IS NULL
				   AND floor(ST_X(ST_Centroid(geom))/%s)::int=%s
				   AND floor(ST_Y(ST_Centroid(geom))/%s)::int=%s""", [TILE, tx, TILE, ty])
				todo = [(tx, ty, c.fetchone()[0])]
			else:
				todo = self.tiles(c)
			par = dict(tol=o['tolerance'], curve=o['curve_above'],
			           straight=o['straight_below'], ang=o['max_angle'],
			           skip=o['skip_cross_below'])
			t0, tin, tout = time.time(), 0, 0
			for i, (tx, ty, n) in enumerate(todo, 1):
				c.execute('DROP TABLE IF EXISTS mrg_part')
				c.execute("""CREATE TEMP TABLE mrg_part AS
				   SELECT (ST_Dump(geom)).geom g FROM relief WHERE height IS NULL
				     AND floor(ST_X(ST_Centroid(geom))/%s)::int=%s
				     AND floor(ST_Y(ST_Centroid(geom))/%s)::int=%s""",
				          [TILE, tx, TILE, ty])
				c.execute('SELECT count(*) FROM mrg_part')
				n_in = c.fetchone()[0]
				if not n_in:
					continue
				for _ in range(o['passes']):
					c.execute(PASS_SQL, par)
				c.execute('SELECT count(*), count(*) FILTER (WHERE ST_IsClosed(g)) FROM mrg_part')
				n_out, n_cl = c.fetchone()
				tin += n_in; tout += n_out
				if not o['dry_run']:
					with transaction.atomic():
						c.execute("""DELETE FROM relief WHERE height IS NULL
						   AND floor(ST_X(ST_Centroid(geom))/%s)::int=%s
						   AND floor(ST_Y(ST_Centroid(geom))/%s)::int=%s""",
						          [TILE, tx, TILE, ty])
						c.execute('INSERT INTO relief (geom, confirmed) '
						          'SELECT ST_Multi(ST_Force3D(g)), FALSE FROM mrg_part')
				el = time.time() - t0
				self.stdout.write(
					f'[{i}/{len(todo)}] хавтан {tx},{ty}  {n_in:>7,} → {n_out:>7,} '
					f'({100 - 100 * n_out / n_in:4.1f}%)  хаалттай {100 * n_cl / n_out:4.1f}%  '
					f'ETA {el / i * (len(todo) - i) / 60:.0f} мин')
			self.stdout.write(self.style.SUCCESS(
				f'нийт {tin:,} → {tout:,} ({100 - 100 * tout / max(tin,1):.1f}%), '
				f'{(time.time() - t0) / 60:.1f} мин'))
