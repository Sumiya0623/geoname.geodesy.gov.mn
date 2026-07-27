# -*- coding: utf-8 -*-
"""Байр зүйн объектын каталог — INSPIRE/ISO 19110-д суурилсан GeoDjango schema.

Загварчлалын хүрээ:
  • Аргачлал — ISO 19110 (feature cataloguing): feature type бүр код, нэр, тодорхойлолт,
               төрөлжсөн атрибут (домэйнтэй), геометртэй.
  • Агуулга  — INSPIRE data specifications (сэдэв бүрийн дата модель).
  • Код      — DGIWG/FACC + OSM-д уялдсан УДИРДЛАГАТАЙ ТОЛЬ (`MapConstant`).
  • Залгамж  — GOST/условные знаки-тай `feature_code` / `symbol`-оор холбогдоно.

Зохион байгуулалт: объект бүрт хүснэгт биш — СЭДЭВ (код 10–90) → ГЕОМЕТР → `category`.
  10 Геодези · 20 Рельеф · 30 Ус зүй · 40 Ургамал/хөрс · 50 Зам харилцаа
  60 Суурин/барилга · 70 Хил зааг · 80 Дэд бүтэц · 90 Газарзүйн нэр

Codelist засаглал: төрлүүдийг эх кодод static (TextChoices) хадгалахгүй. Бүх хязгаартай
утга `MapConstant` хүснэгтэд `key`-ээр (домэйн) ялгагдан хадгалагдана. Шинэ төрөл нэмэх =
`MapConstant`-д мөр нэмэх (эх код засахгүй).

Байршил: энэ файл `apps/map/map_models.py`, `apps.map` (label "map") app-д харьяалагдана.
DB router (core.db_routers.MapRouter) эдгээрийг `basemap` DB рүү чиглүүлнэ — OSM түүхий
дата ба GeoServer тэнд байгаа тул транформ/дүрслэл нэг DB дотор.
"""

import uuid

from django.contrib.gis.db import models
from django.utils.translation import gettext_lazy as _


# ───────────────────────── Codelist домэйн-ийн key (MapConstant.key) ─────────────────────────
# Эдгээр нь ДОМЭЙН-ий нэр (утгын жагсаалт биш) — цөөн, тогтвортой. Утгууд нь MapConstant-д
# мөр болж хадгалагдана. limit_choices_to эдгээрээр форм/админы сонголтыг шүүнэ.
CK_LIFECYCLE          = "LIFECYCLE"
CK_SOURCE             = "SOURCE"
CK_GEODETIC_CLASS     = "GEODETIC_CLASS"
CK_CONTOUR_TYPE       = "CONTOUR_TYPE"
CK_RELIEF_TYPE        = "RELIEF_TYPE"
CK_WATERCOURSE_TYPE   = "WATERCOURSE_TYPE"
CK_WATERBODY_TYPE     = "WATERBODY_TYPE"
CK_PERSISTENCE        = "PERSISTENCE"
CK_HYDRO_POINT_TYPE   = "HYDRO_POINT_TYPE"
CK_LANDCOVER_CLASS    = "LANDCOVER_CLASS"
CK_VEGETATION_TYPE    = "VEGETATION_TYPE"
CK_ROAD_CLASS         = "ROAD_CLASS"
CK_SURFACE_TYPE       = "SURFACE_TYPE"
CK_RAILWAY_CLASS      = "RAILWAY_CLASS"
CK_TRANSPORT_STRUCT   = "TRANSPORT_STRUCTURE_TYPE"
CK_BUILDING_CLASS     = "BUILDING_CLASS"
CK_SETTLEMENT_CLASS   = "SETTLEMENT_CLASS"
CK_ADMIN_LEVEL        = "ADMIN_LEVEL"
CK_BOUNDARY_STATUS    = "BOUNDARY_STATUS"
CK_UTILITY_TYPE       = "UTILITY_TYPE"
CK_UTILITY_POINT_TYPE = "UTILITY_POINT_TYPE"
CK_TOPONYM_CLASS      = "TOPONYM_CLASS"
CK_NAME_SCRIPT        = "NAME_SCRIPT"
CK_LANGUAGE           = "LANGUAGE"
CK_NAME_STATUS        = "NAME_STATUS"
CK_SERVICE_TYPE       = "SERVICE_TYPE"          # GovernmentalService (INSPIRE ServiceTypeValue)
CK_BUSINESS_TYPE      = "BUSINESS_TYPE"          # BusinessService (худалдаа/үйлчилгээ)
CK_OTHER_CONSTRUCTION = "OTHER_CONSTRUCTION"     # OtherConstruction (INSPIRE Buildings)


