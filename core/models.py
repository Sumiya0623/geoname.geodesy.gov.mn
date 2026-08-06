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
# GEOSERVER_DATA_DIR нь зөвхөн geoserver локал (нэг сервер) үед тохируулагдана.
# Production дээр geoserver тусдаа сервер дээр (алсын REST) тул энэ нь None байж
# болно — тэр үед локал media зам руу буулгаж, import‑ийн үед унахаас сэргийлнэ.
# (Алсын geoserver руу style нийтлэх нь geoserver‑rest REST‑ээр тусад нь хийгдэнэ.)
_gs_style_dir = settings.GEOSERVER_DATA_DIR or os.path.join(settings.MEDIA_ROOT, "geoserver_data")
geoserver_style_storage = OverwriteStorage(
    location=os.path.join(_gs_style_dir, "workspaces")
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
	# Нэрийн ангилалд (GEONAME_TYPES): газрын зурагт харуулах эсэх. Урьд per-type
	# view үүсгэх/устгах toggle байсан — одоо ганц geoname_view архитектурт зөвхөн
	# модонд харагдах эсэхийг удирдана.
	is_map_active = models.BooleanField(default=True, verbose_name='Газрын зурагт харуулах')
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
	sso_id = models.UUIDField(default=uuid.uuid4,unique=True,editable=False,verbose_name='SSO дугаар',help_text='Төвлөрсөн нэвтрэлтийн SSO дугаар.')
	first_name = models.CharField(max_length=100,verbose_name='Нэр',help_text='Хэрэглэгчийн өөрийн нэр.')
	last_name = models.CharField(max_length=100,verbose_name='Овог',help_text='Хэрэглэгчийн овог.')
	roles=models.ManyToManyField(Constant,related_name='roles',verbose_name='Нэмэлт эрхүүд',help_text='Хэрэглэгчид ногдох нэмэлт эрхүүд.')
	
	photo=models.ImageField(upload_to=get_profile_photo_upload_path,verbose_name='Лого',blank=True,null=True,help_text='Хэрэглэгчийн зураг эсвэл лого.')
	email = models.EmailField(_("email address"),blank=True,help_text='Хэрэглэгчийн имэйл хаяг.')
	is_citizen = models.BooleanField(default=False,verbose_name="",help_text='Иргэн эсэхийг илэрхийлнэ. Иргэн бол үнэн (True).')
	phone=models.CharField(max_length=50,blank=True,null=True,verbose_name='Утас',help_text='Холбоо барих утасны дугаар.')
	register=models.CharField(max_length=30,unique=True,verbose_name='Регистр',error_messages={ "unique": "Регистр бүртгэгдсэн байна" },help_text='Иргэн эсвэл байгууллагын регистрийн дугаар.')
	unit=models.ManyToManyField(AdminUnit,verbose_name='Хил',related_name='relatedunits',blank=True,help_text='Харьяалагдах захиргааны нэгжүүд.')
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
	geom = models.GeometryField(blank = True,null=True,verbose_name='Хил')
	center = models.PointField(blank = True,null=True,verbose_name='Төв цэг')
	nomek = models.CharField(max_length=25,verbose_name='Нэрлэвэр',blank=True,null=True)
	scale=models.ForeignKey(Constant,on_delete=models.CASCADE,limit_choices_to={'key':'MAPSCALES'},verbose_name='Төрөл',related_name='scales',blank=True,null=True)
	parent = models.ForeignKey('self',on_delete=models.CASCADE,related_name='children',blank=True,null=True,verbose_name='Дээд нэрлэвэр')
	# def save(self, *args, **kwargs):
	# 	latitude, longitude = self.center.y, self.center.x
	# 	bmin=latitude-10/60
	# 	bmax=latitude+10/60
	# 	lmin=longitude-15/60
	# 	lmax=longitude+15/60
	# 	polygon = Polygon.from_bbox((lmin, bmin, lmax, bmax))
	# 	self.geom = polygon
	# 	super().save(*args, **kwargs)

class Project(models.Model):
	name=models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	percent = models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	org=models.ForeignKey(RemoteUser, on_delete=models.CASCADE, verbose_name='Хэрэглэгч', related_name='rojects',blank=True, null=True)
	dugaar=models.CharField(max_length=2000, verbose_name='Дугаар',default="un", blank=True, null=True)
	signed_date=models.DateTimeField(blank=True,null=True, verbose_name='Эхэлсэн огноо')
	end_date=models.DateTimeField(blank=True,null=True, verbose_name='Дуусах огноо')
	units=models.ManyToManyField(AdminUnit,related_name='projectunits',verbose_name='Хил',blank=True)

class ProjectArea(UserMixin):
	project=models.ForeignKey(Project,on_delete=models.CASCADE,verbose_name='Төсөл', related_name='covers',blank=True, null=True)
	area=models.GeometryField(blank = True,null=True,srid=4326,verbose_name='Газарзүйн байрлал')
	is_finished=models.BooleanField(default=False,verbose_name='Дууссан эсэх',blank=True,null=True)	

class GeoName(UserMixin):
	name=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр')
	name_eng=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Нэр (English)')
	number=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Дугаар')
	type=  models.ForeignKey(Constant,on_delete=models.CASCADE,blank=True,null=True,related_name='centerlocations',limit_choices_to={'key':'GEONAME_TYPES'},verbose_name='Төрөл')
	nomek = models.ManyToManyField(Nomek,related_name='nomeknames',verbose_name='Нэрлэвэр',blank=True)
	unit=models.ManyToManyField(AdminUnit,related_name='unitnames',verbose_name='Хил',blank=True)
	geoloc = models.GeometryField(blank = True,null=True,srid=4326,verbose_name='Газарзүйн байрлал')
	height=models.FloatField(blank=True,null=True,verbose_name='Өндөр')
	is_approved=models.BooleanField(default=False,verbose_name='Төлөв',blank=True,null=True)
	passport=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Хувийн хэрэг')
	# orders=models.ManyToManyField(LegalOrder, related_name='ordernames', verbose_name='Эрх зүйн баримт бичиг', blank=True)
	is_border=models.BooleanField(default=False,verbose_name='Хил цэс эсэх',blank=True,null=True)
	other=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Бусад')

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

class LegalOrder(UserMixin):
	names=models.ManyToManyField(GeoName,related_name='legalorders',verbose_name='Нэрлэвэр',blank=True)
	projects=models.ManyToManyField(Project,related_name='projectorders',verbose_name='Төслүүд',blank=True)
	name=models.CharField(max_length=2000, verbose_name='Нэр',default="un", blank=True, null=True)
	unit=models.ForeignKey(AdminUnit, on_delete=models.CASCADE, verbose_name='ЗЗНэгж', related_name='legalorders',blank=True, null=True)
	org=models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'LEGAL_TYPES'}, blank=True, null=True, related_name='legalorgs', verbose_name='Төрөл')
	type=models.ForeignKey(Constant, on_delete=models.CASCADE,limit_choices_to={'key':'ORDER_TYPES'}, blank=True, null=True, related_name='legalorders', verbose_name='Төрөл')
	description=models.TextField(verbose_name='Тайлбар', blank=True, null=True)
	order_date=models.DateField(verbose_name='Гарсан огноо', blank=True, null=True)
	order_number=models.CharField(max_length=255, verbose_name='Дугаар', blank=True, null=True)
	document=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Баримт бичиг')
	signer=models.CharField(max_length=255, verbose_name='Гарын үсэг', blank=True, null=True)


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

