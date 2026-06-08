# services/geoserver_style.py
import requests
from django.conf import settings

def _auth():
    return (settings.GEOSERVER_USER, settings.GEOSERVER_PASSWORD)

def _headers_xml():
    return {"Content-Type": "application/xml"}  # metadata POST/PUT

def _headers_sld():
    return {"Content-Type": "application/vnd.ogc.sld+xml"}  # SLD PUT

def _style_exists(workspace, style_name):
    url = f"{settings.GEOSERVER_URL}/rest/workspaces/{workspace}/styles/{style_name}.xml"
    r = requests.get(url, auth=_auth(), timeout=10)
    return r.status_code == 200

def _create_style_metadata(workspace, style_name):
    """POST metadata only: <style><name>..</name><filename>..</filename></style>"""
    url = f"{settings.GEOSERVER_URL}/rest/workspaces/{workspace}/styles"
    body = f"<style><name>{style_name}</name><filename>{style_name}.sld</filename></style>"
    r = requests.post(
        url,
        data=body.encode("utf-8"),
        headers=_headers_xml(),
        auth=_auth(),
        timeout=10,
    )
    return r

def _put_sld_raw(workspace, style_name, sld_text):
    """PUT SLD content (raw) — хамгийн найдвартай аргын нэг"""
    url = f"{settings.GEOSERVER_URL}/rest/workspaces/{workspace}/styles/{style_name}"
    # raw=true -> body-г шууд SLD гэж ойлгоно
    r = requests.put(
        url,
        params={"raw": "true"},
        data=sld_text.encode("utf-8"),
        headers=_headers_sld(),
        auth=_auth(),
        timeout=10,
    )
    return r

def _put_sld_legacy(workspace, style_name, sld_text):
    """Зарим хувилбар дээр .sld төгсгөл шаардаж магадгүй"""
    url = f"{settings.GEOSERVER_URL}/rest/workspaces/{workspace}/styles/{style_name}.sld"
    r = requests.put(
        url,
        data=sld_text.encode("utf-8"),
        headers=_headers_sld(),
        auth=_auth(),
        timeout=10,
    )
    return r

def _ensure_style(workspace, style_name, sld_text):
    """
    Idempotent: байвал SLD-ийг PUT, үгүй бол metadata POST хийгээд SLD-ийг PUT.
    400/409 үед альтернатив endpoint руу fallback хийнэ.
    """
    if _style_exists(workspace, style_name):
        r = _put_sld_raw(workspace, style_name, sld_text)
        if r.status_code not in (200, 201):
            # fallback (.sld endpoint)
            r = _put_sld_legacy(workspace, style_name, sld_text)
    else:
        r_meta = _create_style_metadata(workspace, style_name)
        if r_meta.status_code not in (200, 201):
            raise RuntimeError(f"Style metadata create failed: {r_meta.status_code} {r_meta.text}")
        r = _put_sld_raw(workspace, style_name, sld_text)
        if r.status_code not in (200, 201):
            r = _put_sld_legacy(workspace, style_name, sld_text)

    if r.status_code not in (200, 201):
        raise RuntimeError(f"Style create/update failed: {r.status_code} {r.text}")

