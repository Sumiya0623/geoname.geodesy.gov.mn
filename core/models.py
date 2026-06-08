import re

from django.contrib.gis.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.urls import reverse
from portal.utils.photoutils import get_profile_photo_upload_path
import uuid, os
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

class OverwriteStorage(FileSystemStorage):
    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            self.delete(name)
        return name
geoserver_style_storage = OverwriteStorage(
	
    location=os.path.join(settings.GEOSERVER_DATA_DIR, "workspaces")
)

HEX_COLOR_RE = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
def validate_hex_color(value: str):
	if value and not HEX_COLOR_RE.match(value.strip()):
		raise ValidationError("Өнгө '#RRGGBB' эсвэл '#RGB' байх ёстой.")
	
def sld_upload_to(instance, filename):
    # styles-ийн canonical зам: {workspaces}/{ws}/styles/{style_name}.sld
    ws = instance.ws 
    fname = f"{instance.style_name}.sld"
    return os.path.join(ws, "styles", fname)

def icon_upload_to(instance, filename):
    ws = instance.style.layer.store.parent.name
    base = slugify((instance.style.style_name) + f"_{instance.field.id}_icon")
    return f"{ws}/styles/{base}.svg" 

from portal.utils.geofunction import (
	dd_to_dms
)
from portal.utils.functions import (
	file_upload_path,
	photo_upload_path,
)
METHOD_CHOICES = (
    ('GET', 'GET'),
    ('POST', 'POST'),
    ('PUT', 'PUT'),
    ('PATCH', 'PATCH'),
    ('DELETE', 'DELETE'),
)

class Error500(models.Model):
	url = models.CharField(null=False, db_index=True, max_length=254, verbose_name='Хандсан URL')
	method = models.CharField(max_length=20, null=False, db_index=True, verbose_name='Дуудсан method')
	description = models.TextField(null=True, verbose_name='Алдааны мэдэгдэл')
	headers = models.TextField(null=True, verbose_name='Request headers')
	scheme = models.TextField(null=True, verbose_name='Header scheme')
	datetime = models.DateTimeField(auto_now_add=True, verbose_name='Хүсэлт илгээсэн огноо')
	data = models.TextField(null=True, verbose_name='Body data')
	remote_ip = models.CharField(max_length=50, null=True, blank=True, db_index=True, verbose_name='Хэрэглэгчийн IP')
	query_string = models.TextField(null=True, blank=True, verbose_name='params')
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		null=True, blank=True,
		on_delete=models.SET_NULL, db_constraint=False,
		verbose_name='Хэрэглэгчийн ID'
	)

class RequestLog(models.Model):
    url = models.CharField(max_length=254, db_index=True, verbose_name='Хандсан URL')
    query_string = models.TextField(null=True, blank=True, verbose_name='Params')
    remote_ip = models.CharField(max_length=50, null=True, blank=True, db_index=True, verbose_name='Remote IP')
    datetime = models.DateTimeField(auto_now_add=True, verbose_name='Хүсэлт илгээсэн огноо')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL, db_constraint=False,
        verbose_name='Хэрэглэгчийн ID'
    )
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, db_index=True, verbose_name='Дуудсан Method')
    status_code = models.SmallIntegerField(null=True, blank=True, db_index=True, verbose_name='Хариултын төлөв')
    data = models.TextField(null=True, blank=True, verbose_name='Request body')
    class Meta:
        verbose_name = "Request log"
        verbose_name_plural = "Request logs"
        indexes = [
            models.Index(fields=['url', 'datetime']),
            models.Index(fields=['remote_ip', 'datetime']),
            models.Index(fields=['method', 'status_code']),
        ]

    def __str__(self):
        return f"[{self.method}] {self.url} @ {self.datetime:%Y-%m-%d %H:%M:%S}"

class Errors(models.Model):
	url = models.CharField(null=False, db_index=True, max_length=254, verbose_name='Хандсан URL')
	method = models.CharField(max_length=20, null=False, db_index=True, verbose_name='Дуудсан method')
	code = models.CharField(max_length=50, null=False, db_index=True, verbose_name='Алдааны код')
	description = models.TextField(null=True, verbose_name='Алдааны мэдэгдэл')
	headers = models.TextField(null=True, verbose_name='Request headers')
	scheme = models.TextField(null=True, verbose_name='Request scheme')
	datetime = models.DateTimeField(auto_now_add=True, verbose_name='Хүсэлт илгээсэн огноо')
	data = models.TextField(null=True, verbose_name='Body data')
	remote_ip = models.CharField(max_length=50, null=True, blank=True, db_index=True, verbose_name='Хэрэглэгчийн IP')
	query_string = models.TextField(null=True, blank=True, verbose_name='Params')
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		null=True, blank=True,
		on_delete=models.SET_NULL, db_constraint=False,
		verbose_name='Хэрэглэгчийн ID'
	)