class RequestNameContact(models.Model):
	"""Хүсэлтийн «холбоо барих хүн». Хүний мэдээлэл (овог, нэр, регистр, утас,
	имэйл) ЭНД ДАВХАРДУУЛЖ хадгалагдахгүй — RemoteUser (person) дээр л байна."""
	request=models.ForeignKey(RequestName,on_delete=models.CASCADE,verbose_name='Нэр', related_name='namecontacts',blank=True, null=True)
	project=models.ForeignKey(Project,on_delete=models.CASCADE,verbose_name='Төсөл', related_name='namecontacts',blank=True, null=True)
	role=models.ForeignKey(Constant,on_delete=models.CASCADE,limit_choices_to={'key':'RECOUNT_ROLES'},verbose_name='Төрөл',related_name='namecontacts',blank=True, null=True)
	document=models.ForeignKey(LegalOrder,on_delete=models.CASCADE,limit_choices_to={'key':'DOCUMENT_TYPES'},verbose_name='Төрөл',related_name='namecontacts',blank=True, null=True)
	# Хүн — системийн хэрэглэгч (регистрээр олох/үүсгэх: core.person)
	person=models.ForeignKey(RemoteUser,on_delete=models.SET_NULL,verbose_name='Хүн', related_name='namecontacts',blank=True, null=True)
	# Зөвхөн энэ бүртгэлд хамаарах нэмэлт (RemoteUser дээр байхгүй)
	address=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Хаяг')

	def __str__(self):
		return f'{self.person or "—"}'