# ───────────────────────────── Удирдлагатай толь (codelist) ─────────────────────────────

class MapConstant(models.Model):
    """Байр зүйн каталогийн удирдлагатай толь (ISO 19110 code list).

    Нэг мөр = нэг код утга. `key` нь домэйн (ROAD_CLASS…), `code` нь утга (trunk),
    `name` нь харагдах нэр. Шинэ төрөл нэмэх = мөр нэмэх (эх код засахгүй). `parent`-аар
    шатлал (сэдэв→төрөл), `color`/`symbol`-оор дүрслэл (условный знак) уялдана.
    """
    key = models.CharField(_("Домэйн (key)"), max_length=48, db_index=True)
    code = models.CharField(_("Код утга"), max_length=48)
    name = models.CharField(_("Нэр"), max_length=160)
    name_en = models.CharField(_("Нэр (англи)"), max_length=160, blank=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="children", verbose_name=_("Эцэг"))
    color = models.CharField(_("Өнгө (style)"), max_length=20, blank=True)
    symbol = models.CharField(_("Условный знак код"), max_length=80, blank=True)
    sort_order = models.IntegerField(_("Эрэмбэ"), default=0)
    active = models.BooleanField(_("Идэвхтэй"), default=True)

    class Meta:
        app_label = "map"
        db_table = "map_constant"
        unique_together = ("key", "code")
        ordering = ["key", "sort_order", "code"]
        verbose_name = _("Каталогийн толь")
        verbose_name_plural = _("Каталогийн толь (codelist)")

    def __str__(self):
        return f"{self.key}:{self.code} — {self.name}"


def catref(key, verbose, *, required=False):
    """MapConstant руу чиглэсэн codelist FK үүсгэх туслах. `key`-ээр сонголтыг шүүнэ.

    Код засалгүйгээр төрөл нэмэх боломжтой (MapConstant мөр нэмэхэд л сонголт өргөжнө).
    on_delete=PROTECT — ашиглагдаж буй код утгыг санамсаргүй устгахаас хамгаална.
    """
    return models.ForeignKey(
        MapConstant, on_delete=models.PROTECT, related_name="+",
        null=not required, blank=not required,
        limit_choices_to={"key": key, "active": True},
        verbose_name=verbose,
    )


# ───────────────────────────── INSPIRE GeographicalName ─────────────────────────────

class FeatureName(models.Model):
    """INSPIRE GN — GeographicalName. Нэг объект ОЛОН нэртэй байж болно (хэл, бичиг,
    төлөв, эх сурвалж). Аль ч feature model-д (`feature_table` + `feature_id`)-ээр
    холбогдоно — ContentType-гүй бие даасан холбоос, тиймээс basemap DB дотор бүрэн
    ажиллана (Django-ийн default DB дэх django_content_type-аас хамаарахгүй)."""
    feature_table = models.CharField(_("Объектын хүснэгт"), max_length=48, db_index=True)  # ж: map_road
    feature_id = models.PositiveIntegerField(_("Объект id"), db_index=True)

    text = models.CharField(_("Нэр"), max_length=254)
    language = catref(CK_LANGUAGE, _("Хэл"))               # ISO 639 (mn, en, zh…)
    script = catref(CK_NAME_SCRIPT, _("Бичиг"))            # Cyrl, Mong, Latn…
    name_status = catref(CK_NAME_STATUS, _("Нэрийн төлөв"))  # official/alternative/historical
    source_of_name = models.CharField(_("Нэрийн эх сурвалж"), max_length=200, blank=True)
    is_primary = models.BooleanField(_("Үндсэн нэр"), default=False)

    class Meta:
        app_label = "map"
        db_table = "map_feature_name"
        indexes = [models.Index(fields=["feature_table", "feature_id"])]
        verbose_name = _("Объектын нэр")
        verbose_name_plural = _("Объектын нэр (INSPIRE GN)")

    def __str__(self):
        return self.text


# ───────────────────────────── Абстракт суурь (ISO 19110) ─────────────────────────────