class SubMenuPermission(models.Model):
	submenu= models.ForeignKey( 'Constant', on_delete=models.CASCADE,related_name='role_permissions', limit_choices_to={'key':'SUBMENUS'})
	action=models.ForeignKey( 'Constant', on_delete=models.CASCADE, related_name='permission_actions',limit_choices_to={'key':'ACTION_TYPES'})
	def __str__(self):
		return f'{self.action} | {self.submenu.name}'

class Constant(models.Model):
	name = models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	key = models.CharField(max_length=1000,blank=True,null=True,verbose_name='Түлхүүр')
	code = models.CharField(max_length=1000,blank=True,null=True,verbose_name='Код')
	label = models.CharField(max_length=1000,blank=True,null=True,verbose_name='Харуулах нэр')
	color = models.CharField(max_length=1000,blank=True,null=True,verbose_name='Өнгө')
	desc = models.CharField(max_length=5000,blank=True,null=True,verbose_name='Тайлбар')
	parent= models.ForeignKey('self', on_delete=models.CASCADE, verbose_name='Харъяалагдах тогтмол', related_name='children', blank=True, null=True)
	actions = models.ManyToManyField(SubMenuPermission,	blank=True,	related_name='roles')
	class Meta:
		verbose_name = 'Constant'
		verbose_name_plural = "Системийн Тогтмол"
		ordering = ['key']
	def __str__(self):
		return f'{self.name}-{self.key}'
	
class AdminUnit(models.Model):
	geom = models.GeometryField(blank=True, null=True, srid=4326)
	unit = models.CharField(max_length=1000, blank=True, null=True)
	parent = models.ForeignKey('self', on_delete=models.CASCADE, verbose_name='Дээд хил', related_name='children', blank=True, null=True)
	level=models.ForeignKey(Constant, on_delete=models.CASCADE, verbose_name='UNIT_LEVEL', related_name='units', blank=True, null=True)
	class Meta:
		verbose_name_plural = "Хил"
	def __str__(self):
		return str(self.unit.title())

class RemoteUser(AbstractUser):
	sso_id = models.UUIDField(
		default=uuid.uuid4,
		unique=True,
		editable=False,
		verbose_name='SSO дугаар',
		help_text='Төвлөрсөн нэвтрэлтийн SSO дугаар.'
	)
	first_name = models.CharField(
		max_length=100,
		verbose_name='Нэр',
		help_text='Хэрэглэгчийн өөрийн нэр.'
	)
	last_name = models.CharField(
		max_length=100,
		verbose_name='Овог',
		help_text='Хэрэглэгчийн овог.'
	)
	roles=models.ManyToManyField(
		Constant,
		related_name='roles',
		verbose_name='Нэмэлт эрхүүд',
		help_text='Хэрэглэгчид ногдох нэмэлт эрхүүд.'
	)
	
	photo=models.ImageField(
		upload_to=get_profile_photo_upload_path,
		verbose_name='Лого',
		blank=True,
		null=True,
		help_text='Хэрэглэгчийн зураг эсвэл лого.'
	)
	email = models.EmailField(
		_("email address"),
		blank=True,
		help_text='Хэрэглэгчийн имэйл хаяг.'
	)
	is_citizen = models.BooleanField(
		default=False,
		verbose_name="",
		help_text='Иргэн эсэхийг илэрхийлнэ. Иргэн бол үнэн (True).'
	)
	phone=models.CharField(
		max_length=50,
		blank=True,
		null=True,
		verbose_name='Утас',
		help_text='Холбоо барих утасны дугаар.'
	)
	register=models.CharField(
		max_length=30,
		unique=True,
		verbose_name='Регистр',
		error_messages={ "unique": "Регистр бүртгэгдсэн байна" },
		help_text='Иргэн эсвэл байгууллагын регистрийн дугаар.'
	)
	unit=models.ManyToManyField(
		AdminUnit,
		verbose_name='Хил',
		related_name='relatedunits',
		blank=True,
		help_text='Харьяалагдах захиргааны нэгжүүд.'
	)
	USERNAME_FIELD = 'register'
	org = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        verbose_name='Байгууллага',
        related_name='orgusers',
        blank=True,
        null=True,
        limit_choices_to={'is_citizen': False}
    )
	def get_absolute_url(self):
		return reverse('profile-detail', args=[str(self.id)])
	class Meta:
		ordering = ['first_name']
		verbose_name_plural = "Хэрэглэгч"
	def __str__(self):
		if self.is_citizen and self.last_name and self.first_name:
			return f'{self.first_name.upper()}'
		elif self.is_citizen and self.first_name:
			return f'{self.first_name.upper()}'
		else:
			return f'{self.first_name.upper()}'
	@property
	def full_name(self):
		if self.is_citizen:
			if self.last_name and self.first_name:
				return f'{self.last_name[0].title()}.{self.first_name.title()}'
			else:
				return f'{self.first_name.title()}'
		else:
			return f'{self.first_name.title()}'