class Photo(models.Model):
	file = models.ImageField(upload_to=photo_upload_path,blank=True, null=True,verbose_name='Зураг')
	desc = models.CharField(max_length=50, blank=True, null=True, verbose_name='Зовхис')
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

class GeoNameInquire(UserMixin):
	"""Батлагдсан газар зүйн нэрийн ЛАВЛАГАА. "Лавлагаа авах" дарахад үүснэ.
	code нь давтагдашгүй — QR түүнийг агуулж, нийтийн хуудсанд лавлагааны хүчинтэй
	эсэх (нэр батлагдсан + хугацаа) + үүсгэсэн огноог харуулна (point.geodesy‑тэй ижил)."""
	name=models.ForeignKey(GeoName,on_delete=models.CASCADE,verbose_name='Газар зүйн нэр',related_name='inquires',blank=True,null=True)
	code=models.CharField(max_length=32,unique=True,db_index=True,verbose_name='Лавлагааны дугаар')
	purpose=models.CharField(max_length=2000,blank=True,null=True,verbose_name='Зориулалт')
	valid_until=models.DateTimeField(blank=True,null=True,verbose_name='Хүчинтэй хугацаа')

	def save(self,*args,**kwargs):
		if not self.code:
			self.code=uuid.uuid4().hex
		super().save(*args,**kwargs)

	def __str__(self):
		return f'{self.code} — {self.name}'

	class Meta:
		verbose_name_plural='GeoNameInquire'

class ReCount(UserMixin):
	project=models.ForeignKey(Project,on_delete=models.CASCADE,verbose_name='Төсөл', related_name='recounts',blank=True, null=True)
	step=models.ForeignKey(Constant,on_delete=models.CASCADE,limit_choices_to={'key':'RECOUNT_STEPS'},verbose_name='Төрөл',related_name='recountsteps',blank=True, null=True)
	name=models.ForeignKey(GeoName,on_delete=models.CASCADE,verbose_name='Нэр', related_name='recounts',blank=True, null=True)
	draft=models.CharField(max_length=1000,blank=True,null=True,verbose_name='Төсөл')
	type=models.ForeignKey(Constant,on_delete=models.SET_NULL,limit_choices_to={'key':'GEONAME_TYPES'},verbose_name='Ангилал',related_name='recounttypes',blank=True,null=True)
	nomeks=models.ManyToManyField(Nomek,related_name='recount100',verbose_name='Нэрлэвэр',blank=True)
	loc=models.GeometryField(blank = True,null=True,srid=4326,verbose_name='Газарзүйн байрлал')
	statuses=models.ManyToManyField(Constant,limit_choices_to={'key':'RECOUNT_STATUS'},verbose_name='Төлөв',related_name='recount_multi_statuses',blank=True)
	# Хилийн цэс — батлагдсан нэргүй (draft) тодруулалтад ЭНД, батлагдсан нэртэйд
	# GeoName.is_border дээр хадгалагдана (recount_view нь хоёуланг COALESCE‑дэнэ)
	is_border=models.BooleanField(default=False,verbose_name='Хилийн цэс')

class ReCountMap(models.Model):
	names=models.ManyToManyField(ReCount,verbose_name='Нэрс', related_name='recountmaps')
	file=models.FileField(upload_to=file_upload_path,blank=True, null=True,verbose_name='Зураг')
	sources=models.ManyToManyField(Constant,related_name='recountmapssources',limit_choices_to={'key':'SOURCES'},verbose_name='Төрөл',blank=True)