def _assign_default_style(workspace, layer_name, style_name):
    url = f"{settings.GEOSERVER_URL}/rest/layers/{workspace}:{layer_name}"
    body = f"""<layer>
  <defaultStyle>
    <name>{style_name}</name>
    <workspace>{workspace}</workspace>
  </defaultStyle>
</layer>"""
    r = requests.put(
        url,
        data=body.encode("utf-8"),
        headers={"Content-Type": "text/xml"},
        auth=_auth(),
        timeout=10,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Assign default style failed: {r.status_code} {r.text}")
def _sld_for_geom(style_name, geom_type):
    """Geometry төрөлд тулгуурлан энгийн SLD үүсгэнэ."""
    gt = (geom_type or "").lower()

    if "point" in gt:
        symbolizer = """
      <sld:PointSymbolizer>
        <sld:Graphic>
          <sld:Mark>
            <sld:WellKnownName>circle</sld:WellKnownName>
            <sld:Fill>
              <sld:CssParameter name="fill">#2e7d32</sld:CssParameter>
              <sld:CssParameter name="fill-opacity">0.9</sld:CssParameter>
            </sld:Fill>
            <sld:Stroke>
              <sld:CssParameter name="stroke">#1b5e20</sld:CssParameter>
              <sld:CssParameter name="stroke-width">1</sld:CssParameter>
            </sld:Stroke>
          </sld:Mark>
          <sld:Size>10</sld:Size>
        </sld:Graphic>
      </sld:PointSymbolizer>"""
    elif "line" in gt:  # LineString, MultiLineString
        symbolizer = """
      <sld:LineSymbolizer>
        <sld:Stroke>
          <sld:CssParameter name="stroke">#1565c0</sld:CssParameter>
          <sld:CssParameter name="stroke-width">1.5</sld:CssParameter>
          <sld:CssParameter name="stroke-linecap">round</sld:CssParameter>
          <sld:CssParameter name="stroke-linejoin">round</sld:CssParameter>
        </sld:Stroke>
      </sld:LineSymbolizer>"""
    else:  # Polygon, MultiPolygon, unknown
        symbolizer = """
      <sld:PolygonSymbolizer>

        <sld:Stroke>
          <sld:CssParameter name="stroke">#0d47a1</sld:CssParameter>
          <sld:CssParameter name="stroke-width">0.7</sld:CssParameter>
        </sld:Stroke>
      </sld:PolygonSymbolizer>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor version="1.0.0"
  xmlns:sld="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc">
  <sld:NamedLayer>
    <sld:Name>{style_name}</sld:Name>
    <sld:UserStyle>
      <sld:Name>{style_name}</sld:Name>
      <sld:FeatureTypeStyle>
        <sld:Rule>
          <sld:Name>default</sld:Name>
          {symbolizer}
        </sld:Rule>
      </sld:FeatureTypeStyle>
    </sld:UserStyle>
  </sld:NamedLayer>
</sld:StyledLayerDescriptor>"""

def create_default_style_and_assign(workspace, layer_name, geom_type):
    style_name = f"{layer_name}"
    sld_text = _sld_for_geom(style_name, geom_type)
    _ensure_style(workspace, style_name, sld_text)
    _assign_default_style(workspace, layer_name, style_name)
    return style_name


def _safe_read_text(p, encoding="utf-8"):
    if not p.exists() or p.stat().st_size == 0:
        return """<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor xmlns:sld="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <sld:NamedLayer>
    <sld:Name>layer</sld:Name>
    <sld:UserStyle>
      <sld:Name>layer</sld:Name>
      <sld:FeatureTypeStyle/>
    </sld:UserStyle>
  </sld:NamedLayer>
</sld:StyledLayerDescriptor>""".strip()

    # эвдэрхий XML байж магадгүй тул defusedxml ашиглаж шалгана
    txt = p.read_text(encoding=encoding)
    try:
        from defusedxml import ElementTree as ET
        ET.fromstring(txt)  # зөв XML эсэхийг шалгая
        return txt
    except Exception:
        # эвдэрхий бол skeleton-оор эхлүүлье
        return """<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor xmlns:sld="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" version="1.0.0">
  <sld:NamedLayer>
    <sld:Name>layer</sld:Name>
    <sld:UserStyle>
      <sld:Name>layer</sld:Name>
      <sld:FeatureTypeStyle/>
    </sld:UserStyle>
  </sld:NamedLayer>
</sld:StyledLayerDescriptor>""".strip()


def _normalize_filters_for_sld(filters):
    if not filters:
        return []
    out = []
    for f in filters:
        field = (f.get("field") or "").strip()
        op    = (f.get("operator") or "").lower()
        val   = f.get("value", None)
        if not field or not op:
            continue
        if op == "eq" and (val is None or (isinstance(val, str) and val.strip() == "")):
            out.append({"field": field, "operator": "isnull", "value": None})
        else:
            out.append({"field": field, "operator": op, "value": val})
    return out


def _first_eq_field_value(filters):
    for it in filters or []:
        if (it.get("operator") or "").lower() == "eq":
            v = it.get("value", None)
            if v is not None and not (isinstance(v, str) and v.strip() == ""):
                return it.get("field"), v
    return None, None