class UserMixin(models.Model):
	user=models.ForeignKey(
		RemoteUser,
		models.CASCADE,
		blank=True,
		null=True,
		verbose_name='Бүртгэсэн',
		related_name='%(class)ss',
		help_text='Энэхүү бичлэгийг үүсгэсэн хэрэглэгч.'
	)
	created_date= models.DateTimeField(
		verbose_name="Бүртгэсэн",
		auto_now_add=True,
		help_text='Энэхүү бичлэг үүссэн огноо, цаг.'
	)
	modified_date= models.DateTimeField(
		verbose_name="Шинэчилсэн",
		auto_now=True,
		help_text='Сүүлд шинэтгэл хийгдсэн огноо, цаг.'
	)
	last_view = models.DateTimeField(
		auto_now_add=True,
		verbose_name='Сүүлд үзсэн',
		help_text='Хэрэглэгч хамгийн сүүлд үзсэн огноо, цаг.'
	)
	views=models.IntegerField(
		default=1,
		verbose_name='Хандалт',
		help_text='Энэ бичлэг рүү хандсан нийт тоо.'
	)
	class Meta:
		abstract = True 

class LegalOrder(UserMixin):
	name=models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	unit=models.ForeignKey(AdminUnit, on_delete=models.CASCADE, verbose_name='ЗЗНэгж', related_name='legalorders',blank=True, null=True)
	org=models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'LEGAL_TYPES'}, blank=True, null=True, related_name='legalorgs', verbose_name='Төрөл')
	type=models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'ORDER_TYPES'}, blank=True, null=True, related_name='legalorders', verbose_name='Төрөл')
	description=models.TextField(verbose_name='Тайлбар', blank=True, null=True)
	order_date=models.DateField(verbose_name='Гарсан огноо', blank=True, null=True)
	order_number=models.CharField(max_length=255, verbose_name='Дугаар', blank=True, null=True)
	document=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Баримт бичиг')
	signer=models.CharField(max_length=255, verbose_name='Гарын үсэг', blank=True, null=True)

class Mongeoid(models.Model):
	"""Mongeoid"""
	id = models.BigAutoField(primary_key=True)
	b = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
	l = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
	dh = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
	class Meta:
		managed = False
		db_table = 'mongeoid'
	def __str__(self):
		return str(self.dh)
	
class Nomek(models.Model):
	geom = models.GeometryField(
		blank = True,
		null=True,
		verbose_name='Хил',
		help_text='Нэрлэврийн хил, геометр.'
	)
	center = models.PointField(
		blank = True,
		null=True,
		verbose_name='Төв цэг',
		help_text='Нэрлэврийн төлөөлөх төв цэг.'
	)
	nomek = models.CharField(
		max_length=25,
		verbose_name='Нэрлэвэр',
		blank=True,
		null=True,
		help_text='Нэрлэврийн код эсвэл нэр.'
	)
	is_mapped = models.BooleanField(
		default=False,
		verbose_name='Газрын зурагт тэмдэглэсэн эсэх',
		help_text='Энэ нэрлэвэр газрын зураг дээр тэмдэглэгдсэн эсэх.'
	)
	scale=models.ForeignKey(
		Constant,
		on_delete=models.CASCADE,
		limit_choices_to={'key':'MAPSCALES'},
		verbose_name='Төрөл',
		related_name='scales',
		blank=True,
		null=True,
		help_text='Нэрлэврийн зураглалын масштаб.'
	)
	parent = models.ForeignKey(
		'self',
		on_delete=models.CASCADE,
		related_name='children',
		blank=True,
		null=True,
		verbose_name='Дээд нэрлэвэр',
		help_text='Дээд шатны нэрлэвэр.'
	)
	# def save(self, *args, **kwargs):
	# 	latitude, longitude = self.center.y, self.center.x
	# 	bmin=latitude-10/60
	# 	bmax=latitude+10/60
	# 	lmin=longitude-15/60
	# 	lmax=longitude+15/60
	# 	polygon = Polygon.from_bbox((lmin, bmin, lmax, bmax))
	# 	self.geom = polygon
	# 	super().save(*args, **kwargs)