class GeoNameSource(models.Model):
	name=models.ForeignKey(GeoName, on_delete=models.CASCADE, related_name='sources', verbose_name='Нэр')
	order=models.ForeignKey(LegalOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='name_sources', verbose_name='Тогтоол')
	volume=models.CharField(max_length=50, blank=True, null=True, verbose_name='Боть')
	page=models.IntegerField(blank=True, null=True, verbose_name='Хуудас')
	line=models.IntegerField(blank=True, null=True, verbose_name='Мөр')
	raw_text=models.CharField(max_length=1000, blank=True, null=True, verbose_name='Эх мөр')
	confidence=models.FloatField(blank=True, null=True, verbose_name='Итгэлийн оноо')
	needs_review=models.BooleanField(default=False, verbose_name='Хянах шаардлагатай')
	class Meta:
		indexes=[models.Index(fields=['volume','page'])]
	def __str__(self):
		return f'{self.name} — {self.volume} х.{self.page}'

class RasterMap(UserMixin):
	names=models.ManyToManyField(GeoName,related_name='namemaps',verbose_name='Нэрлэвэр',blank=True)
	projects=models.ManyToManyField(Project,related_name='projectmaps',verbose_name='Төслүүд',blank=True)
	unit=models.ForeignKey(AdminUnit, on_delete=models.CASCADE, verbose_name='ЗЗНэгж', related_name='mapunits',blank=True, null=True)
	nomek=models.ForeignKey(Nomek, on_delete=models.CASCADE, verbose_name='Нэрлэвэр', related_name='mapnomeks',blank=True, null=True)
	description=models.TextField(verbose_name='Тайлбар', blank=True, null=True)
	map_date=models.DateField(verbose_name='Гарсан огноо', blank=True, null=True)
	is_geo=models.BooleanField(default=False,verbose_name='Холболттой эсэх')
	file=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Газрын зураг')

class PrintMap(UserMixin):
	"""Газар зүйн нэрийн зургийн ХЭВЛЭЛИЙН ЭХ (PDF). Аймгийн нэг буюу хэд хэдэн
	сум сонгоод тэр хил доторх нэрсийг тор+бүрдэлтэйгээр A0 PDF болгож үүсгэнэ.
	Гарчиг сонгогдсон сумдаас авто-үүснэ ("Дундговь аймгийн Эрдэнэдалай, Хулд
	сумын газар зүйн нэрийн зураг"). UserMixin-ээс хэн (user), хэдэн онд
	(created_date) хэвлэсэн нь ирнэ."""
	units=models.ManyToManyField(AdminUnit, related_name='printmaps', blank=True, verbose_name='Сонгогдсон сумд')
	# Ажлын зураг (хээрийн тодруулалт) бол ямар төслийнх бэ — нэрийн зурагт null
	project=models.ForeignKey('Project', on_delete=models.CASCADE, blank=True, null=True,
		related_name='printmaps', verbose_name='Төсөл')
	is_border=models.BooleanField(default=False, verbose_name='Хилийн цэс')
	name_count=models.IntegerField(default=0, verbose_name='Багтсан нэрийн тоо')
	title=models.CharField(max_length=500, blank=True, null=True, verbose_name='Зургийн нэр (авто)')
	scale=models.IntegerField(blank=True, null=True, verbose_name='Масштаб')
	file=models.FileField(upload_to=file_upload_path, blank=True, null=True, verbose_name='Хэвлэлийн эх (PDF)')
	class Meta:
		verbose_name='Хэвлэлийн эх'
		verbose_name_plural='Хэвлэлийн эх'

	def __str__(self):
		return f'{self.title or "Хэвлэлийн эх"} — {self.name_count} нэр'

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

class Council(models.Model):
	"""Газар зүйн нэрийн зөвлөл — үндэсний (нэг) эсвэл салбар (аймаг/сум/дүүрэг
	бүрд). Зөвлөл өөрөө устдаггүй — status=татан буугдсан + dissolved_doc тавина."""
	name = models.CharField(max_length=1000, verbose_name='Нэр')
	kind = models.ForeignKey(Constant, on_delete=models.SET_NULL, null=True, blank=True,
		limit_choices_to={'key': 'COUNCIL_KINDS'}, related_name='council_kinds', verbose_name='Төрөл')
	unit = models.ForeignKey(AdminUnit, on_delete=models.SET_NULL, null=True, blank=True,
		related_name='councils', verbose_name='Харьяа нэгж')
	status = models.ForeignKey(Constant, on_delete=models.SET_NULL, null=True, blank=True,
		limit_choices_to={'key': 'COUNCIL_STATUS'}, related_name='council_statuses', verbose_name='Төлөв')
	established_doc = models.ForeignKey('LegalOrder', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='established_councils', verbose_name='Байгуулсан баримт')
	dissolved_doc = models.ForeignKey('LegalOrder', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='dissolved_councils', verbose_name='Татан буулгасан баримт')
	established_date = models.DateField(null=True, blank=True, verbose_name='Байгуулсан огноо')
	dissolved_date = models.DateField(null=True, blank=True, verbose_name='Татан буугдсан огноо')
	created_date = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return self.name or f'Council#{self.pk}'


