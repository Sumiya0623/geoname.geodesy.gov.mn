"""Имэйлийн ангилал — Constant (key=MAIL_CATEGORIES) дотор get_or_create-ээр үүснэ."""

MAIL_CATEGORY_KEY = 'MAIL_CATEGORIES'

MAIL_CATEGORIES = [
	{'code': 'task',      'name': 'Даалгавар',  'color': 'info'},
	{'code': 'implement', 'name': 'Гүйцэтгэл',  'color': 'warning'},
	{'code': 'review',    'name': 'Хяналт',     'color': 'secondary'},
	{'code': 'deleted',   'name': 'Устгагдсан', 'color': 'error'},
]


def get_mail_category(code):
	"""Кодоор ангиллын Constant-ыг олж авах эсвэл шинээр үүсгэх."""
	if not code:
		return None
	from core.models import Constant
	meta = next((c for c in MAIL_CATEGORIES if c['code'] == code), None)
	if not meta:
		return None
	obj, _ = Constant.objects.get_or_create(
		key=MAIL_CATEGORY_KEY,
		code=code,
		defaults={'name': meta['name'], 'color': meta['color']},
	)
	return obj


def ensure_mail_categories():
	"""Бүх ангиллыг үүсгэж, жагсаалтаар буцаах (cards-д ашиглана)."""
	return [get_mail_category(c['code']) for c in MAIL_CATEGORIES]
