# -*- coding: utf-8 -*-
"""Скан топо зургаас нэр таних (nameqc) — таамаглал/шошгыг засах API.

Хүснэгтүүдийг Django migration БИШ, nameqc (`python -m nameqc initdb`) үүсгэдэг:
  nameqc_detection — бичвэрийн хүрээ (Polygon) / тэмдэг (Point), ангилал, бичвэр, төлөв
  nameqc_task      — шошголох дараалал (тодруулалт бүр нэг даалгавар)
Хүснэгт байхгүй сан дээр (жишээ нь өөр орчинд) эдгээр endpoint 503 буцаана.

  GET   /api/n/ml-detection/?bbox=minx,miny,maxx,maxy   → GeoJSON (EPSG:4326)
  POST  /api/n/ml-detection/                            → хүн шинээр зурсан (confirmed)
  PATCH /api/n/ml-detection/<id>/                       → геометр/ангилал/бичвэр/төлөв
  DELETE /api/n/ml-detection/<id>/                      → status=rejected (сургалтад «худал илрэл»)
  GET   /api/n/ml-task/?batch=1&bbox=...                → даалгаврын цэгүүд (GeoJSON)
  GET   /api/n/ml-task/next/?batch=1&after=<id>         → дараагийн шошгологдоогүй даалгавар
  GET   /api/n/ml-task/stats/?batch=1                   → todo/done/skip тоо
  PATCH /api/n/ml-task/<recount_id>/                    → {"status": "done"|"skip"|"todo"}
"""
import json

from django.db import connection, transaction
from django.db.utils import ProgrammingError
from rest_framework import status as http
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

TEXT_CLS = {'name', 'number', 'other', 'struck', 'unknown'}
SYMBOL_CLS = {'peak', 'trig', 'well', 'other'}
STATUSES = {'pending', 'confirmed', 'rejected'}
TASK_STATUSES = {'todo', 'done', 'skip'}
MAX_FEATURES = 4000


def _bbox(request):
    raw = request.query_params.get('bbox')
    if not raw:
        return None
    try:
        v = [float(x) for x in raw.split(',')]
    except ValueError:
        return None
    return v if len(v) == 4 else None


def _rows(sql, params):
    with connection.cursor() as c:
        c.execute(sql, params)
        cols = [d[0] for d in c.description]
        return [dict(zip(cols, r)) for r in c.fetchall()]


def _fc(rows):
    feats = []
    for r in rows:
        geom = json.loads(r.pop('geojson'))
        feats.append({'type': 'Feature', 'id': r['id'], 'geometry': geom, 'properties': r})
    return {'type': 'FeatureCollection', 'features': feats}


class _MissingTable(viewsets.ViewSet):
    """nameqc хүснэгт үүсээгүй бол 500 биш 503 + тайлбар."""

    def handle_exception(self, exc):
        if isinstance(exc, ProgrammingError) and 'nameqc_' in str(exc):
            return Response({'detail': 'nameqc хүснэгт үүсээгүй байна (python -m nameqc initdb).'},
                            status=http.HTTP_503_SERVICE_UNAVAILABLE)
        return super().handle_exception(exc)