class Road(models.Model):
	state=models.ForeignKey(Constant, on_delete=models.CASCADE, limit_choices_to={'key':'ROADSTATETYPES'}, verbose_name='Төрөл', related_name='roadstates',blank=True, null=True)
	paver=models.ForeignKey(Constant, on_delete=models.CASCADE, limit_choices_to={'key':'ROADPAVETYPES'}, verbose_name='Төрөл', related_name='roadpaves',blank=True, null=True)
	geom = models.GeometryField(blank = True, null=True)
	name=models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)

class Project(models.Model):
	name=models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	percent = models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	org=models.ForeignKey(RemoteUser, on_delete=models.CASCADE, verbose_name='Хэрэглэгч', related_name='rojects',blank=True, null=True)
	dugaar=models.CharField(max_length=2000, verbose_name='Дугаар',default="un", blank=True, null=True)
	signed_date=models.DateTimeField(blank=True,null=True, verbose_name='Эхэлсэн огноо')
	end_date=models.DateTimeField(blank=True,null=True, verbose_name='Дуусах огноо')
	oldid=models.IntegerField(null=True, blank=True)

class GeoName(UserMixin):
	name=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	number=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Дугаар')
	type=  models.ForeignKey(Constant,on_delete=models.CASCADE,blank=True,null=True,related_name='centerlocations',limit_choices_to={'key':'GEONAME_TYPES'},verbose_name='Төрөл')
	nomek = models.ManyToManyField(Nomek,related_name='nomeknames',verbose_name='Нэрлэвэр',blank=True)
	unit=models.ManyToManyField(AdminUnit,related_name='unitnames',verbose_name='Хил',blank=True)
	geoloc = models.GeometryField(blank = True,null=True,srid=4326,verbose_name='Газарзүйн байрлал')
	is_approved=models.BooleanField(default=False,verbose_name='Төлөв',blank=True,null=True)
	passport=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Хувийн хэрэг')
	orders=models.ManyToManyField(LegalOrder, related_name='ordernames', verbose_name='Эрх зүйн баримт бичиг', blank=True)
	is_border=models.BooleanField(default=False,verbose_name='Хил цэс эсэх',blank=True,null=True)
	def _type_code_path(self):
		"""Төрлийн өвөг→навч кодуудыг нийлүүлнэ (level1.code + level2.code + level3.code)."""
		chain, c, seen = [], self.type, set()
		while c and c.id not in seen:
			seen.add(c.id)
			chain.append(c)
			c = c.parent
		chain.reverse()
		return ''.join((x.code or '') for x in chain)

	def save(self, *args, **kwargs):
		super().save(*args, **kwargs)
		# Дугаар = level1.code+level2.code+level3.code + id(5 орон). Ж: B0109 + 00001
		number = f"{self._type_code_path()}{self.pk:05d}"
		if self.number != number:
			self.number = number
			super().save(update_fields=['number'])

	def __str__(self):
		return f'{self.name}'

class NameOption(models.Model):
	name=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	name2=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр 2')
	desc=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Эх сурвалж')
	