class FeatureBase(models.Model):
    """Бүх feature type-ийн нийтлэг атрибут. Дэд класс `FEATURE_CODE`/`FEATURE_THEME`-ээ
    зарлаж, өөрийн `geom`-оо нэмнэ (геометрийн төрөл ялгаатай тул суурьт тавихгүй)."""
    FEATURE_CODE = None
    FEATURE_THEME = None

    # Үндсэн харагдах нэр (denormalized cache). Бүрэн олон хэл/бичгийн нэр нь `names`
    # (INSPIRE GeographicalName) дотор — эдгээр нь зөвхөн хурдан хайлт/дүрслэлийн хувилбар.
    name = models.CharField(_("Нэр (кирилл)"), max_length=254, blank=True, db_index=True)
    name_mong = models.CharField(_("Нэр (монгол бичиг)"), max_length=254, blank=True)
    name_galig = models.CharField(_("Нэр (галиг)"), max_length=254, blank=True)
    name_en = models.CharField(_("Нэр (англи)"), max_length=254, blank=True)
    status = catref(CK_LIFECYCLE, _("Төлөв"))       # амьдралын мөчлөг (codelist)
    source = catref(CK_SOURCE, _("Эх сурвалж"))     # эх сурвалж (codelist)
    source_osm_id = models.BigIntegerField(_("OSM id"), null=True, blank=True, db_index=True)
    note = models.CharField(_("Тэмдэглэл"), max_length=500, blank=True)
    # INSPIRE — гадаад объект идентификатор (inspireId = namespace + localId + versionId).
    inspire_namespace = models.CharField(_("INSPIRE namespace"), max_length=64, default="MN.GEO")
    inspire_local_id = models.UUIDField(_("INSPIRE localId"), default=uuid.uuid4, editable=False, db_index=True)
    inspire_version = models.CharField(_("Хувилбар (versionId)"), max_length=32, blank=True)
    # INSPIRE — lifespan versioning: тухайн ХУВИЛБАР дата санд орсон/хүчингүй болсон агшин.
    # (created_at/updated_at нь DB бичлэгийн огноо — өөр ойлголт.) end_lifespan=NULL → идэвхтэй.
    begin_lifespan = models.DateTimeField(_("Хувилбар эхэлсэн"), null=True, blank=True)
    end_lifespan = models.DateTimeField(_("Хувилбар дууссан"), null=True, blank=True)
    # Урт сүүл — ховор/сунадаг атрибутыг schema өөрчлөхгүйгээр (INSPIRE extended profile,
    # OSM other_tags-ийн цэвэр хувилбар). Байнга хэрэглэх key-г цаг хугацаанд typed
    # багана болгож "дэвшүүлнэ". Жишээ: {"roof_type":"gable","year_built":1998}.
    ext = models.JSONField(_("Нэмэлт атрибут"), default=dict, blank=True)
    created_at = models.DateTimeField(_("Үүсгэсэн"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Зассан"), auto_now=True)

    class Meta:
        app_label = "map"
        abstract = True

    @property
    def inspire_id(self):
        """INSPIRE inspireId бүтэн хэлбэр: namespace / localId [ / versionId ]."""
        base = f"{self.inspire_namespace}/{self.inspire_local_id}"
        return f"{base}/{self.inspire_version}" if self.inspire_version else base

    @property
    def names(self):
        """INSPIRE GeographicalName-ууд (олон хэл/бичиг). ContentType-гүй холбоос."""
        return FeatureName.objects.filter(feature_table=self._meta.db_table, feature_id=self.pk)

    def add_name(self, text, **kw):
        """Тухайн объектод нэр (FeatureName) нэмэх туслах."""
        return FeatureName.objects.create(
            feature_table=self._meta.db_table, feature_id=self.pk, text=text, **kw)

    def __str__(self):
        return self.name or f"{self.FEATURE_CODE} #{self.pk}"


# ───────────────────────────── 10 · Геодезийн үндэслэл ─────────────────────────────

class GeodeticPoint(FeatureBase):
    """11 · Геодезийн цэг — триангуляц/GNSS/тэгшитгэлийн сүлжээ."""
    FEATURE_CODE, FEATURE_THEME = 11, 10
    category = catref(CK_GEODETIC_CLASS, _("Ангилал"))
    order = models.PositiveSmallIntegerField(_("Анги (класс)"), null=True, blank=True)
    height = models.DecimalField(_("Өндөр (м)"), max_digits=8, decimal_places=3, null=True, blank=True)
    mark_type = models.CharField(_("Тэмдэгтийн төрөл"), max_length=60, blank=True)
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_geodetic_point"
        verbose_name = _("Геодезийн цэг")
        verbose_name_plural = _("11 · Геодезийн цэг")


# ───────────────────────────── 20 · Рельеф ─────────────────────────────

class ContourLine(FeatureBase):
    """21 · Горизонталь — өндрийн шугам."""
    FEATURE_CODE, FEATURE_THEME = 21, 20
    elevation = models.DecimalField(_("Өндөр (м)"), max_digits=8, decimal_places=2, db_index=True)
    category = catref(CK_CONTOUR_TYPE, _("Төрөл"))
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_contour_line"
        verbose_name = _("Горизонталь")
        verbose_name_plural = _("21 · Горизонталь")


class SpotHeight(FeatureBase):
    """22 · Тэмдэгт өндөр."""
    FEATURE_CODE, FEATURE_THEME = 22, 20
    elevation = models.DecimalField(_("Өндөр (м)"), max_digits=8, decimal_places=2)
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_spot_height"
        verbose_name = _("Тэмдэгт өндөр")
        verbose_name_plural = _("22 · Тэмдэгт өндөр")


class ReliefFeature(FeatureBase):
    """23 · Рельефийн онцгой хэлбэр — хад, жалга, нуруу..."""
    FEATURE_CODE, FEATURE_THEME = 23, 20
    category = catref(CK_RELIEF_TYPE, _("Төрөл"))
    geom = models.GeometryField(_("Геометр"), srid=4326)  # цэг эсвэл шугам

    class Meta:
        app_label = "map"
        db_table = "map_relief_feature"
        verbose_name = _("Рельефийн хэлбэр")
        verbose_name_plural = _("23 · Рельефийн хэлбэр")


# ───────────────────────────── 30 · Ус зүй ─────────────────────────────

class Watercourse(FeatureBase):
    """31 · Урсгал ус — гол, горхи, суваг."""
    FEATURE_CODE, FEATURE_THEME = 31, 30
    category = catref(CK_WATERCOURSE_TYPE, _("Төрөл"))
    persistence = catref(CK_PERSISTENCE, _("Байнгын байдал"))
    width_m = models.DecimalField(_("Өргөн (м)"), max_digits=7, decimal_places=1, null=True, blank=True)
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_watercourse"
        verbose_name = _("Урсгал ус")
        verbose_name_plural = _("31 · Урсгал ус")


class WaterBody(FeatureBase):
    """32 · Зогсонги ус — нуур, усан сан."""
    FEATURE_CODE, FEATURE_THEME = 32, 30
    category = catref(CK_WATERBODY_TYPE, _("Төрөл"))
    persistence = catref(CK_PERSISTENCE, _("Байнгын байдал"))
    area_km2 = models.DecimalField(_("Талбай (км²)"), max_digits=10, decimal_places=3, null=True, blank=True)
    geom = models.MultiPolygonField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_water_body"
        verbose_name = _("Усан гадаргуу")
        verbose_name_plural = _("32 · Усан гадаргуу")


class HydroPoint(FeatureBase):
    """33 · Цэгэн ус зүйн объект — булаг, худаг, хүрхрээ."""
    FEATURE_CODE, FEATURE_THEME = 33, 30
    category = catref(CK_HYDRO_POINT_TYPE, _("Төрөл"))
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_hydro_point"
        verbose_name = _("Ус зүйн цэг")
        verbose_name_plural = _("33 · Ус зүйн цэг")


# ───────────────────────────── 40 · Ургамал ба хөрс ─────────────────────────────

class LandcoverArea(FeatureBase):
    """41 · Газрын бүрхэвч — ой, бэлчээр, элс, намаг, мөстөл..."""
    FEATURE_CODE, FEATURE_THEME = 41, 40
    category = catref(CK_LANDCOVER_CLASS, _("Бүрхэвчийн ангилал"))
    area_km2 = models.DecimalField(_("Талбай (км²)"), max_digits=10, decimal_places=3, null=True, blank=True)
    geom = models.MultiPolygonField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_landcover_area"
        verbose_name = _("Газрын бүрхэвч")
        verbose_name_plural = _("41 · Газрын бүрхэвч")


class VegetationFeature(FeatureBase):
    """42 · Цэгэн/шугаман ургамал — модны эгнээ, ганц мод."""
    FEATURE_CODE, FEATURE_THEME = 42, 40
    category = catref(CK_VEGETATION_TYPE, _("Төрөл"))
    geom = models.GeometryField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_vegetation_feature"
        verbose_name = _("Ургамлын объект")
        verbose_name_plural = _("42 · Ургамлын объект")


# ───────────────────────────── 50 · Зам харилцаа ─────────────────────────────

class Road(FeatureBase):
    """51 · Авто зам."""
    FEATURE_CODE, FEATURE_THEME = 51, 50
    category = catref(CK_ROAD_CLASS, _("Ангилал"))
    surface = catref(CK_SURFACE_TYPE, _("Хучилт"))
    width_m = models.DecimalField(_("Өргөн (м)"), max_digits=6, decimal_places=1, null=True, blank=True)
    lanes = models.PositiveSmallIntegerField(_("Эгнээ"), null=True, blank=True)
    ref = models.CharField(_("Дугаар"), max_length=40, blank=True)
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_road"
        verbose_name = _("Авто зам")
        verbose_name_plural = _("51 · Авто зам")


class Railway(FeatureBase):
    """52 · Төмөр зам."""
    FEATURE_CODE, FEATURE_THEME = 52, 50
    category = catref(CK_RAILWAY_CLASS, _("Ангилал"))
    gauge_mm = models.PositiveIntegerField(_("Замын өргөн (мм)"), null=True, blank=True)
    electrified = models.BooleanField(_("Цахилгаанжсан"), default=False)
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_railway"
        verbose_name = _("Төмөр зам")
        verbose_name_plural = _("52 · Төмөр зам")


class TransportStructure(FeatureBase):
    """53 · Тээврийн бүтэц — гүүр, хонгил, гарц, буудал."""
    FEATURE_CODE, FEATURE_THEME = 53, 50
    category = catref(CK_TRANSPORT_STRUCT, _("Төрөл"))
    length_m = models.DecimalField(_("Урт (м)"), max_digits=8, decimal_places=1, null=True, blank=True)
    material = models.CharField(_("Материал"), max_length=60, blank=True)
    geom = models.GeometryField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_transport_structure"
        verbose_name = _("Тээврийн бүтэц")
        verbose_name_plural = _("53 · Тээврийн бүтэц")


# ───────────────────────────── 60 · Суурин газар ба барилга ─────────────────────────────

class Building(FeatureBase):
    """61 · Барилга."""
    FEATURE_CODE, FEATURE_THEME = 61, 60
    category = catref(CK_BUILDING_CLASS, _("Зориулалт"))
    floors = models.PositiveSmallIntegerField(_("Давхар"), null=True, blank=True)
    addr_housenumber = models.CharField(_("Байрны дугаар"), max_length=64, blank=True, db_index=True)
    geom = models.MultiPolygonField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_building"
        verbose_name = _("Барилга")
        verbose_name_plural = _("61 · Барилга")


class SettlementArea(FeatureBase):
    """62 · Суурин газрын нутаг."""
    FEATURE_CODE, FEATURE_THEME = 62, 60
    category = catref(CK_SETTLEMENT_CLASS, _("Төрөл"))
    population = models.PositiveIntegerField(_("Хүн ам"), null=True, blank=True)
    geom = models.MultiPolygonField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_settlement_area"
        verbose_name = _("Суурин газар")
        verbose_name_plural = _("62 · Суурин газар")


class OtherConstruction(FeatureBase):
    """63 · Бусад байгууламж — барилга биш инженерийн байгууламж (хана, хашаа,
    хаалт, далан г.м.). INSPIRE Buildings → OtherConstruction."""
    FEATURE_CODE, FEATURE_THEME = 63, 60
    category = catref(CK_OTHER_CONSTRUCTION, _("Төрөл"))     # INSPIRE otherConstructionNature
    geom = models.GeometryField(_("Геометр"), srid=4326)     # шугам эсвэл талбай

    class Meta:
        app_label = "map"
        db_table = "map_other_construction"
        verbose_name = _("Бусад байгууламж")
        verbose_name_plural = _("63 · Бусад байгууламж")


# ───────────────────────────── 70 · Хил зааг ба засаг захиргаа ─────────────────────────────

class AdminBoundary(FeatureBase):
    """71 · Засаг захиргааны хилийн шугам."""
    FEATURE_CODE, FEATURE_THEME = 71, 70
    level = catref(CK_ADMIN_LEVEL, _("Түвшин"))
    boundary_status = catref(CK_BOUNDARY_STATUS, _("Хилийн төлөв"))
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_admin_boundary"
        verbose_name = _("Хилийн шугам")
        verbose_name_plural = _("71 · Хилийн шугам")


class AdminArea(FeatureBase):
    """72 · Засаг захиргааны нэгж (талбай). (core.AdminUnit-тэй давхцахгүй нэр.)"""
    FEATURE_CODE, FEATURE_THEME = 72, 70
    level = catref(CK_ADMIN_LEVEL, _("Түвшин"))
    admin_code = models.CharField(_("Нэгжийн код"), max_length=20, blank=True, db_index=True)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="children", verbose_name=_("Харьяалагдах нэгж"))
    geom = models.MultiPolygonField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_admin_unit"
        verbose_name = _("Засаг захиргааны нэгж")
        verbose_name_plural = _("72 · Засаг захиргааны нэгж")


# ───────────────────────────── 80 · Дэд бүтэц ─────────────────────────────

class UtilityLine(FeatureBase):
    """81 · Дэд бүтцийн шугам — цахилгаан, хоолой, холбоо."""
    FEATURE_CODE, FEATURE_THEME = 81, 80
    category = catref(CK_UTILITY_TYPE, _("Төрөл"))
    voltage_kv = models.DecimalField(_("Хүчдэл (кВ)"), max_digits=7, decimal_places=1, null=True, blank=True)
    geom = models.MultiLineStringField(_("Геометр"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_utility_line"
        verbose_name = _("Дэд бүтцийн шугам")
        verbose_name_plural = _("81 · Дэд бүтцийн шугам")


class UtilityPoint(FeatureBase):
    """82 · Дэд бүтцийн цэг — тулгуур, дэд станц, цооног."""
    FEATURE_CODE, FEATURE_THEME = 82, 80
    category = catref(CK_UTILITY_POINT_TYPE, _("Төрөл"))
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_utility_point"
        verbose_name = _("Дэд бүтцийн цэг")
        verbose_name_plural = _("82 · Дэд бүтцийн цэг")


class GovernmentalService(FeatureBase):
    """83 · Төрийн үйлчилгээ — INSPIRE US: GovernmentalService (сургууль, эмнэлэг,
    захиргаа, цагдаа, гал команд, номын сан г.м.). serviceType = ServiceTypeValue."""
    FEATURE_CODE, FEATURE_THEME = 83, 80
    category = catref(CK_SERVICE_TYPE, _("Үйлчилгээний төрөл"))   # INSPIRE ServiceTypeValue
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_governmental_service"
        verbose_name = _("Төрийн үйлчилгээ")
        verbose_name_plural = _("83 · Төрийн үйлчилгээ")


class BusinessService(FeatureBase):
    """84 · Худалдаа, үйлчилгээ — арилжааны цэг (дэлгүүр, ресторан, банк, буудал,
    ШТС г.м.). INSPIRE-т биш, практик суурь зургийн давхарга."""
    FEATURE_CODE, FEATURE_THEME = 84, 80
    category = catref(CK_BUSINESS_TYPE, _("Төрөл"))
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_business_service"
        verbose_name = _("Худалдаа, үйлчилгээ")
        verbose_name_plural = _("84 · Худалдаа, үйлчилгээ")


# ───────────────────────────── 90 · Газарзүйн нэр ─────────────────────────────

class Toponym(FeatureBase):
    """91 · Газарзүйн нэр — уул, гол, газрын нэр. Олон хэл/бичгийн нэр (Кирилл, Монгол
    бичиг, латин, хувилбар нэр) нь суурийн `names` (INSPIRE GeographicalName)-д —
    тусад нь хавтгай багана хийхгүй."""
    FEATURE_CODE, FEATURE_THEME = 91, 90
    category = catref(CK_TOPONYM_CLASS, _("Ангилал"))
    geom = models.PointField(_("Байрлал"), srid=4326)

    class Meta:
        app_label = "map"
        db_table = "map_toponym"
        verbose_name = _("Газарзүйн нэр")
        verbose_name_plural = _("91 · Газарзүйн нэр")
