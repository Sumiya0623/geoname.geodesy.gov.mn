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
