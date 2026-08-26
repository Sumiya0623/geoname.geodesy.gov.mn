"""Буруу нэгтгэгдсэн EAST хаяалбарыг ОЛЖ, гүүрийг нь тайрч салгана.

[[merge_east_contours]] нь тасархай хэсгүүдийг «гүүр»‑ээр холбодог. Гүүр бүрийг
огтлолцлын шалгуураар шүүдэг ч ХОЁР сул тал үлддэг:
  • шалгуур нь тухайн үеийн хэсгүүдтэй л харьцуулдаг — өөр давталтад/өөр
    хавтанд НЭМЭГДСЭН гүүртэй огтлолцохыг барихгүй;
  • хурдны үүднээс 100 м‑ээс богино гүүрт шалгуур хийдэггүй.

Илрүүлэлт (гурван бие даасан шинж, аль нэг нь хангалттай):
  A) ОГТЛОЛЦОЛ — хоёр хаяалбар бие биеэ огтолж байна (хаяалбар хэзээ ч
     огтлолцдоггүй; хэмжсэн: 0.47%);
  B) МӨЧЛӨГ — A тойм B‑гийн дотоод цэгийг, B нь A‑гийнхыг агуулж байна
     (үүрлэлт нь мод байх ёстой; хэмжсэн: 74,431);
  C) ЗӨРЧИЛТЭЙ ШОШГО — нэг хаяалбар дээр ӨӨР өндөр заасан хоёр шошго таарсан.

Засвар: гэмтэлтэй хаяалбар бүрийн ГҮҮРИЙГ тайрна. Гүүр гэдэг нь ЭХ өгөгдөлд
байгаагүй сегмент — `relief_east_raw` (эх gpkg‑ээс ачаалсан хэлтэрхийнүүд)‑тэй
харьцуулж ЯГ таг тодорхойлно. Гүүрийн уртаар (сегментийн урт) таних боломжгүй:
Безье гүүр 25 м‑ийн алхамтай зурагддаг ба энэ нь тоон дүрсэлсэн хаяалбарын
өөрийнх нь орой хоорондын зайтай (25–27 м) яг ижил.

Салгасны дараа хаяалбар завсартай болно — хуурамч огтлолцолтой байснаас ДЭЭР.

    python manage.py fix_bad_merges --dry-run
    python manage.py fix_bad_merges --tol 2
"""
import time
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

FIND_SQL = {
	# A) огтлолцол
	'cross': """
		CREATE TEMP TABLE bad_cross AS
		SELECT DISTINCT a.id FROM relief a JOIN relief b
		  ON a.id <> b.id AND a.geom && b.geom
		WHERE a.height IS NULL AND b.height IS NULL AND ST_Crosses(a.geom, b.geom)""",
	# B) мөчлөг — харилцан агуулалт
	'cycle': """
		CREATE TEMP TABLE ring2 AS
		SELECT r.id, ST_MakePolygon(l.g) poly, ST_PointOnSurface(ST_MakePolygon(l.g)) pt
		FROM relief r, LATERAL (SELECT (ST_Dump(ST_Force2D(r.geom))).geom g) l
		WHERE r.height IS NULL AND ST_IsClosed(l.g) AND ST_NPoints(l.g) >= 4;
		CREATE INDEX ON ring2 USING gist (poly);
		ANALYZE ring2;
		CREATE TEMP TABLE bad_cycle AS
		SELECT DISTINCT a.id FROM ring2 a JOIN ring2 b
		  ON a.id <> b.id AND a.poly && b.pt AND ST_Contains(a.poly, b.pt)
		WHERE b.poly && a.pt AND ST_Contains(b.poly, a.pt)""",
	# C) зөрчилтэй шошго. ⚠ Нэгтгэсний дараа хаяалбар 1000 км хүрч, олон мянган
	# оройтой болсон тул үндсэн хүснэгттэй шууд орон зайн холболт хийвэл маш
	# удаан (5+ мин ажиллаад дуусахгүй). ST_Subdivide‑аар ≤128 оройтой хэсэг
	# болгож хуваавал индекс нарийн шүүж, хэдхэн минутад бодогдоно.
	'anno': """
		CREATE TEMP TABLE east_sub AS
		SELECT id, ST_Subdivide(ST_Force2D(geom), 128) g
		FROM relief WHERE height IS NULL;
		CREATE INDEX ON east_sub USING gist (g);
		ANALYZE east_sub;
		CREATE TEMP TABLE bad_anno AS
		SELECT s.id FROM east_sub s
		JOIN relief_anno a ON ST_DWithin(s.g, a.geom, 100)
		WHERE a.height >= 500 AND mod(a.height::numeric, 10) = 0
		GROUP BY s.id HAVING count(DISTINCT a.height) > 1""",
}


