"""EAST хаяалбарын өндрийг ҮҮРЛЭЛТЭЭР тараана (шошго + өндрийн цэг + топологи).

Зарчим — зургийн ДОТООД мэдээллээр л ажиллана, DEM хэрэггүй:

  • ШОШГО (`height_est`, [[label_relief_from_anno]]) нь АБСОЛЮТ түвшинг өгнө.
  • ҮҮРЛЭЛТ нь АЛХМЫН ТООГ өгнө: нэг гинжин дэх зэргэлдээ хоёр тойм яг нэг
    интервалаар зөрнө (хэмжсэн: шошготой эцэг‑хүү хосын 66% нь яг ±20 м).
  • ӨНДРИЙН ЦЭГ (`DemPoint`) нь ЧИГЛЭЛИЙГ өгнө: гинж дотогшоо өндөрсөж
    байна уу (оргил) эсвэл нам буурч байна уу (хотгор). Хэмжсэнээр +20 ба
    −20 хоёулаа тохиолддог тул чиглэлийг таамаглаж болохгүй.

Жишээ (хэрэглэгчийн ажигласан): «1500» шошготой тоймын дээр 1545 м‑ийн
өндрийн цэг байвал хооронд нь 2 тойм = 1520, 1540 болно.

Үр дүн `height_est`/`height_src` баганад бичигдэнэ ('anno' утгыг ДАРЖ БИЧИХГҮЙ):
  'nest'     — шошгот тулгуураас үүрлэлтээр тоологдсон
  'nest_dem' — өндрийн цэгээс үүрлэлтээр тоологдсон
Зөрчилтэйг нь бичихгүй, зөвхөн тоолж мэдээлнэ.

    python manage.py height_from_nesting --dry-run      # зөвхөн хэмжинэ
    python manage.py height_from_nesting --rebuild      # тойм/модыг дахин барина
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction

RING_SQL = """
DROP TABLE IF EXISTS e_ring;
CREATE TABLE e_ring AS
-- ⚠ ЗӨВХӨН шошгоос гарсан ('anno') утгыг тулгуур болгоно. `height_est` дотор
-- ӨМНӨХ тараалтын үр дүн (nest / nest_dem) бас байдаг — түүнийг тулгуур болговол
-- өөрийн таамаглалаа өөрөөрөө «шалгах» дугуй логик үүсч, шалгалт худал өндөр
-- гарна (91% гэж харагдсан нь яг ийм шалтгаантай байв).
SELECT r.id, CASE WHEN r.height_src = 'anno' THEN r.height_est END anno_h,
       ST_MakePolygon(l.g) poly, ST_Area(ST_MakePolygon(l.g)) ar,
       ST_PointOnSurface(ST_MakePolygon(l.g)) pt
FROM relief r, LATERAL (SELECT (ST_Dump(ST_Force2D(r.geom))).geom g) l
WHERE r.height IS NULL AND ST_IsClosed(l.g) AND ST_NPoints(l.g) >= 4;
CREATE INDEX e_ring_poly_idx ON e_ring USING gist (poly);
CREATE INDEX e_ring_pt_idx ON e_ring USING gist (pt);
CREATE INDEX e_ring_id_idx ON e_ring (id);
ANALYZE e_ring;
"""

PAR_SQL = """
DROP TABLE IF EXISTS e_par;
CREATE TABLE e_par AS
SELECT c.id, c.anno_h, c.ar, p.id parent_id
FROM e_ring c LEFT JOIN LATERAL (
  SELECT x.id FROM e_ring x
  WHERE x.id <> c.id AND x.poly && c.pt AND ST_Contains(x.poly, c.pt)
  ORDER BY x.ar LIMIT 1) p ON TRUE;
CREATE INDEX e_par_id_idx ON e_par (id);
CREATE INDEX e_par_par_idx ON e_par (parent_id);
ANALYZE e_par;
"""

# Өндрийн цэг бүрийг агуулах ХАМГИЙН ЖИЖИГ тойм — гинжний хамгийн дотоод гишүүн.
DEM_SQL = """
DROP TABLE IF EXISTS e_dem;
CREATE TABLE e_dem AS
SELECT d.id dem_id, d.height dem_h, r.id ring_id
FROM dem_point d, LATERAL (
  SELECT x.id, x.ar FROM e_ring x
  WHERE x.poly && ST_Force2D(d.geom) AND ST_Contains(x.poly, ST_Force2D(d.geom))
  ORDER BY x.ar LIMIT 1) r