class RequestName(UserMixin):
	name=models.ForeignKey(GeoName,on_delete=models.CASCADE,verbose_name='Нэр', related_name='requestnames',blank=True, null=True)
	age=models.ForeignKey(Constant,on_delete=models.CASCADE,limit_choices_to={'key':'GEONAME_AGES'},verbose_name='Нас',related_name='requestages',blank=True, null=True)
	type=  models.ForeignKey(Constant,on_delete=models.CASCADE,blank=True,null=True,related_name='nametypes',limit_choices_to={'key':'GEONAME_TYPES'},verbose_name='Төрөл')
	status=models.ForeignKey(Constant,on_delete=models.CASCADE,limit_choices_to={'key':'REQUEST_STATUS'},verbose_name='Төрөл',related_name='requeststatuses')
	purpose=models.ManyToManyField(Constant,related_name='requestpurposes',limit_choices_to={'key':'REQUEST_PURPOSES'},verbose_name='Төрөл',blank=True)
	option=models.ManyToManyField(NameOption,related_name='requestoptions',verbose_name='Нэрлэвэр',blank=True)
	description=models.TextField(blank=True,null=True,verbose_name='Тайлбар')
	lat=models.FloatField(blank=True,null=True,verbose_name='Өргөрөг')
	lon=models.FloatField(blank=True,null=True,verbose_name='Уртраг')
	
	def __str__(self):
		return f'{self.name}'

class NameContact(models.Model):
	request=models.ForeignKey(RequestName,on_delete=models.CASCADE,verbose_name='Нэр', related_name='namecontacts',blank=True, null=True)
	first_name=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	last_name=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Овог')
	person=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	register=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Регистр')
	address=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Хаяг')
	phone=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Утас')
	email=models.EmailField(max_length=1000,blank=True,null=True,verbose_name='Имэйл')
	photo=models.ImageField(upload_to=photo_upload_path, blank=True, null=True,verbose_name='Зураг')
	requested_by=models.ForeignKey(RemoteUser,on_delete=models.CASCADE,verbose_name='Нэр', related_name='requestedcontacts',blank=True, null=True)

class Photo(models.Model):
	file = models.ImageField(upload_to=photo_upload_path,blank=True, null=True,verbose_name='Зураг')
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True, related_name='photos')
	object_id = models.PositiveIntegerField(null=True, blank=True)
	content_object = GenericForeignKey('content_type', 'object_id')
	def __str__(self):
		return f'{self.content_type}'
	class Meta:
		verbose_name_plural = "Photo"

class Attach(models.Model):
	attach = models.FileField(upload_to=file_upload_path,blank=True, null=True,verbose_name='Хавсаргах файл')
	content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True, related_name='attachs')
	object_id = models.PositiveIntegerField(null=True, blank=True)
	content_object = GenericForeignKey('content_type', 'object_id')
	def __str__(self):
		return f'{self.content_type}'
	def get_absolute_url(self):
		return reverse('file-detail', args=[str(self.id)])
	class Meta:
		verbose_name_plural = "Attach"

class Cart(UserMixin):
	status = models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'CARTSTATUS'}, verbose_name='Төрөл', related_name='carts',blank=True, null=True)
	catalogy=models.FileField(upload_to='upload_files/payment/catalogy',blank=True, null=True)
	inquire_qr = models.ImageField(upload_to='upload_files/payment/qr',blank=True, null=True)
	link=models.CharField(max_length=1000,blank=True, null=True)
	def __str__(self): 
		return f'Cart#{self.id} {self.user} [{self.status}]'

class CartItem(models.Model):
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
	point = models.ForeignKey(GeoName, on_delete=models.CASCADE, related_name='cart_items')
	unit_price = models.DecimalField(max_digits=12, decimal_places=2)  # capture price at time of add
	added_at = models.DateTimeField(auto_now_add=True)
	class Meta:
		unique_together = [('cart', 'point')]  # нэг cart-д нэг point ганц л удаа
		indexes = [models.Index(fields=['cart']), models.Index(fields=['point'])]

