# -*- coding: utf-8 -*-
"""Байр зүйн каталогийн codelist (MapConstant)-ыг seed хийнэ.

Домэйн (key) бүрийн код утгуудыг Монгол/англи нэр, (зарим сэдэвт) OSM-carto өнгөтэйгээр
оруулна. `code` утгыг OSM таг утгатай (highway=trunk, natural=water...) тааруулсан тул
дараагийн баяжуулах (osm_* → map_*) алхамд шууд буулгагдана.

Idempotent: (key, code)-оор update_or_create — дахин ажиллуулж, шинэ утга нэмж болно.
    python manage.py seed_map_codelist
"""

from django.core.management.base import BaseCommand

from apps.map import map_models as M


# Домэйн → [(code, name_mn, name_en, color?)]. color байхгүй бол хоосон.
DATA = {
    M.CK_LIFECYCLE: [
        ("existing", "Оршин байгаа", "existing"),
        ("projected", "Төлөвлөгдсөн", "projected"),
        ("construction", "Баригдаж буй", "under construction"),
        ("disused", "Ашиглалтгүй", "disused"),
        ("decommissioned", "Устгагдсан", "decommissioned"),
    ],
    M.CK_SOURCE: [
        ("osm", "OSM", "OpenStreetMap"),
        ("survey", "Хээрийн хэмжилт", "survey"),
        ("digitized", "Дижитайз", "digitized"),
        ("import", "Импорт", "import"),
        ("manual", "Гар оруулга", "manual"),
    ],
    M.CK_GEODETIC_CLASS: [
        ("triangulation", "Триангуляц", "triangulation"),
        ("gnss", "GNSS байнгын", "GNSS"),
        ("leveling", "Тэгшитгэлийн (нивелир)", "leveling"),
        ("polygonometry", "Полигонометр", "polygonometry"),
    ],
    M.CK_CONTOUR_TYPE: [
        ("index", "Үндсэн (утгатай)", "index"),
        ("normal", "Энгийн", "normal"),
        ("intermediate", "Завсрын", "intermediate"),
        ("depression", "Хотгор", "depression"),
    ],
    M.CK_RELIEF_TYPE: [
        ("cliff", "Хад цохио", "cliff"),
        ("gully", "Жалга", "gully"),
        ("ridge", "Нуруу", "ridge"),
        ("saddle", "Хөндий/даваа", "saddle"),
        ("cave", "Агуй", "cave"),
        ("scree_edge", "Асга", "scree edge"),
    ],
    M.CK_WATERCOURSE_TYPE: [
        ("river", "Гол", "river", "#a5bfdd"),
        ("stream", "Горхи", "stream", "#a5bfdd"),
        ("canal", "Суваг", "canal", "#a5bfdd"),
        ("ditch", "Шуудуу", "ditch", "#b3c9e0"),
        ("drain", "Ус зайлуулах", "drain", "#b3c9e0"),
        ("brook", "Жижиг горхи", "brook", "#a5bfdd"),
        ("drystream", "Хуурай сайр", "dry stream", "#c9b98f"),
        ("dam", "Далан", "dam", "#8a8a8a"),
        ("weir", "Боомт", "weir", "#8a8a8a"),
    ],
    M.CK_WATERBODY_TYPE: [
        ("lake", "Нуур", "lake", "#aad3df"),
        ("reservoir", "Усан сан", "reservoir", "#aad3df"),
        ("pond", "Цөөрөм", "pond", "#aad3df"),
        ("pool", "Тойром", "pool", "#aad3df"),
    ],
    M.CK_PERSISTENCE: [
        ("permanent", "Байнгын", "permanent"),
        ("intermittent", "Түр (улирлын)", "intermittent"),
        ("dry", "Хатсан", "dry"),
    ],
    M.CK_HYDRO_POINT_TYPE: [
        ("spring", "Булаг рашаан", "spring"),
        ("well", "Худаг", "well"),
        ("waterfall", "Хүрхрээ", "waterfall"),
        ("rapids", "Татам", "rapids"),
    ],
    M.CK_LANDCOVER_CLASS: [
        ("forest", "Ой мод", "forest", "#add19e"),
        ("scrub", "Бут сөөг", "scrub", "#c8d7ab"),
        ("grassland", "Бэлчээр (тал хээр)", "grassland", "#cdebb0"),
        ("wetland", "Намаг", "wetland", "#d2e5d2"),
        ("sand", "Элс", "sand", "#f5e9c6"),
        ("scree", "Хайрга/асга", "scree", "#e0e0d8"),
        ("bare_rock", "Нүцгэн чулуу", "bare rock", "#d9d9d0"),
        ("glacier", "Мөстөл", "glacier", "#ddecec"),
        ("heath", "Хужир мараа", "heath", "#d6d99f"),
        # landuse (OSM-carto өнгө) — суурин/аж ахуйн дэвсгэр
        ("residential", "Суурьшлын бүс", "residential", "#e0dfdf"),
        ("retail", "Худалдаа", "retail", "#ffd6d1"),
        ("commercial", "Бизнес", "commercial", "#f2dad9"),
        ("industrial", "Үйлдвэрийн бүс", "industrial", "#ebdbe8"),
        ("farmland", "Тариалан", "farmland", "#eef0d5"),
        ("farmyard", "Ферм", "farmyard", "#f5dcba"),
        ("grass", "Зүлэг", "grass", "#cdebb0"),
        ("meadow", "Нуга", "meadow", "#cdebb0"),
        ("orchard", "Жимсний цэцэрлэг", "orchard", "#aedfa3"),
        ("cemetery", "Оршуулгын газар", "cemetery", "#aacbaf"),
        ("military", "Цэргийн бүс", "military", "#f3e4de"),
        ("quarry", "Карьер", "quarry", "#c5c3c3"),
        ("landfill", "Хог хаягдал", "landfill", "#b6b592"),
        ("construction", "Барилгын талбай", "construction", "#c7c7b4"),
        ("garages", "Гаражийн бүс", "garages", "#dfddce"),
        ("recreation_ground", "Амралтын талбай", "recreation ground", "#dffce2"),
        ("village_green", "Нийтийн зүлэг", "village green", "#cdebb0"),
        # leisure — ногоон/спорт талбай
        ("park", "Цэцэрлэгт хүрээлэн", "park", "#c8facc"),
        ("pitch", "Спорт талбай", "pitch", "#aae0cb"),
        ("playground", "Тоглоомын талбай", "playground", "#dffce2"),
        ("garden", "Цэцэрлэг", "garden", "#cdebb0"),
        ("stadium", "Цэнгэлдэх", "stadium", "#dffce2"),
        ("sports_centre", "Спорт төв", "sports centre", "#dffce2"),
        ("nature_reserve", "Дархан газар", "nature reserve", "#d6f0c2"),
        # amenity — байгууллагын дэвсгэр
        ("parking", "Зогсоол", "parking", "#eeeeee"),
        ("school", "Сургууль", "school", "#ffffe5"),
        ("kindergarten", "Цэцэрлэг (сургууль)", "kindergarten", "#ffffe5"),
        ("university", "Их сургууль", "university", "#ffffe5"),
        ("college", "Коллеж", "college", "#ffffe5"),
        ("hospital", "Эмнэлэг", "hospital", "#ffffe5"),
        ("place_of_worship", "Шүтээн", "place of worship", "#d0cfce"),
    ],
    M.CK_VEGETATION_TYPE: [
        ("tree_row", "Модны эгнээ", "tree row"),
        ("single_tree", "Ганц мод", "single tree"),
        ("hedge", "Хашлага", "hedge"),
    ],
    M.CK_ROAD_CLASS: [
        ("motorway", "Автомагистраль", "motorway", "#e892a2"),
        ("trunk", "Улсын чанартай", "trunk", "#f9b29c"),
        ("primary", "Аймгийн чанартай", "primary", "#fcd6a4"),
        ("secondary", "Сумын чанартай", "secondary", "#f7fabf"),
        ("tertiary", "Орон нутгийн", "tertiary", "#ffffff"),
        ("unclassified", "Ангилагдаагүй", "unclassified", "#d9d9d9"),
        ("residential", "Хорооллын", "residential", "#d9d9d9"),
        ("track", "Шороон зам", "track", "#c0a878"),
        ("path", "Жим", "path", "#b0906a"),
        ("motorway_link", "Автомагистралийн холбоос", "motorway link", "#e892a2"),
        ("trunk_link", "Улсын замын холбоос", "trunk link", "#f9b29c"),
        ("primary_link", "Аймгийн замын холбоос", "primary link", "#fcd6a4"),
        ("secondary_link", "Сумын замын холбоос", "secondary link", "#f7fabf"),
        ("tertiary_link", "Орон нутгийн холбоос", "tertiary link", "#ffffff"),
        ("living_street", "Хашааны гудамж", "living street", "#ededed"),
        ("pedestrian", "Явган хүний гудамж", "pedestrian", "#dddde8"),
        ("service", "Үйлчилгээний зам", "service", "#ffffff"),
        ("footway", "Явган зам", "footway", "#f7a3a3"),
        ("cycleway", "Дугуйн зам", "cycleway", "#9999ff"),
        ("steps", "Шат", "steps", "#f7a3a3"),
        ("road", "Тодорхойгүй зам", "road", "#d9d9d9"),
        ("construction", "Баригдаж буй зам", "construction", "#cccccc"),
    ],
    M.CK_SURFACE_TYPE: [
        ("asphalt", "Асфальт", "asphalt"),
        ("concrete", "Бетон", "concrete"),
        ("gravel", "Хайрга", "gravel"),
        ("ground", "Шороо", "ground"),
        ("sand", "Элс", "sand"),
    ],
    M.CK_RAILWAY_CLASS: [
        ("rail", "Өргөн замтай төмөр зам", "rail"),
        ("narrow_gauge", "Нарийн замтай", "narrow gauge"),
        ("tram", "Трамвай", "tram"),
        ("industrial", "Үйлдвэрийн", "industrial"),
        ("disused", "Ашиглалтгүй", "disused"),
        ("platform", "Перрон", "platform", "#bbbbbb"),
        ("abandoned", "Хаягдсан", "abandoned", "#cccccc"),
        ("construction", "Баригдаж буй", "construction", "#cccccc"),
        ("monorail", "Монорельс", "monorail"),
    ],
    M.CK_TRANSPORT_STRUCT: [
        ("bridge", "Гүүр", "bridge"),
        ("tunnel", "Хонгил", "tunnel"),
        ("ford", "Гатлага", "ford"),
        ("level_crossing", "Төмөр замын гарц", "level crossing"),
        ("station", "Өртөө/буудал", "station"),
    ],
    M.CK_BUILDING_CLASS: [
        ("residential", "Орон сууц", "residential", "#d9d0c9"),
        ("ger", "Гэр", "ger", "#e8ddd0"),
        ("public", "Нийтийн", "public", "#d0c8e0"),
        ("industrial", "Үйлдвэрийн", "industrial", "#d1c2b8"),
        ("commercial", "Худалдаа үйлчилгээ", "commercial", "#e0c9c0"),
        ("religious", "Шашны", "religious", "#d0c0b0"),
        ("ruins", "Балгас", "ruins", "#cfc8c0"),
        ("generic", "Барилга (тодорхойгүй)", "building", "#d9d0c9"),
        ("agricultural", "ХАА-н барилга", "agricultural", "#e0d5c0"),
        ("auxiliary", "Туслах байгууламж", "auxiliary", "#e5ddd5"),
    ],
    M.CK_SETTLEMENT_CLASS: [
        ("city", "Хот", "city"),
        ("town", "Тосгон/сум төв", "town"),
        ("village", "Суурин", "village"),
        ("ger_area", "Гэр хороолол", "ger area"),
        ("isolated", "Айл өрх", "isolated dwelling"),
    ],
    M.CK_ADMIN_LEVEL: [
        ("country", "Улс", "country"),
        ("aimag", "Аймаг / Нийслэл", "aimag"),
        ("soum", "Сум / Дүүрэг", "soum"),
        ("bag", "Баг / Хороо", "bag"),
    ],
    M.CK_BOUNDARY_STATUS: [
        ("defined", "Тогтоосон", "defined"),
        ("disputed", "Маргаантай", "disputed"),
        ("de_facto", "Бодит (де-факто)", "de facto"),
    ],
    M.CK_UTILITY_TYPE: [
        ("power", "Цахилгаан дамжуулах", "power line"),
        ("minor_power", "Түгээх шугам", "minor power"),
        ("pipeline", "Шугам хоолой", "pipeline"),
        ("heating", "Дулааны шугам", "heating"),
        ("telecom", "Холбооны шугам", "telecom"),
    ],
    M.CK_UTILITY_POINT_TYPE: [
        ("tower", "Тулгуур/цамхаг", "tower"),
        ("pole", "Шон", "pole"),
        ("substation", "Дэд станц", "substation"),
        ("transformer", "Трансформатор", "transformer"),
        ("mast", "Мачт", "mast"),
        ("well", "Уурхайн/усны цооног", "well"),
    ],
    M.CK_TOPONYM_CLASS: [
        ("orography", "Уул нуруу", "orography"),
        ("hydrography", "Ус зүй", "hydrography"),
        ("populated", "Суурин газар", "populated place"),
        ("landcover", "Газрын бүрхэвч", "landcover"),
        ("admin", "Засаг захиргаа", "administrative"),
        ("other", "Бусад", "other"),
    ],
    M.CK_NAME_SCRIPT: [
        ("cyrl", "Кирилл", "Cyrillic"),
        ("mong", "Монгол бичиг", "Mongolian"),
        ("latn", "Латин", "Latin"),
    ],
    M.CK_LANGUAGE: [
        ("mn", "Монгол", "Mongolian"),
        ("en", "Англи", "English"),
        ("zh", "Хятад", "Chinese"),
        ("ru", "Орос", "Russian"),
    ],
    M.CK_NAME_STATUS: [
        ("official", "Албан ёсны", "official"),
        ("alternative", "Хувилбар", "alternative"),
        ("historical", "Түүхэн", "historical"),
        ("standardised", "Стандартчилсан", "standardised"),
    ],
}


class Command(BaseCommand):
    help = "Байр зүйн каталогийн codelist (MapConstant)-ыг seed/шинэчилнэ (idempotent)."

    def handle(self, *args, **opts):
        created = updated = 0
        for key, items in DATA.items():
            for i, row in enumerate(items):
                code, name, name_en = row[0], row[1], row[2]
                color = row[3] if len(row) > 3 else ""
                obj, is_new = M.MapConstant.objects.update_or_create(
                    key=key, code=code,
                    defaults=dict(name=name, name_en=name_en, color=color,
                                  sort_order=i, active=True),
                )
                created += int(is_new)
                updated += int(not is_new)
        total = M.MapConstant.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f"MapConstant seed: {created} шинэ, {updated} шинэчлэгдсэн, "
            f"нийт {total} мөр ({len(DATA)} домэйн)."))
