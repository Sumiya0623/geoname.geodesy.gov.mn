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