class Payment(UserMixin):
	order = models.OneToOneField(Cart, on_delete=models.CASCADE,  verbose_name='Захиалга')
	receiver = models.CharField(max_length=20, null=True, blank=True, verbose_name='Хүлээн авагчийн регистр')
	# QPay талын metadata
	invoice_id = models.CharField(max_length=40, verbose_name='QPAY дугаар', blank=True)
	qp_qrcode  = models.ImageField(upload_to=photo_upload_path, blank=True)
	call_back  = models.URLField(blank=True)
	amount     = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Дүн', blank=True, null=True)
	payment_id = models.CharField(max_length=40, verbose_name='QPAY төлбөрийн дугаар', blank=True)
	wallet     = models.CharField(max_length=40, verbose_name='Төрөл', blank=True)
	is_paid=models.BooleanField(default=False,verbose_name='Төлбөр')
	counter=models.IntegerField(default=0,null=True, blank=True,verbose_name='counter')
	# Ебаримт
	ebarimt_id         = models.CharField(max_length=40,  verbose_name='Ebarim дугаар', blank=True)
	ebarimt_bill_id    = models.CharField(max_length=200, verbose_name='ДДТД', blank=True)
	ebarimt_qr_data    = models.CharField(max_length=5000, verbose_name='Ebarimt data', blank=True)
	ebarimt_qrcode     = models.ImageField(upload_to=photo_upload_path, blank=True)
	ebarimt_lottery_id = models.CharField(max_length=5000, verbose_name='Ebarimt сугалааны дугаар', blank=True)
	class Meta:
		ordering = ['-created_date']
		verbose_name_plural = "Гүйлгээ"

	def __str__(self):
		return f'Payment#{self.pk}'

class QpayToken(models.Model):
	payment=models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='payments', verbose_name='Төлбөр',blank=True, null=True)
	type=models.CharField(null=True, blank=True,verbose_name='type')
	expire=models.CharField(null=True, blank=True,verbose_name='expire')
	refresh_expire=models.CharField(null=True, blank=True,verbose_name='refresh expire')
	refresh=models.CharField(null=True, blank=True,verbose_name='refresh')
	access=models.CharField(null=True, blank=True,verbose_name='access')
	scope=models.CharField(null=True, blank=True,verbose_name='scope')
	session_state=models.CharField(null=True, blank=True,verbose_name='session_state')

class PaymentBank(models.Model):
	"""Хүлээн авагч"""
	payment=models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='banks', verbose_name='Банк',blank=True, null=True)
	name=models.CharField(max_length=40, verbose_name='QPAY дугаар', blank=True)
	description=models.CharField(max_length=3000, blank=True, null=True, verbose_name='Дүн')
	logo=models.ImageField(upload_to=photo_upload_path,blank=True)
	link=models.CharField(max_length=3000,blank=True)
	def __str__(self):
		return f'{self.name}'
	class Meta:
		verbose_name_plural = "Банк" 

class Report(models.Model):
	measurements = models.ManyToManyField(GeoName, related_name='reports')
	report=models.FileField(upload_to=file_upload_path,blank=True, null=True)
	engineer=models.ForeignKey(RemoteUser, on_delete=models.CASCADE, verbose_name='Тэгшитгэн бодсон',related_name='reportengineers',limit_choices_to={'is_citizen': True},null=True, blank=True) # C NonReq

class Passport(models.Model):
	name=models.ForeignKey(GeoName,related_name='acts', on_delete=models.CASCADE, blank=True, null=True)
	act=models.FileField(upload_to=file_upload_path,blank=True, null=True)
	engineer=models.ForeignKey(RemoteUser, on_delete=models.CASCADE, verbose_name='Хувийн хэрэг хөтөлсөн',related_name='actengineers',limit_choices_to={'is_citizen': True},null=True, blank=True) # C NonReq
	is_accepted = models.BooleanField( default=False, verbose_name='Зөвшөөрсөн',blank=True, null=True)
	accepted_date=models.DateTimeField(null=True, blank=True)
	created_date=models.DateTimeField(auto_now_add=True)
	officer=models.ForeignKey(RemoteUser, on_delete=models.CASCADE, verbose_name='Хүлээн авсан',related_name='officers',limit_choices_to={'is_citizen': True},null=True, blank=True)
	qr_data    = models.CharField(max_length=5000, verbose_name='QR data', blank=True)
	qrcode=models.ImageField(upload_to=photo_upload_path,blank=True)
	link=models.URLField(blank=True, null=True,max_length=3000)
	desc=models.CharField(max_length=5000, blank=True, null=True)

class Layer(models.Model):
	ws=models.ForeignKey(Constant, on_delete=models.CASCADE, related_name='wsfeatures',blank=True, null=True)
	store=models.ForeignKey(Constant, on_delete=models.CASCADE, related_name='storefeatures',blank=True, null=True)
	table=models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'GeomDatas'}, verbose_name='Төрөл', related_name='features',blank=True, null=True)
	map=models.FileField(upload_to=file_upload_path, verbose_name='Maps',blank=True, null=True)
	is_raster=models.BooleanField(default=False)
	is_published=models.BooleanField(default=True)
	url=models.URLField(blank=True, null=True,max_length=3000)
	name = models.CharField(max_length=200, blank=True, null=True)
	geom_type=models.CharField(max_length=50, blank=True, null=True)
	order=models.PositiveIntegerField(default=1)
	class Meta:
		indexes = [
			models.Index(fields=["is_published"]),
		]
		ordering = ["id"]
	def __str__(self):
		return self.title or (self.table.name if self.table else f"Feature #{self.pk}")