class CouncilMember(models.Model):
	"""Зөвлөлийн гишүүний ТОМИЛГОО — temporal, append-only архив. Мөр устгахгүй;
	чөлөөлөхдөө end_date + release_doc тавина. Өөрчлөлт бүр баримтаар (LegalOrder)
	баталгаажна (appoint_doc заавал)."""
	council = models.ForeignKey(Council, on_delete=models.CASCADE, related_name='members', verbose_name='Зөвлөл')
	# Хүн — овог, нэр, регистр, утас нь ЗӨВХӨН RemoteUser дээр (давхардуулахгүй)
	person = models.ForeignKey(RemoteUser, on_delete=models.SET_NULL, null=True, blank=True,
		related_name='council_memberships', verbose_name='Хүн')
	position = models.ForeignKey(Constant, on_delete=models.SET_NULL, null=True, blank=True,
		limit_choices_to={'key': 'MEMBER_TYPES'}, related_name='council_positions', verbose_name='Албан тушаал')
	org_title = models.CharField(max_length=1000, null=True, blank=True, verbose_name='Төлөөлж буй албан тушаал')
	start_date = models.DateField(verbose_name='Томилогдсон огноо')
	end_date = models.DateField(null=True, blank=True, verbose_name='Чөлөөлөгдсөн огноо')
	appoint_doc = models.ForeignKey('LegalOrder', on_delete=models.PROTECT,
		related_name='council_appointments', verbose_name='Томилсон баримт')
	release_doc = models.ForeignKey('LegalOrder', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='council_releases', verbose_name='Чөлөөлсөн баримт')
	created_date = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-start_date', 'id']
		indexes = [models.Index(fields=['council', 'end_date'])]

	def __str__(self):
		return f'{self.person or "—"} | {self.council_id} ({"идэвхтэй" if self.end_date is None else "хуучин"})'

class ProjectMember(UserMixin):
	"""Төслийн багийн бүрэлдэхүүн — үе шат (step) ба сум (unit) тус бүрээр.

	Хүнийг регистрээр нь олж/бүртгэж (core.person) RemoteUser‑т холбоно —
	овог, нэр, регистр, утсыг энд давхардуулж хадгалахгүй.
	"""
	project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members', verbose_name='Төсөл')
	unit = models.ForeignKey(AdminUnit, on_delete=models.CASCADE, null=True, blank=True,
		related_name='project_members', verbose_name='Сум/Дүүрэг')
	# Хүн — овог, нэр, регистр, утас нь ЗӨВХӨН RemoteUser дээр (давхардуулахгүй)
	person = models.ForeignKey(RemoteUser, on_delete=models.SET_NULL, null=True, blank=True,
		related_name='projects', verbose_name='Хүн')
	position = models.ForeignKey(Constant, on_delete=models.SET_NULL, null=True, blank=True,
		limit_choices_to={'key': 'PROJECT_MEMBER_TYPES'}, related_name='project_positions', verbose_name='Албан тушаал')
	org_title = models.CharField(max_length=1000, null=True, blank=True, verbose_name='Төлөөлж буй албан тушаал')
	# Үе шат — RECOUNT_STEPS (ж: Хээрийн судалгаа). Багийн бүрэлдэхүүн үе шат тус бүрд.
	step = models.ForeignKey(Constant, on_delete=models.SET_NULL, null=True, blank=True,
		limit_choices_to={'key': 'RECOUNT_STEPS'},
		related_name='project_member_steps', verbose_name='Үе шат')
	# Томилсон шийдвэр — заавал биш (ажилтныг эхэлж бүртгээд дараа нь холбож болно)
	doc = models.ForeignKey('LegalOrder', on_delete=models.SET_NULL, null=True, blank=True,
		related_name='project_documents', verbose_name='Томилсон баримт')
	class Meta:
		ordering = ['-created_date', 'id']
		indexes = [models.Index(fields=['project', 'created_date'])]

	def __str__(self):
		return f'{self.person or "—"} | {self.project_id} ({"идэвхтэй" if self.created_date is None else "хуучин"})'


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

	# layer нь nameclass leaf (GEONAME_TYPES Constant) — тухайн view‑ийн "давхарга".
	# Нэг навч (view) олон дүрэмтэй; SLD дээр дүрэм бүр rule.id‑гээр нэрлэгдэнэ.
	layer = models.ForeignKey(Constant, on_delete=models.CASCADE, related_name="rules",
							  limit_choices_to={'key': 'GEONAME_TYPES'})
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
		]
	def __str__(self):
		# Легендийн нэр нь nameclass leaf (layer)‑ийн нэр.
		return (self.layer.name if self.layer_id else None) or f"rule:{self.pk}"
	