class MlDetectionViewSet(_MissingTable):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        bbox = _bbox(request)
        if not bbox:
            return Response({'detail': 'bbox шаардлагатай'}, status=http.HTTP_400_BAD_REQUEST)
        show_rejected = request.query_params.get('rejected') == '1'
        # Шалгаагүй бэлэн илрүүлэгчийн (pre:*) хүрээ сургасан загварынхтай давхардаж шошголгоог
        # удаашруулдаг тул нууна (?pre=1 өгвөл харуулна). Санд хэвээр.
        show_pre = request.query_params.get('pre') == '1'
        rows = _rows(
            f"""SELECT id, kind, cls, text, score, source, status, recount_id,
                       ST_AsGeoJSON(geom, 7) AS geojson
                  FROM nameqc_detection
                 WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
                   {'' if show_rejected else "AND status <> 'rejected'"}
                   {'' if show_pre else "AND NOT (status = 'pending' AND source LIKE 'pre:%%')"}
                 LIMIT {MAX_FEATURES}""",
            bbox)
        return Response(_fc(rows))

    @action(detail=False, methods=['post'], url_path='confirm-area')
    def confirm_area(self, request):
        """Хүн шалгасан талбайн (bbox) үлдсэн загварын хүрээг баталгаажуулна (pre:* хамаарахгүй)."""
        try:
            v = [float(x) for x in str(request.data.get('bbox', '')).split(',')]
            assert len(v) == 4
        except (ValueError, AssertionError):
            return Response({'detail': 'bbox шаардлагатай'}, status=http.HTTP_400_BAD_REQUEST)
        with connection.cursor() as c:
            c.execute(
                """UPDATE nameqc_detection SET status = 'confirmed', user_id = %s, updated = now()
                    WHERE status = 'pending' AND source NOT LIKE 'pre:%%'
                      AND ST_Within(geom, ST_MakeEnvelope(%s, %s, %s, %s, 4326))""",
                [request.user.id, *v])
            n = c.rowcount
        return Response({'confirmed': n})

    def _clean(self, data, partial):
        out = {}
        kind = data.get('kind')
        if kind is not None:
            if kind not in ('text', 'symbol'):
                raise ValueError('kind')
            out['kind'] = kind
        if 'cls' in data:
            if data['cls'] not in TEXT_CLS | SYMBOL_CLS:
                raise ValueError('cls')
            out['cls'] = data['cls']
        if 'status' in data:
            if data['status'] not in STATUSES:
                raise ValueError('status')
            out['status'] = data['status']
        if 'text' in data:
            t = data['text']
            out['text'] = (str(t).strip()[:500] or None) if t is not None else None
        if 'recount_id' in data:
            rid = data['recount_id']
            out['recount_id'] = int(rid) if rid not in (None, '') else None
        if 'geometry' in data:
            out['geometry'] = json.dumps(data['geometry'])
        if not partial and 'geometry' not in out:
            raise ValueError('geometry')
        return out

    def create(self, request):
        try:
            d = self._clean(request.data, partial=False)
        except (ValueError, TypeError) as e:
            return Response({'detail': f'буруу утга: {e}'}, status=http.HTTP_400_BAD_REQUEST)
        with connection.cursor() as c:
            c.execute(
                """INSERT INTO nameqc_detection
                       (geom, kind, cls, text, source, status, recount_id, user_id, updated)
                   VALUES (ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326), %s, %s, %s, 'human',
                           %s, %s, %s, now())
                   RETURNING id""",
                [d['geometry'], d.get('kind', 'text'), d.get('cls', 'unknown'), d.get('text'),
                 d.get('status', 'confirmed'), d.get('recount_id'), request.user.id])
            new_id = c.fetchone()[0]
        return Response(self._one(new_id), status=http.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            d = self._clean(request.data, partial=True)
        except (ValueError, TypeError) as e:
            return Response({'detail': f'буруу утга: {e}'}, status=http.HTTP_400_BAD_REQUEST)
        # Хүн засвал (төлөв заагаагүй ч) баталгаажсанд тооцно
        d.setdefault('status', 'confirmed')
        sets, params = [], []
        for k, v in d.items():
            if k == 'geometry':
                sets.append('geom = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)')
            else:
                sets.append(f'{k} = %s')
            params.append(v)
        sets += ['user_id = %s', 'updated = now()']
        params += [request.user.id, int(pk)]
        with connection.cursor() as c:
            c.execute(f"UPDATE nameqc_detection SET {', '.join(sets)} WHERE id = %s", params)
            if c.rowcount == 0:
                return Response(status=http.HTTP_404_NOT_FOUND)
        return Response(self._one(int(pk)))

    def destroy(self, request, pk=None):
        with connection.cursor() as c:
            c.execute(
                "UPDATE nameqc_detection SET status = 'rejected', user_id = %s, updated = now() WHERE id = %s",
                [request.user.id, int(pk)])
            if c.rowcount == 0:
                return Response(status=http.HTTP_404_NOT_FOUND)
        return Response(status=http.HTTP_204_NO_CONTENT)

    def _one(self, pk):
        rows = _rows(
            """SELECT id, kind, cls, text, score, source, status, recount_id,
                      ST_AsGeoJSON(geom, 7) AS geojson
                 FROM nameqc_detection WHERE id = %s""", [pk])
        return _fc(rows)['features'][0] if rows else None


_TASK_SELECT = """
    SELECT t.recount_id AS id, t.batch, t.ord, t.status, t.pre,
           COALESCE(g.name, r.draft) AS name, ty.name AS type,
           ST_AsGeoJSON(ST_PointOnSurface(r.loc), 7) AS geojson,
           CASE WHEN GeometryType(r.loc) NOT IN ('POINT', 'MULTIPOINT')
                THEN ST_AsGeoJSON(r.loc, 7)::json END AS shape,
           (SELECT count(*) FROM nameqc_detection d
             WHERE d.recount_id = t.recount_id AND d.status <> 'rejected') AS linked
      FROM nameqc_task t
      JOIN core_recount r ON r.id = t.recount_id
      LEFT JOIN core_geoname g ON g.id = r.name_id
      LEFT JOIN core_constant ty ON ty.id = COALESCE(r.type_id, g.type_id)
"""


class MlTaskViewSet(_MissingTable):
    permission_classes = [IsAuthenticated]

    def _batch(self, request):
        try:
            return int(request.query_params.get('batch', 1))
        except ValueError:
            return 1

    def list(self, request):
        bbox = _bbox(request)
        params = [self._batch(request)]
        where = 'WHERE t.batch = %s'
        if bbox:
            where += ' AND r.loc && ST_MakeEnvelope(%s, %s, %s, %s, 4326)'
            params += bbox
        rows = _rows(f'{_TASK_SELECT} {where} ORDER BY t.ord LIMIT {MAX_FEATURES}', params)
        return Response(_fc(rows))

    @action(detail=False, methods=['get'])
    def next(self, request):
        """Дараагийн todo даалгавар (ord дарааллаар). after=<recount_id> өгвөл түүний дараахыг."""
        batch = self._batch(request)
        after = request.query_params.get('after')
        params = [batch]
        cond = ''
        if after:
            cond = 'AND t.ord > COALESCE((SELECT ord FROM nameqc_task WHERE recount_id = %s), 0)'
            params.append(int(after))
        rows = _rows(f"{_TASK_SELECT} WHERE t.batch = %s AND t.status = 'todo' {cond} ORDER BY t.ord LIMIT 1",
                     params)
        if not rows and after:   # төгсгөлд хүрвэл эхнээс нь
            rows = _rows(f"{_TASK_SELECT} WHERE t.batch = %s AND t.status = 'todo' ORDER BY t.ord LIMIT 1",
                         [batch])
        if not rows:
            return Response(None)
        return Response(_fc(rows)['features'][0])

    @action(detail=False, methods=['get'])
    def stats(self, request):
        rows = _rows(
            """SELECT status, count(*) AS n, count(*) FILTER (WHERE pre) AS pre
                 FROM nameqc_task WHERE batch = %s GROUP BY status""",
            [self._batch(request)])
        out = {s: 0 for s in TASK_STATUSES}
        out['pre'] = 0
        for r in rows:
            out[r['status']] = r['n']
            out['pre'] += r['pre']
        out['total'] = sum(out[s] for s in TASK_STATUSES)
        det = _rows(
            """SELECT status, count(*) AS n FROM nameqc_detection
                WHERE kind = 'text' GROUP BY status""", [])
        out['detections'] = {r['status']: r['n'] for r in det}
        return Response(out)

    def partial_update(self, request, pk=None):
        st = request.data.get('status')
        if st not in TASK_STATUSES:
            return Response({'detail': 'status'}, status=http.HTTP_400_BAD_REQUEST)
        with transaction.atomic(), connection.cursor() as c:
            c.execute(
                "UPDATE nameqc_task SET status = %s, user_id = %s, updated = now() WHERE recount_id = %s",
                [st, request.user.id, int(pk)])
            if c.rowcount == 0:
                return Response(status=http.HTTP_404_NOT_FOUND)
        return Response({'id': int(pk), 'status': st})


_REVIEW_TODO = """
    FROM nameqc_detection d
   WHERE d.auto IS NOT NULL AND d.review IS NULL AND d.cls = 'name' AND d.recount_id IS NOT NULL
     AND d.status = 'confirmed'
"""


class MlReviewViewSet(_MissingTable):
    """Автомат шошголгоог хүн «зөв / буруу» гэж шалгах. Нэг шалгалт = нэг тодруулалтын бүх автомат хүрээ.

      GET  /api/n/ml-review/next/              → {recount_id, name, type, boxes: GeoJSON} эсвэл null
      PUT  /api/n/ml-review/<recount_id>/      → {"ok": true|false}
      GET  /api/n/ml-review/stats/             → {ok, self, bad, todo}
    review='self' = машин өөрөө баталсан (чөлөөт OCR ↔ нэр ≥85, хүний шалгалтаар ~96% зөв) — дараалалд орохгүй.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def next(self, request):
        skip = request.query_params.get('skip')
        params = []
        cond = ''
        if skip:
            cond = 'AND d.recount_id <> %s'
            params.append(int(skip))
        rows = _rows(f'SELECT d.recount_id {_REVIEW_TODO} {cond} GROUP BY d.recount_id ORDER BY random() LIMIT 1',
                     params)
        if not rows:
            return Response(None)
        rid = rows[0]['recount_id']
        head = _rows(
            """SELECT COALESCE(g.name, r.draft) AS name, ty.name AS type
                 FROM core_recount r
                 LEFT JOIN core_geoname g ON g.id = r.name_id
                 LEFT JOIN core_constant ty ON ty.id = COALESCE(r.type_id, g.type_id)
                WHERE r.id = %s""", [rid])
        boxes = _rows(
            f"""SELECT d.id, d.cls, d.text, d.ocr, d.auto, ST_AsGeoJSON(d.geom, 7) AS geojson
                  {_REVIEW_TODO} AND d.recount_id = %s ORDER BY ST_Y(ST_Centroid(d.geom)) DESC,
                  ST_X(ST_Centroid(d.geom))""", [rid])
        return Response({'recount_id': rid, **(head[0] if head else {}), 'boxes': _fc(boxes)})

    @action(detail=False, methods=['get'])
    def page(self, request):
        """Хүснэгтэн шалгалт: n тодруулалт нэг дор. Хүрээ/цэг EPSG:3857-д (WMS-ээр гажилтгүй тайрц авна).

        → [{recount_id, name, type, text:[..], ocr:[..], bbox:[minx,miny,maxx,maxy], loc:GeoJSON geometry, boxes:[ring...]}]
        """
        try:
            n = max(1, min(int(request.query_params.get('n', 24)), 60))
        except ValueError:
            n = 24
        ids = [r['recount_id'] for r in _rows(
            f'SELECT d.recount_id {_REVIEW_TODO} GROUP BY d.recount_id ORDER BY random() LIMIT %s', [n])]
        if not ids:
            return Response([])
        rows = _rows(
            """SELECT d.recount_id, d.text, d.ocr,
                      ST_AsGeoJSON(ST_Transform(d.geom, 3857), 1) AS geojson,
                      ST_AsGeoJSON(ST_Transform(r.loc, 3857), 1) AS loc,
                      COALESCE(g.name, r.draft) AS name, ty.name AS type
                 FROM nameqc_detection d
                 JOIN core_recount r ON r.id = d.recount_id
                 LEFT JOIN core_geoname g ON g.id = r.name_id
                 LEFT JOIN core_constant ty ON ty.id = COALESCE(r.type_id, g.type_id)
                WHERE d.auto IS NOT NULL AND d.review IS NULL AND d.cls = 'name' AND d.status = 'confirmed'
                  AND d.recount_id = ANY(%s)
                ORDER BY d.recount_id, ST_Y(ST_Centroid(d.geom)) DESC, ST_X(ST_Centroid(d.geom))""", [ids])
        items = {}
        for r in rows:
            it = items.setdefault(r['recount_id'], {
                'recount_id': r['recount_id'], 'name': r['name'], 'type': r['type'],
                # тодруулалт цэг, шугам (ам, гол) эсвэл талбай (нуур) байж болно
                'loc': json.loads(r['loc']) if r['loc'] else None, 'boxes': [], 'text': [], 'ocr': []})
            geom = json.loads(r['geojson'])
            rings = geom['coordinates'] if geom['type'] == 'Polygon' else [p[0] for p in geom['coordinates']]
            it['boxes'].append(rings[0])
            it['text'].append(r['text'] or '')
            it['ocr'].append(r['ocr'] or '')
        out = []
        for it in items.values():
            xs = [p[0] for b in it['boxes'] for p in b]
            ys = [p[1] for b in it['boxes'] for p in b]
            it['bbox'] = [min(xs), min(ys), max(xs), max(ys)]
            out.append(it)
        return Response(out)

    @action(detail=False, methods=['post'])
    def batch(self, request):
        """Хүснэгтэн шалгалтын хариу нэг гүйлгээнд: {"ok": [recount_id...], "bad": [recount_id...]}."""
        try:
            ok = [int(x) for x in request.data.get('ok', [])]
            bad = [int(x) for x in request.data.get('bad', [])]
        except (TypeError, ValueError):
            return Response({'detail': 'ok, bad: [recount_id]'}, status=http.HTTP_400_BAD_REQUEST)
        if set(ok) & set(bad):
            return Response({'detail': 'ok ба bad давхацсан'}, status=http.HTTP_400_BAD_REQUEST)
        n = {'ok': 0, 'bad': 0}
        with transaction.atomic(), connection.cursor() as c:
            if ok:
                c.execute("""UPDATE nameqc_detection SET review = 'ok', user_id = %s, updated = now()
                              WHERE auto IS NOT NULL AND review IS NULL AND recount_id = ANY(%s)""",
                          [request.user.id, ok])
                n['ok'] = c.rowcount
            if bad:
                # буруу бол сургалтаас хасагдана (update()-тэй адил)
                c.execute("""UPDATE nameqc_detection SET review = 'bad', user_id = %s, updated = now(),
                                    status = 'pending'
                              WHERE auto IS NOT NULL AND review IS NULL AND recount_id = ANY(%s)""",
                          [request.user.id, bad])
                n['bad'] = c.rowcount
        return Response({'names': {'ok': len(ok), 'bad': len(bad)}, 'boxes': n})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        rows = _rows(
            """SELECT count(DISTINCT recount_id) FILTER (WHERE review = 'ok') AS ok,
                      count(DISTINCT recount_id) FILTER (WHERE review = 'self') AS self,
                      count(DISTINCT recount_id) FILTER (WHERE review = 'bad') AS bad,
                      count(DISTINCT recount_id) FILTER (WHERE review IS NULL AND status = 'confirmed') AS todo
                 FROM nameqc_detection WHERE auto IS NOT NULL AND cls = 'name' AND recount_id IS NOT NULL""", [])
        return Response(rows[0])

    def create(self, request):
        return Response(status=http.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, pk=None):
        ok = request.data.get('ok')
        if not isinstance(ok, bool):
            return Response({'detail': 'ok: true|false'}, status=http.HTTP_400_BAD_REQUEST)
        with connection.cursor() as c:
            # буруу бол сургалтаас хасагдана: pending болгож, review='bad' тэмдэглэнэ
            c.execute(
                f"""UPDATE nameqc_detection SET review = %s, user_id = %s, updated = now()
                           {'' if ok else ", status = 'pending'"}
                     WHERE auto IS NOT NULL AND review IS NULL AND recount_id = %s""",
                ['ok' if ok else 'bad', request.user.id, int(pk)])
            n = c.rowcount
        return Response({'recount_id': int(pk), 'ok': ok, 'boxes': n})


# Тэмдгийн төв: тодруулгын цэгэн нэр (худаг / толгой-уул / овоо) бүрийн тэмдгийн ЯГ төвийг хүн нэг товшилтоор
# тавина → тэмдэг илрүүлэгчийн (nameqc symdata) цэвэр шошго. nameqc/symdata.py GROUP-тэй ижил байх ёстой.
_SYM_GROUP = {
    'well': ['Худаг', 'Булаг', 'Рашаан', 'Цооног', 'Задгай', 'Хужир', 'Шанд'],
    'peak': ['Толгой', 'Уул', 'Үзүүр', 'Овгор', 'Хад', 'Цохио', 'Оргил', 'Сарьдаг', 'Хайрхан', 'Хөтөл', 'Дов'],
    'ovoo': ['Овоо'],
}
_SYM_CASE = 'CASE ' + ' '.join(
    f"WHEN ty.name = ANY(ARRAY[{','.join(repr(t) for t in v)}]) THEN '{k}'" for k, v in _SYM_GROUP.items()
) + ' END'
_SYM_FROM = f"""
    FROM nameqc_task t
    JOIN core_recount r ON r.id = t.recount_id
    LEFT JOIN core_geoname g ON g.id = r.name_id
    JOIN core_constant ty ON ty.id = COALESCE(r.type_id, g.type_id)
   WHERE ST_Dimension(r.loc) = 0 AND ({_SYM_CASE}) IS NOT NULL
"""


class MlSymCenterViewSet(_MissingTable):
    """Тэмдгийн төвийг тавих (хүснэгтээр).

      GET  /api/n/ml-symcenter/page/?n=24  → [{recount_id, name, type, cls, loc:[x,y] EPSG:3857}]
      POST /api/n/ml-symcenter/batch/      → {"items":[{recount_id, x, y}], "none":[recount_id]}  (EPSG:3857)
      GET  /api/n/ml-symcenter/stats/      → {done, none, todo, by_cls:{well,peak,ovoo}}
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def page(self, request):
        try:
            n = max(1, min(int(request.query_params.get('n', 24)), 60))
        except ValueError:
            n = 24
        rows = _rows(
            f"""SELECT r.id AS recount_id, COALESCE(g.name, r.draft) AS name, ty.name AS type, {_SYM_CASE} AS cls,
                       ST_X(ST_Transform(r.loc, 3857)) AS x, ST_Y(ST_Transform(r.loc, 3857)) AS y
                  {_SYM_FROM}
                   AND NOT EXISTS (SELECT 1 FROM nameqc_symcenter s WHERE s.recount_id = r.id)
                 ORDER BY ({_SYM_CASE}) = 'ovoo' DESC, random() LIMIT %s""", [n])
        return Response([{**{k: v for k, v in it.items() if k not in ('x', 'y')}, 'loc': [it['x'], it['y']]}
                         for it in rows])

    @action(detail=False, methods=['post'])
    def batch(self, request):
        try:
            items = [(int(i['recount_id']), float(i['x']), float(i['y'])) for i in request.data.get('items', [])]
            none = [int(x) for x in request.data.get('none', [])]
        except (TypeError, ValueError, KeyError):
            return Response({'detail': 'items:[{recount_id,x,y}], none:[recount_id]'}, status=http.HTTP_400_BAD_REQUEST)
        ids = [i[0] for i in items] + none
        if not ids:
            return Response({'saved': 0})
        with transaction.atomic(), connection.cursor() as c:
            c.execute(f"SELECT r.id, {_SYM_CASE} {_SYM_FROM} AND r.id = ANY(%s)", [ids])
            cls = dict(c.fetchall())
            n = 0
            for rid, x, y in items:
                if rid in cls:
                    c.execute("""INSERT INTO nameqc_symcenter (recount_id, cls, geom, user_id)
                                 VALUES (%s, %s, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3857), 4326), %s)
                                 ON CONFLICT (recount_id) DO UPDATE SET geom = EXCLUDED.geom, cls = EXCLUDED.cls,
                                        user_id = EXCLUDED.user_id, created = now()""",
                              [rid, cls[rid], x, y, request.user.id])
                    n += 1
            for rid in none:
                if rid in cls:
                    c.execute("""INSERT INTO nameqc_symcenter (recount_id, cls, geom, user_id) VALUES (%s, %s, NULL, %s)
                                 ON CONFLICT (recount_id) DO UPDATE SET geom = NULL, user_id = EXCLUDED.user_id,
                                        created = now()""", [rid, cls[rid], request.user.id])
                    n += 1
        return Response({'saved': n})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        done = _rows("""SELECT cls, count(*) FILTER (WHERE geom IS NOT NULL) AS done,
                               count(*) FILTER (WHERE geom IS NULL) AS none FROM nameqc_symcenter GROUP BY cls""", [])
        total = _rows(f"SELECT count(*) AS n {_SYM_FROM}", [])[0]['n']
        by = {r['cls']: r['done'] for r in done}
        d = sum(r['done'] for r in done)
        nn = sum(r['none'] for r in done)
        return Response({'done': d, 'none': nn, 'todo': total - d - nn, 'by_cls': by})


class MlPlaceViewSet(_MissingTable):
    """Тэмдэг илрүүлэгчийн тавьсан байрлалыг (nameqc_place how='model') хүснэгтээр шалгах.
    Буруу (pos_ok=false) = «энэ тэмдэг биш» сургалтын сөрөг жишээ (nameqc symdata) + итгэлийн босго.

      GET  /api/n/ml-place/page/?n=24  → [{id, name, type, conf, loc:[x,y] EPSG:3857}]
      POST /api/n/ml-place/batch/      → {"ok":[id], "bad":[id]}
      GET  /api/n/ml-place/stats/      → {ok, bad, todo}
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def page(self, request):
        try:
            n = max(1, min(int(request.query_params.get('n', 24)), 60))
        except ValueError:
            n = 24
        rows = _rows("""SELECT id, name, type_name AS type, p_type AS conf,
                               ST_X(ST_Transform(geom, 3857)) AS x, ST_Y(ST_Transform(geom, 3857)) AS y
                          FROM nameqc_place WHERE how = 'model' AND pos_ok IS NULL ORDER BY random() LIMIT %s""", [n])
        return Response([{**{k: v for k, v in it.items() if k not in ('x', 'y')}, 'loc': [it['x'], it['y']]}
                         for it in rows])

    @action(detail=False, methods=['post'])
    def batch(self, request):
        try:
            ok = [int(x) for x in request.data.get('ok', [])]
            bad = [int(x) for x in request.data.get('bad', [])]
        except (TypeError, ValueError):
            return Response({'detail': 'ok, bad: [id]'}, status=http.HTTP_400_BAD_REQUEST)
        with transaction.atomic(), connection.cursor() as c:
            if ok:
                c.execute("UPDATE nameqc_place SET pos_ok = true WHERE id = ANY(%s) AND how = 'model'", [ok])
            if bad:
                c.execute("UPDATE nameqc_place SET pos_ok = false WHERE id = ANY(%s) AND how = 'model'", [bad])
        return Response({'ok': len(ok), 'bad': len(bad)})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        return Response(_rows("""SELECT count(*) FILTER (WHERE pos_ok) AS ok, count(*) FILTER (WHERE NOT pos_ok) AS bad,
                                        count(*) FILTER (WHERE pos_ok IS NULL) AS todo
                                   FROM nameqc_place WHERE how = 'model'""", [])[0])


class MlNameReviewViewSet(_MissingTable):
    """«Нэр шалгах»: загварын олсон нэр (nameqc_place) ба нэр болоогүй бичвэр (nameqc_text)-ийг хүн шалгана —
    тэмдгийн төв (байрлал) дээр товшиж, нэрийг батлах / сонгох / бичих / «нэр биш». Үр дүн → nameqc_namerev
    (сургалтын шошго: тэмдэг илрүүлэгчийн цэвэр төв, бичвэр илрүүлэгч/танигчийн нэр-хүрээ).

      GET  /api/n/ml-namerev/page/?tag=t56&n=20&kind=all|place|text
      GET  /api/n/ml-namerev/names/?tag=t56&q=улаан   → [{id, name, type}]
      POST /api/n/ml-namerev/batch/  {"items":[{kind,id,verdict:ok|fixed|notname,name,geoname_id,pos:[x,y]|null}]}
      GET  /api/n/ml-namerev/stats/?tag=t56
    """
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _unit(tag):
        r = _rows("""SELECT unit_id FROM nameqc_place WHERE tag = %s AND unit_id IS NOT NULL
                     UNION ALL SELECT unit_id FROM nameqc_text WHERE tag = %s AND unit_id IS NOT NULL LIMIT 1""", [tag, tag])
        return r[0]['unit_id'] if r else None

    @staticmethod
    def _similar(unit, text, n=5):
        """Сум + хөрш сумдын бүртгэлтэй нэрсээс бичвэртэй хамгийн төстэй n нэр (pg_trgm)."""
        if not unit or not text:
            return []
        return _rows("""SELECT g.id, g.name, max(k.name) AS type, max(similarity(lower(g.name), lower(%s))) AS s
                          FROM core_geoname g JOIN core_geoname_unit gu ON gu.geoname_id = g.id
                          LEFT JOIN core_constant k ON k.id = g.type_id
                         WHERE gu.adminunit_id IN (SELECT n.id FROM core_adminunit n, core_adminunit u
                                                    WHERE u.id = %s AND n.parent_id IS NOT NULL
                                                      AND (n.id = u.id OR ST_Intersects(n.geom, u.geom)))
                           AND similarity(lower(g.name), lower(%s)) > 0.15
                         GROUP BY g.id, g.name ORDER BY s DESC LIMIT %s""", [text, unit, text, n])

    @action(detail=False, methods=['get'])
    def page(self, request):
        tag = request.query_params.get('tag') or ''
        kind = request.query_params.get('kind') or 'all'
        try:
            n = max(1, min(int(request.query_params.get('n', 20)), 60))
        except ValueError:
            n = 20
        kinds = ['place', 'text'] if kind == 'all' else [kind]
        rows = _rows("""
            WITH it AS (
                SELECT 'place'::text AS kind, p.id, p.unit_id, p.name, p.alt, p.type_name AS type, p.how, p.doubt,
                       p.reg, p.ocr, p.geoname_id, p.box_ids, p.geom
                  FROM nameqc_place p WHERE p.tag = %s
                UNION ALL
                SELECT 'text', t.id, t.unit_id, t.guess, NULL, NULL, 'text', true, NULL, t.ocr, NULL, t.box_ids, t.geom
                  FROM nameqc_text t WHERE t.tag = %s)
            SELECT it.kind, it.id, it.unit_id, it.name, it.alt, it.type, it.how, it.doubt, it.reg, it.ocr, it.geoname_id,
                   ST_X(ST_Transform(it.geom, 3857)) AS x, ST_Y(ST_Transform(it.geom, 3857)) AS y,
                   ST_XMin(b.e) AS bx0, ST_YMin(b.e) AS by0, ST_XMax(b.e) AS bx1, ST_YMax(b.e) AS by1
              FROM it
              LEFT JOIN nameqc_namerev r ON r.kind = it.kind AND r.ref_id = it.id
              LEFT JOIN LATERAL (SELECT ST_Extent(ST_Transform(d.geom, 3857))::geometry AS e
                                   FROM nameqc_detection d WHERE d.id = ANY(it.box_ids)) b ON true
             WHERE r.id IS NULL AND it.kind = ANY(%s)
             ORDER BY (it.kind = 'text'), it.doubt DESC, random() LIMIT %s""", [tag, tag, kinds, n])
        out = []
        for it in rows:
            cands = []
            if it['name']:
                cands.append({'id': it['geoname_id'], 'name': it['name'], 'type': it['type']})
            if it['alt'] and not it['alt'].startswith('…'):
                cands.append({'id': None, 'name': it['alt'], 'type': None})
            for s in self._similar(it['unit_id'], it['ocr'] or it['name'], 6):
                if all(s['name'] != c['name'] for c in cands):
                    cands.append({'id': s['id'], 'name': s['name'], 'type': s['type']})
            box = [it['bx0'], it['by0'], it['bx1'], it['by1']] if it['bx0'] is not None else None
            out.append({'kind': it['kind'], 'id': it['id'], 'name': it['name'], 'type': it['type'], 'how': it['how'],
                        'doubt': it['doubt'], 'ocr': it['ocr'], 'loc': [it['x'], it['y']], 'box': box,
                        'cands': cands[:6]})
        return Response(out)

    @action(detail=False, methods=['get'])
    def next(self, request):
        """Сумын (tag) дараагийн шалгаагүй нэр/бичвэр — одоогийн цэгт (x,y EPSG:3857) хамгийн ойрыг.
        exclude=place:12,text:5 — энэ удаад алгассан. Буцаана {kind, ref, name, ocr, alt, loc, todo}."""
        tag = request.query_params.get('tag') or ''
        try:
            x = float(request.query_params.get('x')); y = float(request.query_params.get('y'))
        except (TypeError, ValueError):
            x = y = None
        ex = [e.split(':') for e in (request.query_params.get('exclude') or '').split(',') if ':' in e]
        exp = [int(i) for k, i in ex if k == 'place' and i.isdigit()]
        ext = [int(i) for k, i in ex if k == 'text' and i.isdigit()]
        order = ("it.geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3857), 4326)", [x, y]) if x is not None \
            else ("it.id", [])
        rows = _rows(f"""
            WITH it AS (
                SELECT 'place'::text AS kind, p.id, p.name, NULL::text AS ocr, p.alt, p.geom FROM nameqc_place p
                 WHERE p.tag = %s AND coalesce(p.review, '') NOT IN ('human', 'notname') AND NOT (p.id = ANY(%s))
                   AND NOT EXISTS (SELECT 1 FROM nameqc_namerev r WHERE r.kind = 'place' AND r.ref_id = p.id AND r.verdict <> 'pos')
                UNION ALL
                SELECT 'text', t.id, t.guess, t.ocr, NULL, t.geom FROM nameqc_text t
                 WHERE t.tag = %s AND NOT (t.id = ANY(%s))
                   AND NOT EXISTS (SELECT 1 FROM nameqc_namerev r WHERE r.kind = 'text' AND r.ref_id = t.id))
            SELECT kind, id AS ref, name, ocr, alt, ST_X(ST_Transform(geom, 3857)) AS x, ST_Y(ST_Transform(geom, 3857)) AS y,
                   count(*) OVER () AS todo
              FROM it ORDER BY {order[0]} LIMIT 1""", [tag, exp, tag, ext, *order[1]])
        if not rows:
            return Response({'todo': 0})
        r = rows[0]
        return Response({**{k: r[k] for k in ('kind', 'ref', 'name', 'ocr', 'alt', 'todo')}, 'loc': [r['x'], r['y']]})

    @action(detail=False, methods=['get'])
    def inbox(self, request):
        """Харагдаж буй хэсгийн олсон нэрс (чирж засахад) — bbox EPSG:4326 «x0,y0,x1,y1»."""
        try:
            b = [float(v) for v in (request.query_params.get('bbox') or '').split(',')]
            assert len(b) == 4
        except (ValueError, AssertionError):
            return Response({'detail': 'bbox'}, status=http.HTTP_400_BAD_REQUEST)
        tag = request.query_params.get('tag') or None
        rows = _rows("""SELECT 'place:' || id AS id, 'place' AS kind, id AS ref, tag, name, NULL AS ocr, alt, how, doubt,
                               review, ST_AsGeoJSON(ST_Transform(geom, 3857)) AS geojson
                          FROM nameqc_place
                         WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326) AND (%s::text IS NULL OR tag = %s)
                           AND coalesce(review, '') <> 'notname'
                        UNION ALL
                        SELECT 'text:' || t.id, 'text', t.id, t.tag, t.guess, t.ocr, NULL, 'text', true, NULL,
                               ST_AsGeoJSON(ST_Transform(t.geom, 3857))
                          FROM nameqc_text t
                         WHERE t.geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326) AND (%s::text IS NULL OR t.tag = %s)
                           AND NOT EXISTS (SELECT 1 FROM nameqc_namerev r WHERE r.kind = 'text' AND r.ref_id = t.id)
                         LIMIT 3000""", [*b, tag, tag, *b, tag, tag])
        return Response(_fc(rows))

    @action(detail=False, methods=['get'])
    def names(self, request):
        tag = request.query_params.get('tag') or ''
        q = (request.query_params.get('q') or '').strip()
        if len(q) < 2:
            return Response([])
        unit = self._unit(tag)
        rows = _rows("""SELECT g.id, g.name, k.name AS type, string_agg(DISTINCT u.unit, ', ') AS units,
                               bool_or(n.id IS NOT NULL) AS near
                          FROM core_geoname g LEFT JOIN core_constant k ON k.id = g.type_id
                          LEFT JOIN core_geoname_unit gu ON gu.geoname_id = g.id
                          LEFT JOIN core_adminunit u ON u.id = gu.adminunit_id AND u.parent_id IS NOT NULL
                          LEFT JOIN core_adminunit su ON su.id = %s
                          LEFT JOIN core_adminunit n ON n.id = u.id AND (n.id = su.id OR ST_Intersects(n.geom, su.geom))
                         WHERE g.name ILIKE %s
                         GROUP BY g.id, g.name, k.name
                         ORDER BY bool_or(n.id IS NOT NULL) DESC, similarity(lower(g.name), lower(%s)) DESC LIMIT 15""",
                     [unit, f'%{q}%', q])
        return Response(rows)

    @action(detail=False, methods=['post'])
    def batch(self, request):
        items = request.data.get('items') or []
        uid = request.user.id
        done = 0
        with transaction.atomic(), connection.cursor() as c:
            for it in items:
                kind, rid, verdict = it.get('kind'), it.get('id'), it.get('verdict')
                if kind not in ('place', 'text') or verdict not in ('ok', 'fixed', 'notname', 'pos'):
                    continue
                if verdict == 'pos':
                    # газрын зураг дээр цэгийг чирсэн — зөвхөн байрлал (нэрийн шийдвэр хэвээр)
                    pos = it.get('pos')
                    if kind != 'place' or not pos:
                        continue
                    xy = [float(pos[0]), float(pos[1])]
                    c.execute("""UPDATE nameqc_place SET geom = ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3857), 4326),
                                        how = 'human', pos_ok = true WHERE id = %s RETURNING tag, name, geoname_id, box_ids""",
                              [*xy, rid])
                    row = c.fetchone()
                    if not row:
                        continue
                    c.execute("""INSERT INTO nameqc_namerev (kind, ref_id, tag, verdict, name, geoname_id, pos, pos_moved,
                                                              box_ids, user_id)
                                  VALUES ('place', %s, %s, 'pos', %s, %s,
                                          ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3857), 4326), true, %s, %s)
                                  ON CONFLICT (kind, ref_id) DO UPDATE SET pos = EXCLUDED.pos, pos_moved = true,
                                      user_id = EXCLUDED.user_id, created = now()""",
                              [rid, row[0], row[1], row[2], *xy, row[3], uid])
                    done += 1
                    continue
                name = (it.get('name') or '').strip() or None
                if verdict != 'notname' and not name:
                    continue
                gid = it.get('geoname_id')
                if name and not gid:
                    c.execute("SELECT id FROM core_geoname WHERE name = %s ORDER BY id LIMIT 1", [name])
                    r = c.fetchone()
                    gid = r[0] if r else None
                pos = it.get('pos')
                src = 'nameqc_place' if kind == 'place' else 'nameqc_text'
                c.execute(f"SELECT tag, unit_id, box_ids, ST_AsText(geom) FROM {src} WHERE id = %s", [rid])
                row = c.fetchone()
                if not row:
                    continue
                tag, unit, box_ids, gwkt = row
                pg = ("ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 3857), 4326)", [float(pos[0]), float(pos[1])]) \
                    if pos else ("NULL", [])
                c.execute(f"""INSERT INTO nameqc_namerev (kind, ref_id, tag, verdict, name, geoname_id, pos, pos_moved,
                                                          box_ids, user_id)
                              VALUES (%s, %s, %s, %s, %s, %s, {pg[0]}, %s, %s, %s)
                              ON CONFLICT (kind, ref_id) DO UPDATE SET verdict = EXCLUDED.verdict, name = EXCLUDED.name,
                                  geoname_id = EXCLUDED.geoname_id, pos = EXCLUDED.pos, pos_moved = EXCLUDED.pos_moved,
                                  user_id = EXCLUDED.user_id, created = now()""",
                          [kind, rid, tag, verdict, name, gid, *pg[1], bool(pos), box_ids, uid])
                # газрын зураг дээр шууд тусгах
                if kind == 'place':
                    if verdict == 'notname':
                        c.execute("UPDATE nameqc_place SET review = 'notname' WHERE id = %s", [rid])
                    else:
                        c.execute(f"""UPDATE nameqc_place SET name = %s, geoname_id = COALESCE(%s, geoname_id),
                                             review = 'human', doubt = false, alt = NULL
                                             {', geom = ' + pg[0] + ", how = 'human', pos_ok = true" if pos else ''}
                                       WHERE id = %s""", [name, gid, *pg[1], rid])
                elif verdict == 'notname':
                    c.execute("DELETE FROM nameqc_text WHERE id = %s", [rid])
                else:
                    c.execute(f"""INSERT INTO nameqc_place (tag, unit_id, geoname_id, name, type_name, how, box_ids, geom,
                                                            review, reg, doubt)
                                  SELECT %s, %s, %s, %s, (SELECT k.name FROM core_geoname g JOIN core_constant k
                                                           ON k.id = g.type_id WHERE g.id = %s),
                                         %s, %s, {pg[0] if pos else 'ST_GeomFromText(%s, 4326)'}, 'human', 'human', false""",
                              [tag, unit, gid, name, gid, 'human' if pos else 'label', box_ids,
                               *(pg[1] if pos else [gwkt])])
                    c.execute("DELETE FROM nameqc_text WHERE id = %s", [rid])
                done += 1
        return Response({'saved': done})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        tag = request.query_params.get('tag') or ''
        r = _rows("""SELECT count(*) FILTER (WHERE verdict = 'ok') AS ok, count(*) FILTER (WHERE verdict = 'fixed') AS fixed,
                            count(*) FILTER (WHERE verdict = 'notname') AS notname,
                            count(*) FILTER (WHERE pos_moved) AS pos
                       FROM nameqc_namerev WHERE tag = %s""", [tag])[0]
        r['todo'] = _rows("""SELECT (SELECT count(*) FROM nameqc_place p WHERE p.tag = %s AND NOT EXISTS
                                       (SELECT 1 FROM nameqc_namerev r WHERE r.kind = 'place' AND r.ref_id = p.id))
                                  + (SELECT count(*) FROM nameqc_text t WHERE t.tag = %s AND NOT EXISTS
                                       (SELECT 1 FROM nameqc_namerev r WHERE r.kind = 'text' AND r.ref_id = t.id)) AS n""",
                          [tag, tag])[0]['n']
        return Response(r)