class StyleRule(models.Model):
	class Symbolizer(models.TextChoices):
		POINT = "point", "Point"
		LINE = "line", "Line"
		POLYGON = "polygon", "Polygon"
		RASTER = "raster", "Raster"
		TEXT = "text", "Text"

	class LineCap(models.TextChoices):
		BUTT = "butt", "butt"
		ROUND = "round", "round"
		SQUARE = "square", "square"

	class LineJoin(models.TextChoices):
		MITER = "miter", "miter"
		ROUND = "round", "round"
		BEVEL = "bevel", "bevel"

	class BlendMode(models.TextChoices):
		NORMAL = "normal", "normal"
		MULTIPLY = "multiply", "multiply"
		SCREEN = "screen", "screen"
		OVERLAY = "overlay", "overlay"
		DARKEN = "darken", "darken"
		LIGHTEN = "lighten", "lighten"

	class JoinOp(models.TextChoices):
		AND = "AND", "AND"
		OR = "OR", "OR"

	layer = models.ForeignKey(Layer, on_delete=models.CASCADE, related_name="rules")
	name = models.CharField(max_length=100, blank=True, help_text="Легендийн нэр/эсвэл тоон ID-г Name-д ашиглаж болно")
	is_visible = models.BooleanField(default=True)
	order = models.PositiveIntegerField(default=0, help_text="Дүрмийн эрэмбэ (бага → түрүүнд)")
	join_op = models.CharField(max_length=3, choices=JoinOp.choices, default=JoinOp.AND)
	min_scale_denom = models.BigIntegerField(blank=True, null=True, validators=[MinValueValidator(1)])
	max_scale_denom = models.BigIntegerField(blank=True, null=True, validators=[MinValueValidator(1)])

	# Ерөнхий харагдац
	opacity = models.FloatField(
		default=1.0, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
		help_text="0..1"
	)
	z_index = models.IntegerField(default=0)
	blend_mode = models.CharField(max_length=16, choices=BlendMode.choices, default=BlendMode.NORMAL)

	# Геометр төрөл
	symbolizer = models.CharField(max_length=16, choices=Symbolizer.choices, default=Symbolizer.POLYGON)

	# Stroke
	stroke_color = models.CharField(max_length=32, blank=True,null=True, validators=[validate_hex_color])
	stroke_width = models.FloatField(blank=True, null=True)
	stroke_opacity = models.FloatField(blank=True, null=True, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
	stroke_dasharray = models.CharField(max_length=64, blank=True,null=True)
	stroke_linecap = models.CharField(max_length=8, choices=LineCap.choices, blank=True)
	stroke_linejoin = models.CharField(max_length=8, choices=LineJoin.choices, blank=True)

	# Fill
	fill_color = models.CharField(max_length=32, blank=True,null=True, validators=[validate_hex_color])
	fill_opacity = models.FloatField(blank=True, null=True, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])

	# Point
	size = models.FloatField(blank=True, null=True)
	icon = models.FileField(
		storage=OverwriteStorage(),
		upload_to="upload_files/symbols",
		blank=True, null=True,
		verbose_name="SVG icon"
	)
	rotation = models.FloatField(blank=True, null=True)

	# Text
	render_mode = models.CharField(max_length=16,blank=True, default="symbol")
	text_field = models.CharField(max_length=64, blank=True, null=True)        # PropertyName
	text_size = models.FloatField(blank=True, null=True)
	text_color = models.CharField(max_length=32, blank=True, validators=[validate_hex_color])
	text_font_family = models.CharField(max_length=64, blank=True)
	text_font_style = models.CharField(max_length=16, blank=True)              # normal|italic
	text_font_weight = models.CharField(max_length=16, blank=True)             # normal|bold
	text_halo_color = models.CharField(max_length=32, blank=True, validators=[validate_hex_color])
	text_halo_radius = models.FloatField(blank=True, null=True)
	text_halo_opacity = models.FloatField(blank=True, null=True, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
	text_anchor = models.CharField(max_length=16, blank=True)                  # center|left|right|top|bottom
	text_displacement_x = models.FloatField(blank=True, null=True)
	text_displacement_y = models.FloatField(blank=True, null=True)
	text_rotation = models.FloatField(blank=True, null=True)
	vendor_options = models.JSONField(blank=True, null=True)
	filters = models.JSONField(blank=True, null=True, help_text="[{field, operator, value}] хэлбэртэй JSON")

	class Meta:
		ordering = ["order", "id"]
		verbose_name = "SymbolRules"
		indexes = [
			models.Index(fields=["layer", "order"]),
			models.Index(fields=["is_visible"]),
		]
	def __str__(self):
		return self.name or f"rule:{self.pk}"
	
class LayerGroup(models.Model):
	name = models.CharField(max_length=100)

class LayerGroupItem(models.Model):
	group = models.ForeignKey(LayerGroup, on_delete=models.CASCADE, related_name='items')
	layer = models.ForeignKey(Layer, on_delete=models.CASCADE, related_name='group_items')
	order = models.PositiveIntegerField(default=0)
	visible = models.BooleanField(default=True)
	class Meta:
		unique_together = ('group', 'layer')  # нэг group-д ижил combo давтагдахгүй
		ordering = ['order', 'id']

class ChatLog(models.Model):
    conversation_id = models.UUIDField()
    user_hash = models.CharField(max_length=64)
    ts = models.DateTimeField(auto_now_add=True)
    user_query_raw = models.TextField()
    normalized_query = models.TextField(blank=True, null=True)
    predicted_intent = models.CharField(max_length=64, blank=True, null=True)
    predicted_slots = models.JSONField(default=dict, blank=True)
    routing = models.CharField(max_length=32)  # RAG|LOCAL|EXTERNAL
    context_sources = models.JSONField(default=list, blank=True)
    bot_response_text = models.TextField()
    latency_ms = models.IntegerField(null=True, blank=True)
    tokens_in = models.IntegerField(null=True, blank=True)
    tokens_out = models.IntegerField(null=True, blank=True)
    thumb = models.SmallIntegerField(null=True, blank=True)  # -1/0/1
    feedback_comment = models.TextField(blank=True, null=True)
    gold_intent = models.CharField(max_length=64, blank=True, null=True)
    gold_slots = models.JSONField(blank=True, null=True)

class Number(models.Model):
	unit=models.ForeignKey(AdminUnit, on_delete=models.CASCADE, limit_choices_to={'level':284}, related_name='numbers', blank=True, null=True)
	network=models.ForeignKey(Constant, on_delete=models.CASCADE, limit_choices_to={'key':'GEODETIC_NETWORK'}, related_name='networks', blank=True, null=True)
	name = models.CharField(max_length=100, blank=True, null=True)
	number = models.CharField(max_length=100, blank=True, null=True)
	user=models.ForeignKey(RemoteUser, on_delete=models.CASCADE,null=True, blank=True)
	is_used=models.BooleanField(default=False)


class MailLog(models.Model):
	"""Системээс илгээсэн имэйл бүрийн бүртгэл — админ хяналт, мэдэгдлийн цэс."""
	STATUS_CHOICES = (
		('sent', 'Амжилттай'),
		('failed', 'Амжилтгүй'),
	)
	category = models.ForeignKey(
		Constant,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		limit_choices_to={'key': 'MAIL_CATEGORIES'},
		related_name='maillogs',
		verbose_name='Ангилал',
	)
	to_email = models.CharField(max_length=300, blank=True, null=True, verbose_name='Хүлээн авагч имэйл')
	to_user = models.CharField(max_length=300, blank=True, null=True, verbose_name='Хүлээн авагч')
	subject = models.CharField(max_length=1000, blank=True, null=True, verbose_name='Гарчиг')
	body = models.TextField(blank=True, null=True, verbose_name='Агуулга')
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent', verbose_name='Төлөв')
	error = models.TextField(blank=True, null=True, verbose_name='Алдаа')
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='Огноо')

	class Meta:
		ordering = ['-created_at']
		verbose_name_plural = 'Мэдэгдэл (имэйл)'

	def __str__(self):
		return f'{self.to_email} - {self.subject}'


from .modelnl import *