WHERE d.height IS NOT NULL AND d.height >= 500;
CREATE INDEX e_dem_ring_idx ON e_dem (ring_id);
ANALYZE e_dem;
"""


class Command(BaseCommand):
	help = 'Шошго + өндрийн цэг + үүрлэлтээр EAST хаяалбарын өндрийг тараана.'

	def add_arguments(self, p):
		p.add_argument('-s', '--step', type=float, default=20.0,
			help='Хаяалбарын интервал, метр (анхдагч 20)')
		p.add_argument('--rebuild', action='store_true',
			help='e_ring / e_par / e_dem хүснэгтийг дахин барина (удаан)')
		p.add_argument('--max-steps', type=int, default=6,
			help='Тулгуураас хамгийн ихдээ хэдэн түвшин тараах вэ (анхдагч 6). '
			     'Хол тарах тусам завсрын тойм дутуугаас алдаа хуримтлагдана.')
		p.add_argument('--holdout', type=float, default=0.0,
			help='ШАЛГАЛТ: шошгын энэ хувийг тулгуурт ОРУУЛАХГҮЙ нуугаад, '
			     'үлдсэнээс нь таамагласан утгыг нууснуудтай харьцуулна '
			     '(жишээ нь 0.5). Дугуй логикгүй ЦОРЫН ГАНЦ зөв шалгалт.')
		p.add_argument('--seed', type=int, default=42)
		p.add_argument('--dry-run', action='store_true')

	def handle(self, *a, **o):
		step, t0 = o['step'], time.time()
		with connection.cursor() as c:
			def has(tbl):
				c.execute('SELECT to_regclass(%s)', [tbl])
				return c.fetchone()[0] is not None

			if o['rebuild'] or not has('e_ring'):
				self.stdout.write('e_ring барьж байна…')
				c.execute(RING_SQL)
			if o['rebuild'] or not has('e_par'):
				self.stdout.write('e_par (үүрлэлтийн мод) барьж байна… удаан')
				c.execute(PAR_SQL)
			if o['rebuild'] or not has('e_dem'):
				self.stdout.write('e_dem (өндрийн цэг → тойм) барьж байна…')
				c.execute(DEM_SQL)
			c.execute('SELECT count(*), count(anno_h) FROM e_ring')
			n_ring, n_anno = c.fetchone()
			c.execute('SELECT count(*) FROM e_par WHERE parent_id IS NOT NULL')
			n_par = c.fetchone()[0]
			c.execute('SELECT count(*), count(DISTINCT ring_id) FROM e_dem')
			n_dem, n_dem_ring = c.fetchone()
			self.stdout.write(f'тойм {n_ring:,} | шошготой {n_anno:,} | эцэгтэй {n_par:,} | '
				f'өндрийн цэг {n_dem:,} → {n_dem_ring:,} тойм  ({time.time()-t0:.0f}с)')

			# --- Python талд мод боловсруулна (жижиг өгөгдөл) ---
			c.execute('SELECT id, parent_id, anno_h FROM e_par')
			rows = c.fetchall()
			par, anno = {}, {}
			for rid, pid, ah in rows:
				par[rid] = pid
				if ah is not None:
					anno[rid] = float(ah)
			c.execute('SELECT ring_id, min(dem_h), max(dem_h) FROM e_dem GROUP BY ring_id')
			dem = {r: (float(lo), float(hi)) for r, lo, hi in c.fetchall()}
			# Тойм бүрийн SRTM‑ийн үнэлгээ (scratchpad/ring_dem.py‑ээр бэлдэнэ).
			# Абсолют утга нь ~9 м алдаатай ч ХОЁР тоймын ЗӨРҮҮ нь хэдэн
			# интервал үсэрснийг найдвартай заана.
			z = {}
			c.execute("SELECT to_regclass('e_ring_z')")
			if c.fetchone()[0]:
				c.execute('SELECT id, z FROM e_ring_z')
				z = {r: float(v) for r, v in c.fetchall()}
			self.stdout.write(f'DEM‑ийн үнэлгээтэй тойм: {len(z):,}')

			# ШАЛГАЛТ: шошгын нэг хэсгийг нуух. Нуусан шошгыг тулгуурт
			# ОРУУЛАХГҮЙ тул түүн дээрх таамаг нь бүрэн бие даасан болно.
			held = {}
			if o['holdout'] > 0:
				import random
				rnd = random.Random(o['seed'])
				for rid in list(anno):
					if rnd.random() < o['holdout']:
						held[rid] = anno.pop(rid)
				self.stdout.write(f'ШАЛГАЛТ: {len(held):,} шошго нуугдсан, '
					f'{len(anno):,} тулгуурт үлдсэн')

			# Гүн ба үндэс. ⚠ Эцгийн холбоос МӨЧЛӨГ үүсгэж болно (A тойм B‑ийн
			# дотоод цэгийг, B нь A‑гийнхыг агуулах — буруу нэгтгэлт, өөртэйгөө
			# огтлолцсон тоймд тохиолдоно). Хамгаалалтгүй бол давталт хязгааргүй
			# үргэлжилж санах ойг барина (93 ГБ хүртэл өссөн). Тиймээс энэ
			# гинжин дэх зочилсон зангилааг тэмдэглэж, мөчлөгийг тасална.
			depth, root, cyc = {}, {}, 0
			for rid in par:
				chain, seen, cur_ = [], set(), rid
				while cur_ is not None and cur_ not in depth:
					if cur_ in seen:                       # мөчлөг — тасална
						par[chain[-1]] = None
						cur_ = None
						cyc += 1
						break
					seen.add(cur_)
					chain.append(cur_)
					cur_ = par.get(cur_)
				if not chain:
					continue
				base = depth.get(cur_, -1) if cur_ is not None else -1
				rt = root.get(cur_, cur_) if cur_ is not None else chain[-1]
				for k, node in enumerate(reversed(chain)):
					depth[node] = base + 1 + k
					root[node] = rt
			if cyc:
				self.stdout.write(self.style.WARNING(f'МӨЧЛӨГ таслав: {cyc:,}'))
			mx = max(depth.values()) if depth else 0
			self.stdout.write(f'мод: гүн 0..{mx} ({time.time()-t0:.0f}с)')

			# --- ЧИГЛЭЛ: мод бүрт «гүн рүү өндөрсөх үү?» ---
			# Өндрийн цэг нь гинжний ДОТООД тойм дотор байна. Хэрэв гинжин дээр
			# шошго бий бол чиглэлийг тэдгээрийн зөрүүгээр ЯГ тодорхойлно;
			# байхгүй бол оргил гэж үзнэ (хэмжсэн: 83% тийм).
			sign = {}
			# (0) DEM байвал чиглэлийг МОД БҮРТ шууд тогтооно: гүн рүү орох тусам
			# SRTM өсөж байна уу (оргил) эсвэл буурч байна уу (хотгор). Энэ нь
			# өндрийн цэг ба шошго нэг гинжин дээр таарахыг хүлээхээс хамаагүй
			# өргөн хамрагдалт өгнө (өмнө нь ердөө 368 мод тогтоогдож байсан).
			if z:
				acc = {}
				for rid, pid in par.items():
					if pid is None or rid not in z or pid not in z:
						continue
					rt = root.get(rid)
					if rt is None:
						continue
					a = acc.setdefault(rt, [0, 0])
					a[0] += 1
					a[1] += 1 if z[rid] > z[pid] else -1
				for rt, (n_, s_) in acc.items():
					if n_ >= 2:
						sign[rt] = 1 if s_ >= 0 else -1
			for rid, (lo, hi) in dem.items():
				rt = root.get(rid)
				if rt is None:
					continue
				# гинжин дэх шошготой өвөг
				cur_, d_ring = par.get(rid), depth.get(rid, 0)
				while cur_ is not None:
					if cur_ in anno:
						dd = d_ring - depth[cur_]          # хэдэн түвшин гүн
						if dd:
							sign[rt] = 1 if (hi - anno[cur_]) > 0 else -1
						break
					cur_ = par.get(cur_)
			n_sign = len(sign)

			# --- ТУЛГУУРААС ТАРААХ ---
			# Тулгуур: (a) шошготой тойм, (b) өндрийн цэгийн дотоод тойм.
			est, src = {}, {}
			def put(rid, h, s):
				if rid in anno:
					return
				if rid in est and est[rid] != h:
					est[rid] = None                        # зөрчил
					return
				if est.get(rid) is None and rid in est:
					return
				est[rid], src[rid] = h, s

			children = {}
			for rid, pid in par.items():
				if pid is not None:
					children.setdefault(pid, []).append(rid)

			def delta(a, b, s):
				"""a→b шилжихэд ХЭДЭН интервал өөрчлөгдөх вэ.

				Зөвхөн «нэг түвшин = нэг интервал» гэж үзвэл завсрын тойм
				дутсан үед алдана (хэмжсэн хосуудын 26% нь −40…−100 м‑ийн
				үсрэлттэй). DEM байгаа бол зөрүүг нь интервалд хувааж
				бөөрөнхийлнө — топологи нь ЗААВАЛ бүхэл тоо байхыг албадаж,
				DEM нь ХЭД болохыг заана. DEM‑ийн үнэлгээгүй бол ±1 рүү буцна.
				"""
				za, zb = z.get(a), z.get(b)
				if za is None or zb is None:
					return s
				k = int(round((zb - za) / step))
				return k if k != 0 else s

			# ── ОЛОН‑ЭХ BFS ──────────────────────────────────────────────
			# Тулгуур бүрээс тусад нь DFS явуулбал нэг зангилаа олон удаа
			# дахин зочлогдож, ажил нь (тулгуурын тоо × дэд модны хэмжээ)
			# болно — max_steps=20 дээр цаг гаруй ажиллаад дуусаагүй. Оронд нь
			# БҮХ тулгуураас ЗЭРЭГ, давалгаа болгон тарааж, зангилаа бүрийг
			# ЗӨВХӨН НЭГ УДАА боловсруулна: ажил нь O(тоймын тоо) болно.
			#
			# Эхний давалгаа = ШОШГОТОЙ тулгуурууд (баталгаатай). Шошго дуусмагц
			# өндрийн цэгийн тулгуурууд орно — ингэснээр шошго нь өндрийн
			# цэгээс ДАВУУ эрхтэй тарна.
			from collections import deque

			def run_bfs(seeds, tag):
				"""seeds: [(ring_id, height)] — давалгааны эх."""
				q = deque()
				for rid, h in seeds:
					if rid in est and est[rid] is None:
						continue
					if rid not in anno:
						put(rid, h, tag)
					q.append((rid, h, 0))
				while q:
					node, h, k = q.popleft()
					if k >= o['max_steps']:
						continue
					nbrs = []
					p = par.get(node)
					s = sign.get(root.get(node), 1)
					if p is not None:
						nbrs.append((p, h + delta(node, p, -s) * step))
					for ch in children.get(node, ()):
						nbrs.append((ch, h + delta(node, ch, s) * step))
					for nb, hn in nbrs:
						if nb in anno:
							continue
						seen = nb in est
						put(nb, hn, tag)
						if not seen and est.get(nb) is not None:
							q.append((nb, hn, k + 1))

			run_bfs(list(anno.items()), 'nest')
			n_from_anno = sum(1 for v in est.values() if v is not None)

			# Өндрийн цэгийн тулгуур: гинжний ДОТООД тойм. Оргил бол цэгээс
			# ДООШ хамгийн ойрын интервал, хотгор бол ДЭЭШ.
			dem_seeds = []
			for rid, (lo, hi) in dem.items():
				if rid in anno or rid in est:
					continue
				s = sign.get(root.get(rid), 1)
				h0 = (step * (hi // step)) if s > 0 else (step * -(-hi // step))
				dem_seeds.append((rid, h0))
			run_bfs(dem_seeds, 'nest_dem')

			ok = {k: v for k, v in est.items() if v is not None}
			bad = sum(1 for v in est.values() if v is None)
			self.stdout.write(
				f'чиглэл тогтоогдсон мод: {n_sign:,} | шошгоос тарсан: {n_from_anno:,} | '
				f'нийт шинэ өндөр: {len(ok):,} | зөрчилтэй: {bad:,}  ({time.time()-t0:.0f}с)')

			# --- ШАЛГАЛТ: НУУСАН шошгууд дээр таамаг хэр таарав? ---
			if held:
				hit = one = tot = 0
				for rid, h in held.items():
					if rid not in ok:
						continue
					tot += 1
					hit += (abs(ok[rid] - h) < 1e-6)
					one += (abs(ok[rid] - h) <= step + 1e-6)
				miss = len(held) - tot
				if tot:
					self.stdout.write(self.style.SUCCESS(
						f'ШАЛГАЛТ: нуусан {len(held):,}‑аас {tot:,}‑д таамаг гарсан '
						f'({100*tot/len(held):.0f}% хамрагдалт) | ЯГ таарсан '
						f'{hit:,} = {100*hit/tot:.1f}% | ±1 интервал {100*one/tot:.1f}% | '
						f'таамаггүй {miss:,}'))
				else:
					self.stdout.write(self.style.WARNING('нуусан шошгуудад таамаг гарсангүй'))

			if o['dry_run']:
				self.stdout.write(self.style.WARNING('DRY RUN — юу ч бичсэнгүй'))
				return
			with transaction.atomic():
				c.execute('CREATE TEMP TABLE nest_res (id bigint, h double precision, s text)')
				c.executemany('INSERT INTO nest_res VALUES (%s,%s,%s)',
					[(k, v, src[k]) for k, v in ok.items()])
				c.execute("""UPDATE relief r SET height_est = n.h, height_src = n.s
				             FROM nest_res n WHERE r.id = n.id
				               AND r.height IS NULL AND r.height_src IS DISTINCT FROM 'anno'""")
				n = c.rowcount
			self.stdout.write(self.style.SUCCESS(
				f'бичсэн: {n:,} хаяалбар  ({time.time()-t0:.0f}с)'))