class Command(BaseCommand):
	help = 'Буруу нэгтгэгдсэн хаяалбарын гүүрийг тайрч салгана.'

	def add_arguments(self, p):
		p.add_argument('-t', '--tol', type=float, default=2.0,
			help='Сегментийн дунд цэг эх хэлтэрхийнээс энэ зайд байвал ЭХ гэж '
			     'үзнэ; түүнээс хол бол ГҮҮР (анхдагч 2 м)')
		p.add_argument('--only', choices=['cross', 'cycle', 'anno'], default=None,
			help='Зөвхөн нэг төрлийн алдааг засна')
		p.add_argument('--limit', type=int, default=0,
			help='Хамгийн ихдээ энэ тооны хаяалбарыг засна (0 = бүгд)')
		p.add_argument('--dry-run', action='store_true')

	def handle(self, *a, **o):
		t0 = time.time()
		with connection.cursor() as c:
			c.execute("SELECT to_regclass('relief_east_raw')")
			if not c.fetchone()[0]:
				raise CommandError(
					'relief_east_raw хүснэгт алга. Эх хэлтэрхийг ачаална уу:\n'
					'  ogr2ogr -f PostgreSQL "PG:..." /home/administrator/relief_UTM48.gpkg '
					'-nln relief_east_raw -dialect SQLITE '
					'-sql \'SELECT geom FROM "east100k_central__hayalbarl"\'')

			kinds = [o['only']] if o['only'] else ['cross', 'cycle', 'anno']
			c.execute('DROP TABLE IF EXISTS bad_all')
			c.execute('CREATE TEMP TABLE bad_all (id bigint, kind text)')
			for k in kinds:
				self.stdout.write(f'{k} хайж байна…')
				for stmt in FIND_SQL[k].split(';'):
					if stmt.strip():
						c.execute(stmt)
				c.execute(f"INSERT INTO bad_all SELECT id, %s FROM bad_{k}", [k])
				c.execute(f'SELECT count(*) FROM bad_{k}')
				self.stdout.write(f'  {k}: {c.fetchone()[0]:,}  ({time.time()-t0:.0f}с)')
			c.execute('CREATE INDEX ON bad_all (id)')
			c.execute('SELECT count(DISTINCT id) FROM bad_all')
			n_bad = c.fetchone()[0]
			c.execute("""SELECT count(*), round(sum(ST_Length(geom))/1000)
			             FROM relief WHERE id IN (SELECT id FROM bad_all)""")
			nb, kmb = c.fetchone()
			self.stdout.write(self.style.WARNING(
				f'НИЙТ гэмтэлтэй: {n_bad:,} хаяалбар, {kmb:,} км'))

			lim = f'LIMIT {o["limit"]}' if o['limit'] else ''
			# Гүүрийн сегментийг ялгаж, ҮЛДСЭНийг нь дахин нэгтгэнэ.
			# Сегмент нь ЭХ өгөгдөлд байгаа эсэхийг дунд цэгээр нь шалгана —
			# үзүүр нь өөр хэсэгтэй давхцаж болох тул дунд цэг найдвартай.
			c.execute(f"""
				CREATE TEMP TABLE fixed AS
				WITH tgt AS (SELECT id, ST_Force2D(geom) g FROM relief
				             WHERE id IN (SELECT DISTINCT id FROM bad_all) {lim}),
				part AS (SELECT id, (ST_Dump(g)).geom g FROM tgt),
				seg AS (
				  SELECT p.id, s.i,
				         ST_MakeLine(ST_PointN(p.g, s.i), ST_PointN(p.g, s.i + 1)) sg
				  FROM part p, LATERAL generate_series(1, ST_NPoints(p.g) - 1) s(i)),
				keep AS (
				  SELECT sg.id, sg.sg FROM seg sg
				  WHERE EXISTS (SELECT 1 FROM relief_east_raw r
				                WHERE r.geom && ST_Expand(sg.sg, %s)
				                  AND ST_DWithin(r.geom, ST_LineInterpolatePoint(sg.sg, 0.5), %s)))
				SELECT id, (ST_Dump(ST_LineMerge(ST_Collect(sg)))).geom g
				FROM keep GROUP BY id""", [o['tol'], o['tol']])
			c.execute('SELECT count(DISTINCT id), count(*) FROM fixed')
			n_src, n_out = c.fetchone()
			c.execute("""SELECT round(sum(ST_Length(geom))/1000) FROM relief
			             WHERE id IN (SELECT DISTINCT id FROM fixed)""")
			km_in = c.fetchone()[0] or 0
			c.execute('SELECT round(sum(ST_Length(g))/1000) FROM fixed')
			km_out = c.fetchone()[0] or 0
			self.stdout.write(
				f'заслаа: {n_src:,} хаяалбар → {n_out:,} хэсэг | урт {km_in:,} → {km_out:,} км '
				f'(гүүрээр нэмэгдсэн {km_in - km_out:,} км хасагдав)  ({time.time()-t0:.0f}с)')

			if o['dry_run']:
				self.stdout.write(self.style.WARNING('DRY RUN — юу ч бичсэнгүй'))
				return
			with transaction.atomic():
				c.execute('DELETE FROM relief WHERE id IN (SELECT DISTINCT id FROM fixed)')
				c.execute("""INSERT INTO relief (geom, confirmed)
				             SELECT ST_Multi(ST_Force3D(g)), FALSE FROM fixed
				             WHERE ST_Length(g) > 0""")
				n = c.rowcount
			self.stdout.write(self.style.SUCCESS(
				f'{n_src:,} гэмтэлтэй хаяалбар устгагдаж, {n:,} цэвэр хэсэг '
				f'бичигдлээ  ({time.time()-t0:.0f}с)'))
