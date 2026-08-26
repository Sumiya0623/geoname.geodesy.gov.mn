"""Сэргээсэн өндрийг (`height_est`) үндсэн `height` багана руу шилжүүлнэ.

`height_est` нь ХАРААД БАТАЛГААЖУУЛАХ зорилгын түр утга — эх өгөгдлийг
дарж бичихгүйн тулд тусдаа баганад хадгалагддаг. Энэ команд нь сонгосон
эх сурвалжийн (`height_src`) утгуудыг үндсэн баганад бичнэ.

Эх сурвалжийн НАЙДВАРТАЙ БАЙДАЛ (хэмжсэн):
  anno      — шошгын текстээс шууд уншсан. Нарийсгасан хүрээ нь ЯГ НЭГ
              хаяалбартай огтолсон тохиолдолд л оноодог тул БАТАЛГААТАЙ.
  nest      — шошгот тулгуураас үүрлэлт+DEM‑ээр тоологдсон.
  nest_dem  — өндрийн цэгийн тулгуураас тоологдсон.
              Сүүлийн хоёр нь нуусан шошгын шалгалтаар 59.9% яг таарч,
              89.9% нь ±1 интервал дотор байсан — ХАРААД баталгаажуулна.

    python manage.py apply_relief_height --src anno --dry-run
    python manage.py apply_relief_height --src anno
    python manage.py apply_relief_height --src anno,nest,nest_dem --force
"""
import time
from django.core.management.base import BaseCommand
from django.db import connection, transaction

SAFE = {'anno'}


class Command(BaseCommand):
	help = 'height_est → height (сонгосон эх сурвалжийн утгыг үндсэн баганад бичнэ).'

	def add_arguments(self, p):
		p.add_argument('--src', default='anno',
			help='Таслалаар тусгаарласан эх сурвалж (anno,nest,nest_dem). Анхдагч: anno')
		p.add_argument('--force', action='store_true',
			help='Баталгаагүй эх сурвалжийг (nest, nest_dem) бичихийг зөвшөөрнө')
		p.add_argument('--dry-run', action='store_true')

	def handle(self, *a, **o):
		srcs = [s.strip() for s in o['src'].split(',') if s.strip()]
		risky = [s for s in srcs if s not in SAFE]
		if risky and not o['force']:
			self.stdout.write(self.style.ERROR(
				f'{", ".join(risky)} нь БАТАЛГААГҮЙ эх сурвалж (~60% яг таарна). '
				'Хараад шийдсэн бол --force нэмнэ үү.'))
			return
		t0 = time.time()
		with connection.cursor() as c:
			c.execute("""SELECT height_src, count(*), round(sum(ST_Length(geom))/1000)
			             FROM relief
			             WHERE height IS NULL AND height_est IS NOT NULL
			               AND height_src = ANY(%s) GROUP BY 1 ORDER BY 2 DESC""", [srcs])
			rows = c.fetchall()
			if not rows:
				self.stdout.write(self.style.WARNING('Шилжүүлэх мөр алга.'))
				return
			for s, n, km in rows:
				self.stdout.write(f'  {s:<9} {n:>8,} мөр  {km:>9,} км')

			if o['dry_run']:
				self.stdout.write(self.style.WARNING('DRY RUN — юу ч бичсэнгүй'))
				return
			with transaction.atomic():
				# Геометрийн Z‑ийг ч бөглөнө — 3D DEM гаргахад шууд ашиглагдана.
				c.execute("""UPDATE relief
				             SET height = height_est,
				                 geom = ST_Translate(ST_Force3D(ST_Force2D(geom)),
				                                     0, 0, height_est)
				             WHERE height IS NULL AND height_est IS NOT NULL
				               AND height_src = ANY(%s)""", [srcs])
				n = c.rowcount
			self.stdout.write(self.style.SUCCESS(
				f'{n:,} хаяалбарын өндөр `height` баганад бичигдэж, геометрийн Z '
				f'мөн бөглөгдлөө  ({time.time()-t0:.0f}с)'))
