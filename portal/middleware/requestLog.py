import json
from urllib.parse import parse_qs

from django.conf import settings
from core.models import Errors
from core.models import Error500
from core.models import RequestLog
from rest_framework.request import Request
from rest_framework.exceptions import AuthenticationFailed
from django.utils.deprecation import MiddlewareMixin

IGNORE_PATHS = (
    '/api/account/refresh/',
    # '/api/core/user/me/',
    '/api/core/constant/',
    '/api/account/request/',
    '/api/media/account/',
    '/api//account/request/stats/'
)

SENSITIVE_KEYS = {
    "password","new_password","token","access_token","refresh_token","access","refresh",
    "authorization","auth","api_key","client_secret","secret","sessionid"
}
REDACT = "******"

def _redact(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k.lower() in SENSITIVE_KEYS:
                out[k] = REDACT
            else:
                out[k] = _redact(v)
        return out
    if isinstance(obj, list):
        return [_redact(x) for x in obj]
    return obj

def _client_ip(request):
    xfwd = request.META.get('HTTP_X_FORWARDED_FOR')
    if xfwd:
        return xfwd.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')

def _safe_headers(request):
    try:
        return json.dumps(dict(request.headers), indent=2, ensure_ascii=False)
    except Exception:
        return '{}'

def _raw_body(request):
    try:
        body = request.body or b""
    except Exception:
        return ""

    if not body:
        return ""
    ctype = (request.META.get("CONTENT_TYPE") or "").lower()
    if ctype.startswith("multipart/"):
        return "<multipart body redacted>"
    try:
        s = body.decode("utf-8")
    except UnicodeDecodeError:
        return f"<{len(body)} bytes binary body redacted>"
    s = s.strip()
    try:
        data = json.loads(s)
        return _redact(data)
    except json.JSONDecodeError:
        pass
    if ctype.startswith("application/x-www-form-urlencoded"):
        parsed = {k: (v[0] if len(v)==1 else v) for k, v in parse_qs(s, keep_blank_values=True).items()}
        return _redact(parsed)
    low = s.lower()
    if any(k in low for k in SENSITIVE_KEYS):
        return "<redacted>"
    return s[:4096]  # уртыг хязгаарла

def _clean_for_model(Model, d: dict) -> dict:
    fields = {f.attname for f in Model._meta.concrete_fields}
    return {k: v for k, v in d.items() if k in fields}

def _serialize_resp_desc(response):
    # DRF Response.data dict байж болно — текст болгоё
    try:
        if hasattr(response, "data") and response.data is not None:
            return json.dumps(response.data, ensure_ascii=False)
        # response.reason_phrase эсвэл хоосон
        return getattr(response, "reason_phrase", "") or "client error"
    except Exception:
        return "client error"
    
def get_error_info(request):
    data = {
        'url': request.META['PATH_INFO'],
        'method': request.META['REQUEST_METHOD'],
        'headers' : json.dumps(dict(request.headers), indent=4, ensure_ascii=False),
        'scheme' : request.scheme,
    }
    return data


def set_body(self):
    try:
        body = self.body
    except Exception as e:
        body = {}
    return body

class RequestLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        path = getattr(request, 'path_info', '') or request.META.get('PATH_INFO', '')
        if path.endswith(IGNORE_PATHS):
            request._skip_log = True
            return None

        # user-id авах (authentication-гүй үед JWT cookie-аас оролдож үзнэ)
        user_id = None
        if getattr(request, "user", None) and request.user.is_authenticated:
            user_id = request.user.pk
        else:
            try:
                from portal.auth import JWTAuthFromCookie
                auth = JWTAuthFromCookie()
                drf_request = Request(request)
                result = auth.authenticate(drf_request)  # -> (user, token) | None
                if result:
                    user, token = result
                    request.user = user
                    request.auth = token
                    user_id = user.pk
            except AuthenticationFailed:
                pass
            except Exception:
                pass
        data = {
            'url': path,
            'query_string': request.META.get('QUERY_STRING', ''),
            'remote_ip': _client_ip(request),
            'user_id': user_id,
            'method': request.method,
            'headers': _safe_headers(request),
            'scheme': request.scheme,
        }
        body = _raw_body(request) if request.method in ('POST', 'PUT', 'PATCH') else ""
        request._log_data = data
        request._log_body = body
        return None

    def process_exception(self, request, exception):
        # Зөвхөн баригдаагүй exception (ихэвчлэн 5xx) үед орж ирнэ
        if getattr(request, '_skip_log', False):
            return None
        data = getattr(request, '_log_data', {
            'url': request.META.get('PATH_INFO', ''),
            'method': request.method,
            'headers': _safe_headers(request),
            'scheme': request.scheme,
            'query_string': request.META.get('QUERY_STRING', ''),
            'remote_ip': _client_ip(request),
            'user_id': getattr(request, 'user_id', None),
        })
        try:
            err_json = json.loads(exception.args[0])
            data['description'] = err_json.get('args') or str(exception)
            data['code'] = err_json.get('code', '')
        except Exception:
            data['description'] = str(exception)
        body = getattr(request, '_log_body', {}) if request.method in ('POST','PUT','PATCH') else {}
        data['data'] = json.dumps(body, ensure_ascii=False)
        
        Error500.objects.create(**data)
        return None 

    def process_response(self, request, response):
        # ignore
        if getattr(request, '_skip_log', False):
            return response
        data = getattr(request, '_log_data', None)
        body = getattr(request, '_log_body', "")
        if data:
            data['status_code'] = response.status_code
            if 400 <= response.status_code < 500:
                ed = {
                    'url': data.get('url', ''),
                    'method': data.get('method', request.method),
                    'code': str(response.status_code),                         # CharField тул str болгоно
                    'description': _serialize_resp_desc(response),
                    'headers': data.get('headers'),
                    'scheme': data.get('scheme'),
                    'data': json.dumps(body if request.method in ('POST','PUT','PATCH') else {}, ensure_ascii=False),
                }
                Errors.objects.create(**_clean_for_model(Errors, ed))

            # ---------- 5xx -> Error500 ----------
            elif response.status_code >= 500:
                ed = {
                    'url': data.get('url', ''),
                    'method': data.get('method', request.method),
                    # Error500-д 'code' талбар байхгүй тул бүү оруул
                    'description': _serialize_resp_desc(response),
                    'headers': data.get('headers'),
                    'scheme': data.get('scheme'),
                    'data': json.dumps(body if request.method in ('POST','PUT','PATCH') else {}, ensure_ascii=False),
                }
                Error500.objects.create(**_clean_for_model(Error500, ed))
            try:
                url = data.get('url', '')
                user_id = data.get('user_id')
                status_code = data.get('status_code')

                # Нэвтэрсэн логик:
                # - /api/core/user/me/ дуудлагыг login гэж үзнэ.
                # - Гэхдээ тухайн хэрэглэгчийн хамгийн сүүлийн log нь
                #   мөн /api/core/user/me/ байвал (logout хийгээгүй, доторх
                #   me дуудалт) давхар бичихгүй.
                if url == '/api/core/user/me/' and user_id:
                    last = (
                        RequestLog.objects.filter(user_id=user_id)
                        .order_by('-id')
                        .first()
                    )
                    if last and last.url == '/api/core/user/me/':
                        # Сүүлчийн log нь аль хэдийн me/ бол шинэ login биш
                        return response

                RequestLog.objects.create(
                    url=url,
                    query_string=data.get('query_string', ''),
                    remote_ip=data.get('remote_ip', ''),
                    user_id=user_id,
                    method=data.get('method', request.method),
                    status_code=status_code,
                    data=(
                        json.dumps(body, ensure_ascii=False)
                        if request.method in ('POST','PUT','PATCH') else None
                    ),
                )
            except Exception:
                import logging
                logging.getLogger(__name__).exception("request-log save failed")

        return response
