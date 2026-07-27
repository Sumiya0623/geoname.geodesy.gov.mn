# -*- coding: utf-8 -*-
"""Байр зүйн каталогийн DB router.

`apps.map` (label "map") app-ийн БҮХ model (MapConstant, FeatureName, бүх feature type)
нь `basemap` DB-д амьдарна — OSM түүхий дата + GeoServer тэнд байгаа тул транформ ба
дүрслэл нэг DB дотор. Бусад БҮХ app default DB-д хэвээр.

Ялгах шалгуур: `app_label == "map"`. (Migration-ийн historical model-ийн __module__
найдваргүй тул модулиар биш, app_label-аар шалгана. apps.map-д зөвхөн каталогийн
model байгаа тул бүхэл app-ыг чиглүүлж болно.)
"""

CATALOG_APP = "map"
BASEMAP_DB = "basemap"


class MapRouter:
    def db_for_read(self, model, **hints):
        return BASEMAP_DB if model._meta.app_label == CATALOG_APP else None

    def db_for_write(self, model, **hints):
        return BASEMAP_DB if model._meta.app_label == CATALOG_APP else None

    def allow_relation(self, obj1, obj2, **hints):
        c1 = obj1._meta.app_label == CATALOG_APP
        c2 = obj2._meta.app_label == CATALOG_APP
        if c1 == c2:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == CATALOG_APP:
            return db == BASEMAP_DB     # каталог → зөвхөн basemap
        return db == "default"          # бусад → зөвхөн default
