"""Зөрчилтэй шошготой хаяалбарыг ШИЛЖИЛТИЙН ЦЭГ дээр нь таслана.

Нэгтгэлт заримдаа ӨӨР өндрийн хоёр хаяалбарыг холбочихдог. Ийм шугам дээр
шошгууд зөрнө — жишээ нь 1,045 км урт нэг мөр дээр 16 шошго «940», 11 нь «920»
гэж заасан. Ийм мөрийг шошго оноох алгоритм зөв татгалздаг ч тэр хэмжээний урт
өндөргүй үлддэг.

Бүх гүүрийг тайрч эх хэлтэрхий рүү нь буцаах нь БУРУУ: алдаа ганц газар байхад
уг мөрийн БҮХ нэгтгэлт (EAST‑ийн уртын 27%) алдагдана. Мөн 37 сая сегментийг эх
өгөгдөлтэй тулгах нь 460 ГБ‑аас их түр зай шаардаж бүтэлгүйтсэн.

Оронд нь МЭС ЗАСЛЫН арга: шошгуудыг шугамын дагуух байрлалаар нь эрэмбэлж,
өндөр өөрчлөгдсөн хоёр хөрш шошгын ДУНД цэгээр таслана. Ингэснээр нэгтгэлт
хадгалагдаж, хэсэг бүр өөрийн зөв өндрийг ШУУД авна.

    python manage.py split_conflicting_contours --dry-run
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
	help = 'Зөрчилтэй шошготой хаяалбарыг шилжилтийн цэг дээр таслана.'

	def add_arguments(self, p):
		p.add_argument('-r', '--radius', type=float, default=100.0)
		p.add_argument('-m', '--min-height', type=float, default=500.0)
		p.add_argument('--min-part', type=float, default=200.0,
			help='Үүнээс богино хэсгийг гаргахгүй, м (анхдагч 200)')
		p.add_argument('--dry-run', action='store_true')

	def handle(self, *a, **o):
		t0 = time.time()
		with connection.cursor() as c:
			# Нэгтгэсний дараа хаяалбар олон мянган оройтой болсон тул шууд
			# орон зайн холболт хийвэл маш удаан — ST_Subdivide‑аар хуваана.
			self.stdout.write('зөрчилтэй мөрүүдийг хайж байна…')
			c.execute("""
				DROP TABLE IF EXISTS sc_sub;
				CREATE TEMP TABLE sc_sub AS
				SELECT id, ST_Subdivide(ST_Force2D(geom), 128) g
				FROM relief WHERE height IS NULL;
				CREATE INDEX ON sc_sub USING gist (g);
				ANALYZE sc_sub;""")
			c.execute("""
				CREATE TEMP TABLE sc_hit AS
				SELECT s.id rid, a.id aid, a.height h, a.pt
				FROM sc_sub s JOIN relief_anno a ON ST_DWithin(s.g, a.geom, %s)
				WHERE a.height >= %s AND mod(a.height::numeric, 10) = 0
				GROUP BY s.id, a.id, a.height, a.pt;
				CREATE INDEX ON sc_hit (rid);""", [o['radius'], o['min_height']])
			c.execute("""
				CREATE TEMP TABLE sc_bad AS
				SELECT rid FROM sc_hit GROUP BY rid HAVING count(DISTINCT h) > 1""")
			c.execute('SELECT count(*) FROM sc_bad')
			n_bad = c.fetchone()[0]
			c.execute("""SELECT round(sum(ST_Length(geom))/1000) FROM relief
			             WHERE id IN (SELECT rid FROM sc_bad)""")
			km_bad = c.fetchone()[0] or 0
			self.stdout.write(f'зөрчилтэй: {n_bad:,} мөр, {km_bad:,} км  ({time.time()-t0:.0f}с)')
			if not n_bad:
				return

			# Шошго бүрийн шугам дээрх байрлал (0..1). Олон хэсэгтэй мөрд
			# ХАМГИЙН ОЙР хэсэгт нь оноож, тэр хэсгийн дотор байрлалыг олно.
			c.execute("""
				CREATE TEMP TABLE sc_pos AS
				SELECT h.rid, p.i, h.h, ST_LineLocatePoint(p.g, h.pt) f
				FROM sc_hit h
				JOIN LATERAL (
				  SELECT d.path[1] i, d.geom g
				  FROM ST_Dump((SELECT ST_Force2D(geom) FROM relief WHERE id = h.rid)) d
				  ORDER BY ST_Distance(d.geom, h.pt) LIMIT 1) p ON TRUE
				WHERE h.rid IN (SELECT rid FROM sc_bad)""")
			c.execute('SELECT count(*) FROM sc_pos')
			self.stdout.write(f'байрлал бодогдсон шошго: {c.fetchone()[0]:,}  ({time.time()-t0:.0f}с)')

			# Зэргэлдээ (байрлалаар) шошгуудын өндөр өөрчлөгдөх бүрд ДУНД цэгээр
			# тасалж, хэсэг бүрийн өндрийг мөрөндөө оноож гаргана.
			c.execute("""
				CREATE TEMP TABLE sc_cut AS
				WITH s AS (
				  SELECT rid, i, h, f,
				         lag(h)  OVER w ph, lag(f) OVER w pf,
				         row_number() OVER w rn
				  FROM sc_pos WINDOW w AS (PARTITION BY rid, i ORDER BY f)),
				brk AS (
				  SELECT rid, i, (f + pf) / 2 AS cut FROM s WHERE ph IS NOT NULL AND ph <> h),
				bounds AS (
				  SELECT rid, i, 0::float8 cut FROM (SELECT DISTINCT rid, i FROM sc_pos) t
				  UNION ALL SELECT rid, i, cut FROM brk
				  UNION ALL SELECT rid, i, 1::float8 FROM (SELECT DISTINCT rid, i FROM sc_pos) t),
				seg AS (
				  SELECT rid, i, cut a, lead(cut) OVER (PARTITION BY rid, i ORDER BY cut) b
				  FROM bounds)
				SELECT seg.rid, seg.i, seg.a, seg.b,
				       (SELECT mode() WITHIN GROUP (ORDER BY p.h) FROM sc_pos p
				        WHERE p.rid = seg.rid AND p.i = seg.i AND p.f >= seg.a AND p.f < seg.b) h
				FROM seg WHERE seg.b IS NOT NULL AND seg.b > seg.a""")
			c.execute('SELECT count(*), count(*) FILTER (WHERE h IS NULL) FROM sc_cut')
			n_seg, n_null = c.fetchone()
			self.stdout.write(f'үүсэх хэсэг: {n_seg:,} (өндөргүй {n_null:,})')

			c.execute("""
				CREATE TEMP TABLE sc_new AS
				SELECT k.rid, k.h, ST_LineSubstring(d.geom, k.a, k.b) g
				FROM sc_cut k
				JOIN LATERAL (SELECT (ST_Dump(ST_Force2D(r.geom))).geom, (ST_Dump(ST_Force2D(r.geom))).path[1] p
				              FROM relief r WHERE r.id = k.rid) d ON d.p = k.i
				WHERE k.h IS NOT NULL""")
			c.execute("""DELETE FROM sc_new WHERE ST_Length(g) < %s""", [o['min_part']])
			c.execute('SELECT count(*), round(sum(ST_Length(g))/1000) FROM sc_new')
			n_new, km_new = c.fetchone()
			self.stdout.write(
				f'{n_bad:,} мөр ({km_bad:,} км) → {n_new:,} хэсэг ({km_new:,} км), '
				f'бүгд өндөртэй  ({time.time()-t0:.0f}с)')

			if o['dry_run']:
				self.stdout.write(self.style.WARNING('DRY RUN — юу ч бичсэнгүй'))
				return
			with transaction.atomic():
				c.execute('DELETE FROM relief WHERE id IN (SELECT DISTINCT rid FROM sc_new)')
				c.execute("""INSERT INTO relief (geom, confirmed, height_est, height_src)
				             SELECT ST_Multi(ST_Force3D(g)), FALSE, h, 'anno' FROM sc_new""")
				n = c.rowcount
			self.stdout.write(self.style.SUCCESS(
				f'{n:,} хэсэг бичигдлээ — өмнө нь өндөргүй байсан {km_bad:,} км '
				f'одоо шошготой боллоо  ({time.time()-t0:.0f}с)'))
