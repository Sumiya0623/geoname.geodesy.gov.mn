"""Шошгын (annotation) текстээс хаяалбарын өндрийг `height_est`‑д онооно.

Зурагзүйн жаяг ёсоор шошгын текст нь хаяалбарын ЗАВСАРТ (шугамыг тасалж)
байрладаг. [[merge_east_contours]] нь яг тэр завсрыг гүүрэлдэг тул НЭГТГЭСНИЙ
ДАРАА шошго нь хамаарах хаяалбартайгаа ОГТЛОЛЦОНО — энэ нь хамаарлыг эргэлзээгүй
болгодог хамгийн найдвартай шинж. Иймд эрэмбэ нь:

  1. шошготой ОГТЛОЛЦОХ хаяалбар ганц бол → шууд онооно;
  2. огтлолцохгүй ч --radius дотор ганц хаяалбар байвал → онооно;
  3. олон бол → хамгийн ойрыг нь авна (--nearest‑гүй бол алгасна).

Нэг хаяалбарт ӨӨР өндөр заасан хоёр шошго таарвал ЗӨРЧИЛ гэж үзэж алгасна.

Шошгын `height` талбарт зургийн бусад текст (хуудасны дугаар г.м.) орсон тул
--min-height (анхдагч 500 м, Монголын хамгийн нам цэг 518 м) шүүлтүүр хэрэгтэй.

    python manage.py label_relief_from_anno --dry-run
    python manage.py label_relief_from_anno --radius 100 --nearest
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
	help = 'Шошгын текстээс EAST хаяалбарын өндрийг height_est‑д онооно.'

	def add_arguments(self, p):
		p.add_argument('-r', '--radius', type=float, default=100.0,
			help='Огтлолцоогүй үед хайх радиус, метр (анхдагч 100)')
		p.add_argument('-m', '--min-height', type=float, default=500.0,
			help='Үүнээс НАМ шошгыг зургийн бусад текст гэж үзэн хаяна (анхдагч 500)')
		p.add_argument('--step', type=float, default=10.0,
			help='Хаяалбарын алхам; үүнд хуваагдахгүй шошгыг хаяна (анхдагч 10, 0=шалгахгүй)')
		p.add_argument('-k', '--shrink', type=float, default=0.7,
			help='Шошгын хүрээг нарийсгах коэффициент (анхдагч 0.7). Хүрээ нь '
			     'текстээ бүрхсэн ТЭГШ ӨНЦӨГТ тул булангаараа хөрш хаяалбарыг '
			     'барьдаг; k×(A/P) зайгаар сөрөг буфер хийж зөвхөн ГОЛ зурвасыг '
			     'үлдээнэ (тэгш өнцөгтөд A/P ≈ богино талын хагас).')
		p.add_argument('--pt-tol', type=float, default=20.0,
			help='Шошгын ТӨВ ЦЭГ хаяалбараас энэ зайд байвал тухайн хаяалбарынх '
			     'гэж үзнэ (анхдагч 20 м). Шошго өөрийн хаяалбарын завсарт '
			     'байрладаг тул төв цэг нь түүн дээр бараг яг таардаг.')
		p.add_argument('--vote', type=float, default=0.6,
			help='Нэг хаяалбар дээр өөр өндөр заасан шошго таарвал ОЛОНХИЙН '
			     'саналаар шийднэ; ялагч нь энэ хувиас дээш санал авсан үед л '
			     'оноогдоно (анхдагч 0.6). 1.0 бол зөвхөн санал нэгтэйг авна.')
		p.add_argument('--nearest', action='store_true',
			help='Олон нэр дэвшигчтэй үед хамгийн ойрыг нь сонгоно')
		p.add_argument('--dry-run', action='store_true')

	def handle(self, *a, **o):
		r, dry = o['radius'], o['dry_run']
		t0 = time.time()
		with connection.cursor() as c:
			cond = 'a.height >= %s'
			args = [o['min_height']]
			if o['step']:
				cond += ' AND mod(a.height::numeric, %s) = 0'
				args.append(o['step'])
			c.execute(f'SELECT count(*) FROM relief_anno a WHERE a.height IS NOT NULL AND {cond}', args)
			n_anno = c.fetchone()[0]
			c.execute('SELECT count(*) FROM relief_anno WHERE height IS NOT NULL')
			n_all = c.fetchone()[0]
			self.stdout.write(f'шошго: {n_all:,} → шүүлтээс давсан {n_anno:,} '
				f'(≥{o["min_height"]:g} м, {o["step"]:g}‑д хуваагдана)')

			# 1) огтлолцол, 2) радиус доторх — нэр дэвшигч бүрийг зэрэглэлтэйгээр
			# Хүрээг нарийсгана. Тэгш өнцөгт w×h‑д A/P = wh/(2(w+h)) ≈ h/2
			# (w ≫ h үед) тул k·A/P нь богино талын k хувь болно. Хэт
			# нарийссан (хоосон болсон) тохиолдолд шошгын цэг рүү шилжинэ.
			c.execute(f"""
				CREATE TEMP TABLE anno_g AS
				SELECT a.id, a.height h, a.pt, a.geom,
				  CASE WHEN ST_IsEmpty(b.g) OR b.g IS NULL THEN a.pt ELSE b.g END core
				FROM relief_anno a, LATERAL (SELECT ST_Buffer(a.geom,
				   -%s * ST_Area(a.geom) / NULLIF(ST_Perimeter(a.geom), 0)) g) b
				WHERE a.height IS NOT NULL AND {cond}""", [o['shrink']] + args)
			c.execute('CREATE INDEX ON anno_g USING gist (geom)')
			c.execute('ANALYZE anno_g')
			# EAST‑ийн геометр 3 хэмжээст (dim 3) тул үндсэн хүснэгт дээрх орон
			# зайн холболт удаан. Түүнээс ч дор нь — нэгтгэсний дараа зарим
			# хаяалбар 100 км‑ээс урт, олон мянган оройтой болсон тул тэдгээртэй
			# зай бодох нь маш үнэтэй (10+ мин ажиллаад дуусахгүй байсан).
			# ST_Subdivide нь тус бүрийг ≤128 оройтой хэсэг болгож хуваана —
			# индекс нарийн шүүж, зайн тооцоо зөвхөн богино геометр дээр хийгдэнэ.
			c.execute('CREATE TEMP TABLE east2d AS SELECT id, '
			          'ST_Subdivide(ST_Force2D(geom), 128) g '
			          'FROM relief WHERE height IS NULL')
			c.execute('CREATE INDEX ON east2d USING gist (g)')
			c.execute('ANALYZE east2d')
			# Хаяалбар хэд хэдэн хэсэг болж хуваагдсан тул id‑гаар нь буцааж
			# нэгтгэнэ: огтолсон эсэх = bool_or, зай = min.
			c.execute("""
				CREATE TEMP TABLE anno_cand AS
				SELECT g.id anno_id, g.h, r.id rid,
				       bool_or(ST_Intersects(r.g, g.core)) AS hit,
				       min(ST_Distance(r.g, g.pt)) AS dist
				FROM anno_g g
				JOIN east2d r ON ST_DWithin(r.g, g.geom, %s)
				GROUP BY 1, 2, 3""", [r])
			c.execute('SELECT count(*), count(DISTINCT anno_id) FROM anno_cand')
			n_pair, n_hit_anno = c.fetchone()
			self.stdout.write(f'нэр дэвшигч хос: {n_pair:,} | хаяалбар олдсон шошго: '
				f'{n_hit_anno:,} ({100 * n_hit_anno / max(n_anno,1):.0f}%)')

			# шошго бүрт ХАМГИЙН САЙН нэр дэвшигчийг сонгоно
			# Нэг шошгонд ноогдох нэр дэвшигчдийг НЭГ дамжлагаар (цонхны функц)
			# шүүнэ. Хамаарсан дэд асуулга ашиглавал 23 мянган шошго × олон мянган
			# хос дээр квадрат хугацаа зарцуулагдана.
			c.execute('CREATE INDEX ON anno_cand (anno_id)')
			c.execute('ANALYZE anno_cand')
			c.execute("""
				CREATE TEMP TABLE anno_pick AS
				SELECT DISTINCT ON (anno_id) anno_id, h, rid, hit, dist,
				       count(*) FILTER (WHERE hit) OVER (PARTITION BY anno_id) AS n_hit,
				       count(*) OVER (PARTITION BY anno_id) AS n_cand
				FROM anno_cand
				ORDER BY anno_id, hit DESC, dist""")
			c.execute("""SELECT
				count(*) FILTER (WHERE n_hit = 1),
				count(*) FILTER (WHERE n_hit > 1),
				count(*) FILTER (WHERE n_hit = 0 AND n_cand = 1),
				count(*) FILTER (WHERE n_hit = 0 AND n_cand > 1) FROM anno_pick""")
			h1, hm, c1, cm = c.fetchone()
			self.stdout.write(f'  огтлолцол ганц: {h1:,} | огтлолцол олон: {hm:,} | '
				f'радиуст ганц: {c1:,} | радиуст олон: {cm:,}')

			# Шошго нь ӨӨРИЙНХӨӨ хаяалбарын ЗАВСАРТ байрладаг тул түүний төв цэг
			# (pt) уг хаяалбар дээр бараг ЯГ таарна (хэмжсэн: 0.0 м). Хажуугийн
			# зэрэгдээ хаяалбарыг хүрээ нь барьсан ч төв цэг нь холдоно. Тиймээс
			# «зөвхөн нэг хаяалбартай огтолсон» гэсэн хатуу дүрмээс гадна
			# «төв цэг нь --pt-tol дотор» гэсэн шалгуурыг зөвшөөрнө.
			keep = (f'n_hit = 1 OR (n_hit = 0 AND n_cand = 1) '
			        f'OR (hit AND dist <= {o["pt_tol"]:g})')
			if o['nearest']:
				keep = 'TRUE'
			# ОЛОНХИЙН САНАЛ. Нэгтгэсний дараа хаяалбар 100+ км урт болсон тул
			# нэг хаяалбар олон шошготой таардаг. Аль нэг нь буруу уншигдсанаас
			# болж БҮХ хаяалбарыг хаях нь буруу — 7 шошго «1040», 1 нь «1060»
			# гэвэл хариулт нь илт. Ялагч нь саналын --vote‑оос дээш хувийг
			# авсан үед л оноогдоно; тэнцвэл (жишээ нь 1:1) алгасна.
			c.execute(f"""
				CREATE TEMP TABLE anno_vote AS
				SELECT rid, h, count(*) n FROM anno_pick WHERE {keep} GROUP BY rid, h;
				CREATE INDEX ON anno_vote (rid);""")
			c.execute("""
				CREATE TEMP TABLE anno_win AS
				SELECT DISTINCT ON (v.rid) v.rid, v.h, v.n,
				       (SELECT sum(x.n) FROM anno_vote x WHERE x.rid = v.rid) tot
				FROM anno_vote v ORDER BY v.rid, v.n DESC, v.h""")
			c.execute('SELECT count(*) FROM anno_win WHERE n = tot')
			unan = c.fetchone()[0]
			c.execute('SELECT count(*) FROM anno_win WHERE n < tot AND n::float/tot >= %s',
			          [o['vote']])
			won = c.fetchone()[0]
			c.execute('SELECT count(*) FROM anno_win WHERE n < tot AND n::float/tot < %s',
			          [o['vote']])
			conflict = c.fetchone()[0]
			n_row = unan + won
			self.stdout.write(
				f'  оноох хаяалбар: {n_row:,} (санал НЭГТЭЙ {unan:,} + олонхиор {won:,}) | '
				f'ЗӨРЧИЛТЭЙ, алгассан: {conflict:,}')

			if dry:
				return
			with transaction.atomic():
				c.execute("""
					UPDATE relief r SET height_est = t.h, height_src = 'anno'
					FROM (SELECT rid, h FROM anno_win
					      WHERE n = tot OR n::float / tot >= %s) t
					WHERE r.id = t.rid""", [o['vote']])
				n = c.rowcount
			c.execute("SELECT count(*), round(sum(ST_Length(geom))/1000) FROM relief "
				"WHERE height IS NULL AND height_src = 'anno'")
			nn, km = c.fetchone()
			c.execute("SELECT count(*), round(sum(ST_Length(geom))/1000) FROM relief WHERE height IS NULL")
			na, kma = c.fetchone()
			self.stdout.write(self.style.SUCCESS(
				f'height_est бичсэн: {n:,}  |  EAST‑ийн {100 * nn / max(na,1):.1f}% мөр, '
				f'{100 * km / max(kma,1):.1f}% урт шошготой боллоо  ({time.time() - t0:.0f} с)'))
