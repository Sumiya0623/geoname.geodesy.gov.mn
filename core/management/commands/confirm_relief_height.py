"""Хаяалбарын (Relief) өндрийг өндрийн цэг (DemPoint)‑ээр баталгаажуулна.

ЧУХАЛ: «өндөр нь яг тэнцүү» гэсэн шалгуур энд ажиллахгүй. Өндрийн цэг нь
хаяалбарын шугам дээр биш, хоёр хаяалбарын хооронд (ихэвчлэн оргил дээр)
байрладаг — 3000 цэг дээр хэмжихэд яг тэнцүү нь ердөө 2%, харин зөрүү ≤10 м
байх нь 79% байсан. Тиймээс зай (--distance) ба өндрийн хүлцэл (--tolerance)
хоёрын хязгаараар «баталгаажсан» гэж үзнэ.

Жишээ:
    python manage.py confirm_relief_height                    # 200 м / ≤10 м
    python manage.py confirm_relief_height -d 100 -t 20       # өөр хязгаар
    python manage.py confirm_relief_height --exact            # яг тэнцүү (tol=0)
    python manage.py confirm_relief_height --dry-run          # зөвхөн тоолно
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
	help = 'Relief.confirmed‑ийг ойролцоох DemPoint‑ийн өндрөөр тавина.'

	def add_arguments(self, parser):
		parser.add_argument('-d', '--distance', type=float, default=200.0,
			help='Хайх зай, метрээр (анхдагч 200)')
		parser.add_argument('-t', '--tolerance', type=float, default=10.0,
			help='Зөвшөөрөх өндрийн зөрүү, метрээр (анхдагч 10)')
		parser.add_argument('--exact', action='store_true',
			help='Өндөр ЯГ тэнцүү байхыг шаардана (tolerance = 0)')
		parser.add_argument('--dry-run', action='store_true',
			help='Бичихгүй, зөвхөн хэдэн мөр таарахыг тоолно')
		parser.add_argument('--keep', action='store_true',
			help='Одоо байгаа confirmed=True‑г цэвэрлэхгүй (нэмж тэмдэглэнэ)')

	def handle(self, *args, **o):
		dist = o['distance']
		tol = 0.0 if o['exact'] else o['tolerance']
		where = """
			r.height IS NOT NULL AND d.height IS NOT NULL
			AND ST_DWithin(r.geom, d.geom, %s)
			AND abs(d.height - r.height) <= %s
		"""
		with connection.cursor() as c:
			if o['dry_run']:
				c.execute(f"""
					SELECT count(DISTINCT r.id) FROM relief r JOIN dem_point d
					ON {where}""", [dist, tol])
				n = c.fetchone()[0]
				self.stdout.write(f'таарах хаяалбар: {n:,} (бичсэнгүй)')
				return

			if not o['keep']:
				c.execute('UPDATE relief SET confirmed = FALSE WHERE confirmed')
				self.stdout.write(f'цэвэрлэсэн: {c.rowcount:,}')

			c.execute(f"""
				UPDATE relief r SET confirmed = TRUE FROM dem_point d
				WHERE NOT r.confirmed AND {where}""", [dist, tol])
			self.stdout.write(self.style.SUCCESS(
				f'баталгаажсан: {c.rowcount:,}  (зай ≤{dist:g} м, зөрүү ≤{tol:g} м)'))

			c.execute("""SELECT count(*) FILTER (WHERE confirmed),
				count(*) FILTER (WHERE height IS NOT NULL), count(*) FROM relief""")
			ok, hasnum, total = c.fetchone()
			pct = 100.0 * ok / hasnum if hasnum else 0
			self.stdout.write(f'нийт {total:,} | өндөртэй {hasnum:,} | '
				f'баталгаажсан {ok:,} ({pct:.1f}%)')
