# -*- coding: utf-8 -*-
"""OSM түүхий давхаргууд (osm_line/osm_multipolygon/osm_point) → каталогийн map_* хүснэгтүүд.

Хоёулаа basemap DB-д тул нэг DB дотор ажиллана. Таг-аар шүүж, ангиллыг (category/level)
MapConstant-руу (code = OSM утга) холбоно. Эх нь хоосон сэдвийг алгасна. Idempotent:
target хүснэгтийг эхэлж TRUNCATE. Санах ойд ээлтэй — id-ээр keyset pagination.

    python manage.py enrich_from_osm
"""

from django.core.management.base import BaseCommand
from django.db import connections
from django.contrib.gis.geos import GEOSGeometry

from apps.map import map_models as M

DB = "basemap"
BATCH = 5000


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def landcover_code(r):
    """natural/landuse/leisure/amenity → LANDCOVER_CLASS код (эрэмбэлж)."""
    nat, lu, le, am = r[3], r[4], r[5], r[6]
    if nat == "wood":
        return "forest"
    return nat or lu or le or am


class Command(BaseCommand):
    help = "OSM түүхий давхаргаас каталогийн map_* хүснэгтүүдийг баяжуулна."

    def add_arguments(self, parser):
        parser.add_argument("--only", nargs="*", default=None,
                            help="Зөвхөн эдгээр хүснэгтийг (db_table, ж: map_landcover_area)")

    def handle(self, *args, **opts):
        self.conn = connections[DB]
        self.cats = {(c.key, c.code): c for c in M.MapConstant.objects.all()}
        self.status = self._c(M.CK_LIFECYCLE, "existing")
        self.source = self._c(M.CK_SOURCE, "osm")
        if not self.status or not self.source:
            self.stderr.write("MapConstant seed алга — эхлээд `seed_map_codelist`.")
            return

        # building таг → BUILDING_CLASS
        self.bld = {}
        for grp, keys in {
            "residential": ("residential", "house", "apartments", "detached", "dormitory", "hut"),
            "ger": ("ger", "yurt"),
            "industrial": ("industrial", "warehouse", "factory"),
            "commercial": ("commercial", "retail", "office", "supermarket", "kiosk"),
            "public": ("public", "civic", "school", "hospital", "government", "university",
                       "college", "kindergarten", "hotel", "train_station"),
            "religious": ("church", "temple", "monastery", "mosque", "cathedral", "shrine"),
            "ruins": ("ruins",),
            "agricultural": ("barn", "greenhouse", "stable", "cowshed", "sty", "farm_auxiliary"),
            "auxiliary": ("garage", "garages", "carport", "shed", "roof"),
            "generic": ("yes", "construction"),  # тодорхойгүй/баригдаж буй барилга
        }.items():
            for k in keys:
                self.bld[k] = grp

        lvl = {"2": "country", "3": "country", "4": "aimag", "5": "aimag",
               "6": "soum", "7": "soum", "8": "bag", "9": "bag", "10": "bag"}

        # (Model, эх table, WHERE, [name-ийн дараах нэмэлт багана], row→ангиллын kwargs)
        themes = [
            (M.Road, "osm_line", "highway IS NOT NULL", ["highway"],
             lambda r: {"category": self._c(M.CK_ROAD_CLASS, r[3])}),
            (M.Watercourse, "osm_line", "waterway IS NOT NULL", ["waterway"],
             lambda r: {"category": self._c(M.CK_WATERCOURSE_TYPE, r[3])}),
            (M.Railway, "osm_line", "railway IS NOT NULL", ["railway"],
             lambda r: {"category": self._c(M.CK_RAILWAY_CLASS, r[3])}),
            (M.LandcoverArea, "osm_multipolygon",
             "\"natural\" IN ('wood','scrub','grassland','wetland','sand','scree','bare_rock','glacier','heath') "
             "OR landuse IS NOT NULL "
             "OR leisure IN ('park','pitch','playground','garden','stadium','sports_centre','nature_reserve','recreation_ground') "
             "OR amenity IN ('parking','school','kindergarten','university','college','hospital','place_of_worship')",
             ['"natural"', "landuse", "leisure", "amenity"],
             lambda r: {"category": self._c(M.CK_LANDCOVER_CLASS, landcover_code(r))}),
            (M.WaterBody, "osm_multipolygon", "\"natural\"='water'", [],
             lambda r: {"category": self._c(M.CK_WATERBODY_TYPE, "lake")}),
            (M.Building, "osm_multipolygon", "building IS NOT NULL", ["building"],
             lambda r: {"category": self._c(M.CK_BUILDING_CLASS, self.bld.get(r[3]))}),
            (M.Toponym, "osm_point", "name IS NOT NULL AND name <> '' AND place IS NOT NULL", ["place"],
             lambda r: {"category": self._c(M.CK_TOPONYM_CLASS, "populated")}),
            (M.AdminBoundary, "osm_line",
             "other_tags LIKE '%%\"boundary\"=>\"administrative\"%%'",
             ["substring(other_tags from '\"admin_level\"=>\"([0-9]+)\"')"],
             lambda r: {"level": self._c(M.CK_ADMIN_LEVEL, lvl.get(r[3]))}),
        ]
        only = opts.get("only")
        if only:
            themes = [t for t in themes if t[0]._meta.db_table in only]
        for t in themes:
            self._load(*t)
        self.stdout.write(self.style.SUCCESS("Баяжуулалт дууслаа."))

    def _c(self, key, code):
        return self.cats.get((key, code)) if code else None

    def _load(self, model, table, where, extra, fieldfn):
        vn = model._meta.verbose_name
        with self.conn.cursor() as cur:
            cur.execute(f'SELECT EXISTS(SELECT 1 FROM {table} WHERE {where} LIMIT 1)')
            if not cur.fetchone()[0]:
                self.stdout.write(f"  · {vn}: эх хоосон — алгаслаа")
                return
            cur.execute(f'TRUNCATE TABLE "{model._meta.db_table}" RESTART IDENTITY')
        sel = ", ".join(["id", "osm_id", "name"] + extra + ["encode(ST_AsEWKB(geom),'hex')"])
        last, total = 0, 0
        while True:
            with self.conn.cursor() as cur:
                cur.execute(
                    f'SELECT {sel} FROM {table} WHERE ({where}) AND id > %s ORDER BY id LIMIT %s',
                    [last, BATCH])
                rows = cur.fetchall()
            if not rows:
                break
            objs = []
            for r in rows:
                last = r[0]
                g = r[-1]
                objs.append(model(
                    name=(r[2] or "")[:254],
                    source_osm_id=_int(r[1]),
                    status=self.status, source=self.source,
                    geom=GEOSGeometry(g) if g else None,
                    **fieldfn(r),
                ))
            model.objects.bulk_create(objs, batch_size=BATCH)
            total += len(rows)
        self.stdout.write(self.style.SUCCESS(f"  ✓ {vn}: {total} мөр"))