class LayerGroup(models.Model):
	name = models.CharField(max_length=100)

class LayerGroupItem(models.Model):
	group = models.ForeignKey(LayerGroup, on_delete=models.CASCADE, related_name='items')
	layer = models.ForeignKey(Constant, on_delete=models.CASCADE, related_name='group_items')
	order = models.PositiveIntegerField(default=0)
	visible = models.BooleanField(default=True)
	class Meta:
		unique_together = ('group', 'layer')  # нэг group-д ижил combo давтагдахгүй
		ordering = ['order', 'id']


class BaseMapLayer(models.Model):
	"""Газрын зургийн СУУРЬ (base) болон НЭМЭЛТ (overlay) давхаргын тохиргоо.

	Админ /settings/gis?tab=basemap дээр удирдана: нэр солих, нээх/хаах,
	эрэмбэлэх, base/overlay эсэхийг тохируулах. Хэрэглэгчийн role‑оор шүүж
	frontend руу дамжуулна (roles ХООСОН бол бүх хэрэглэгчид харагдана)."""
	LAYER_TYPES = [('base', 'Суурь давхарга'), ('overlay', 'Нэмэлт давхарга')]
	SOURCE_TYPES = [
		('blank', 'Хоосон (blank)'),
		('xyz', 'XYZ (гадаад тайл)'),
		('osm', 'OpenStreetMap'),
		('wms', 'WMS (GeoServer/GWC)'),
		('wmts', 'WMTS (GeoServer/GWC кэш)'),
	]
	key = models.CharField(max_length=64, unique=True, verbose_name='Түлхүүр')
	label = models.CharField(max_length=200, verbose_name='Харагдах нэр')
	layer_type = models.CharField(
		max_length=16, choices=LAYER_TYPES, default='base', verbose_name='Төрөл')
	source_type = models.CharField(
		max_length=16, choices=SOURCE_TYPES, default='wms', verbose_name='Эх сурвалж')
	# GeoServer давхаргын хувьд:
	workspace = models.CharField(max_length=100, blank=True, default='', verbose_name='Workspace')
	gs_layer = models.CharField(max_length=200, blank=True, default='', verbose_name='GeoServer давхарга')
	# Гадаад XYZ эсвэл GeoServer‑ийн суурь URL:
	url = models.TextField(blank=True, default='', verbose_name='URL')
	# Нэмэлт параметр (STYLES, CQL_FILTER, gridset, maxZoom г.м.):
	params = models.JSONField(blank=True, null=True, default=dict, verbose_name='Нэмэлт параметр')
	color = models.CharField(max_length=32, blank=True, default='', verbose_name='Өнгө/дүрс')
	is_enabled = models.BooleanField(default=True, verbose_name='Идэвхтэй (нээх/хаах)')
	sort_order = models.PositiveIntegerField(default=0, verbose_name='Эрэмбэ')
	# roles ХООСОН → бүх хэрэглэгчид. Утгатай → зөвхөн тэр role‑той хэрэглэгчид.
	roles = models.ManyToManyField(
		Constant, blank=True, related_name='basemap_layers', verbose_name='Харах эрх (role)')
	created_date = models.DateTimeField(auto_now_add=True)
	modified_date = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'Суурь/нэмэлт давхарга'
		verbose_name_plural = 'Газрын зургийн давхаргууд'
		ordering = ['layer_type', 'sort_order', 'id']

	def __str__(self):
		return f'{self.label} ({self.key}) [{self.layer_type}]'
