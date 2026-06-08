import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Iterable

NS = {
    "sld": "http://www.opengis.net/sld",
    "ogc": "http://www.opengis.net/ogc",
    "se":  "http://www.opengis.net/se",
    "xlink": "http://www.w3.org/1999/xlink",
}
for p, uri in NS.items():
    ET.register_namespace(p, uri)

def _ns_of(elem) -> str:
    if elem is None:
        return "sld"
    return "se" if elem.tag.startswith("{"+NS["se"]+"}") else "sld"

def _ensure(parent, ns_key: str, tag_local: str):
    el = parent.find(f"{ns_key}:{tag_local}", NS)
    if el is None:
        el = ET.SubElement(parent, f"{{{NS[ns_key]}}}{tag_local}")
    return el

def _first(parent, *paths):
    for p in paths:
        x = parent.find(p, NS)
        if x is not None:
            return x
    return None

def _rm_all(parent, *paths):
    for p in paths:
        for node in list(parent.findall(p, NS)):
            parent.remove(node)

def _set_css(parent, name_attr: str, value):
    if value in (None, ""):
        return
    for c in parent.findall("sld:CssParameter", NS) + parent.findall("se:SvgParameter", NS):
        if c.get("name") == name_attr:
            c.text = str(value)
            return
    # parent-ийн namespace-аас хамаарч зөв элементийг сонгоно
    use_se = parent.tag.startswith("{"+NS["se"]+"}")
    tag = "SvgParameter" if use_se else "CssParameter"
    node = ET.SubElement(parent, f"{{{NS['se' if use_se else 'sld']}}}{tag}", {"name": name_attr})
    node.text = str(value)

def _text(x):
    return "" if x is None else str(x).strip()

def _to_file_url(maybe_path_or_url: str) -> str:
    s = _text(maybe_path_or_url)
    if not s:
        return s
    if s.startswith(("file://", "http://", "https://")):
        return s
    p = Path(s)
    if p.is_absolute():
        return "file://" + p.resolve().as_posix()
    return s

def _infer_mime_from_ext(path_or_url: str) -> str:
    ext = os.path.splitext(path_or_url.split("?")[0])[1].lower()
    return {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
    }.get(ext, "image/svg+xml")

def _is_none_like(v):
    return v is None or v == "" or (isinstance(v, str) and v.strip().lower() == "none")

def _remove_child(parent, tag_ns, tag_local):
    el = parent.find(f"{tag_ns}:{tag_local}", NS)
    if el is not None:
        parent.remove(el)

# ----------------------------- Filter builder -----------------------------

def _ogc_literal(parent, value):
    ET.SubElement(parent, f"{{{NS['ogc']}}}Literal").text = str(value)

def _ogc_propname(parent, name):
    ET.SubElement(parent, f"{{{NS['ogc']}}}PropertyName").text = name

def _build_predicate(op: str, field: str, value):
    ogc = NS["ogc"]
    op = (op or "").lower()

    def _like(pattern: str):
        n = ET.Element(f"{{{ogc}}}PropertyIsLike", {"wildCard": "*", "singleChar": ".", "escape": "\\"})
        _ogc_propname(n, field)
        _ogc_literal(n, pattern)
        return n

    if op == "isnull":
        n = ET.Element(f"{{{ogc}}}PropertyIsNull"); _ogc_propname(n, field); return n
    if op == "isnotnull":
        n = ET.Element(f"{{{ogc}}}Not")
        inner = ET.SubElement(n, f"{{{ogc}}}PropertyIsNull"); _ogc_propname(inner, field); return n

    if op == "eq":
        n = ET.Element(f"{{{ogc}}}PropertyIsEqualTo"); _ogc_propname(n, field); _ogc_literal(n, value); return n
    if op == "neq":
        n = ET.Element(f"{{{ogc}}}PropertyIsNotEqualTo"); _ogc_propname(n, field); _ogc_literal(n, value); return n
    if op == "lt":
        n = ET.Element(f"{{{ogc}}}PropertyIsLessThan"); _ogc_propname(n, field); _ogc_literal(n, value); return n
    if op == "lte":
        n = ET.Element(f"{{{ogc}}}PropertyIsLessThanOrEqualTo"); _ogc_propname(n, field); _ogc_literal(n, value); return n
    if op == "gt":
        n = ET.Element(f"{{{ogc}}}PropertyIsGreaterThan"); _ogc_propname(n, field); _ogc_literal(n, value); return n
    if op == "gte":
        n = ET.Element(f"{{{ogc}}}PropertyIsGreaterThanOrEqualTo"); _ogc_propname(n, field); _ogc_literal(n, value); return n

    if op == "contains":
        return _like(f"*{value}*")
    if op == "startswith":
        return _like(f"{value}*")
    if op == "endswith":
        return _like(f"*{value}")

    if op == "between":
        if isinstance(value, str) and ".." in value:
            a, b = value.split("..", 1)
        elif isinstance(value, (list, tuple)) and len(value) >= 2:
            a, b = value[0], value[1]
        else:
            raise ValueError("between requires 'a..b' string or [a,b]")
        gte = ET.Element(f"{{{ogc}}}PropertyIsGreaterThanOrEqualTo"); _ogc_propname(gte, field); _ogc_literal(gte, a)
        lte = ET.Element(f"{{{ogc}}}PropertyIsLessThanOrEqualTo");   _ogc_propname(lte, field); _ogc_literal(lte, b)
        andn = ET.Element(f"{{{ogc}}}And"); andn.extend([gte, lte]); return andn

    if op == "in":
        items: Iterable = value
        if isinstance(value, str):
            items = [x.strip() for x in value.split(",") if x.strip() != ""]
        preds = []
        for v in items:
            eqn = ET.Element(f"{{{ogc}}}PropertyIsEqualTo")
            _ogc_propname(eqn, field); _ogc_literal(eqn, v)
            preds.append(eqn)
        if not preds:
            false_n = ET.Element(f"{{{ogc}}}And")
            a = ET.SubElement(false_n, f"{{{ogc}}}PropertyIsNull"); _ogc_propname(a, field)
            b = ET.SubElement(false_n, f"{{{ogc}}}Not")
            bb = ET.SubElement(b, f"{{{ogc}}}PropertyIsNull"); _ogc_propname(bb, field)
            return false_n
        if len(preds) == 1:
            return preds[0]
        or_n = ET.Element(f"{{{ogc}}}Or"); or_n.extend(preds); return or_n

    n = ET.Element(f"{{{ogc}}}PropertyIsEqualTo"); _ogc_propname(n, field); _ogc_literal(n, value); return n

def _build_filter_from_items(items: list[dict]) -> ET.Element:
    ogc = NS["ogc"]
    preds = []
    for it in items or []:
        field = it.get("field")
        op    = (it.get("operator") or "").lower()
        value = it.get("value")
        if not field or not op:
            continue
        preds.append(_build_predicate(op, field, value))
    flt = ET.Element(f"{{{ogc}}}Filter")
    if not preds:
        return flt
    if len(preds) == 1:
        flt.append(preds[0])
    else:
        andn = ET.SubElement(flt, f"{{{ogc}}}And")
        for p in preds:
            andn.append(p)
    return flt

# --------------------- Rule ordering helpers (NEW) ----------------------

HEADER_TAGS = {
    ("sld", "Name"),
    ("sld", "Title"),
    ("sld", "Abstract"),
    ("sld", "LegendGraphic"),
    ("se",  "Name"),
    ("se",  "Description"),
}

SYMB_TAGS = {
    ("sld", "PolygonSymbolizer"), ("sld", "LineSymbolizer"),
    ("sld", "PointSymbolizer"),   ("sld", "RasterSymbolizer"),
    ("se",  "PolygonSymbolizer"), ("se",  "LineSymbolizer"),
    ("se",  "PointSymbolizer"),   ("se",  "RasterSymbolizer"),
    ("sld", "TextSymbolizer"),    ("se",  "TextSymbolizer"),
}

def _child_key(el):
    if "}" in el.tag:
        uri, local = el.tag[1:].split("}", 1)
        for k, v in NS.items():
            if v == uri:
                return (k, local)
    return ("", el.tag)

def _header_end_index(rule):
    idx = 0
    for i, ch in enumerate(list(rule)):
        if _child_key(ch) in HEADER_TAGS:
            idx = i + 1
        else:
            break
    return idx

def _first_symbolizer_index(rule):
    for i, ch in enumerate(list(rule)):
        if _child_key(ch) in SYMB_TAGS:
            return i
    return None

def _insert_after_header(rule, node):
    idx = _header_end_index(rule)
    rule.insert(idx, node)

def _ensure_before_symbolizers(rule, node):
    sym_idx = _first_symbolizer_index(rule)
    if sym_idx is None:
        rule.append(node)
    else:
        rule.insert(sym_idx, node)

# ----------------------------- Find / Create rule -----------------------------

def _dedupe_rules_by_name(root, rule_name: str):
    fts_list = root.findall(".//sld:FeatureTypeStyle", NS)
    if not fts_list:
        return
    for fts in fts_list:
        rules = fts.findall("sld:Rule", NS) + fts.findall("se:Rule", NS)
        seen = False
        for r in list(rules):
            nm_el = r.find("sld:Name", NS) or r.find("se:Name", NS)
            nm = _text(nm_el.text) if nm_el is not None else ""
            if nm != _text(rule_name):
                continue
            if not seen:
                seen = True
            else:
                fts.remove(r)

def _find_rule(root, *, rule_name: str | None = None,
               property_name: str | None = None,
               literal_value: str | None = None):
    if rule_name:
        for r in root.findall(".//sld:Rule", NS) + root.findall(".//se:Rule", NS):
            nm = r.find("sld:Name", NS) or r.find("se:Name", NS)
            if nm is not None and _text(nm.text) == _text(rule_name):
                return r
    if property_name is not None and literal_value is not None:
        for r in root.findall(".//sld:Rule", NS) + root.findall(".//se:Rule", NS):
            for eq in r.findall(".//ogc:PropertyIsEqualTo", NS):
                pn = eq.find("ogc:PropertyName", NS)
                lit = eq.find("ogc:Literal", NS)
                if pn is not None and lit is not None:
                    if _text(pn.text) == _text(property_name) and _text(lit.text).strip("'\"") == _text(literal_value).strip("'\""):
                        return r
    return None

def _prune_empty_elements(node):
    for child in list(node):
        _prune_empty_elements(child)
    tag_local = node.tag.split("}",1)[-1]
    if len(list(node)) == 0 and (node.text is None or _text(node.text) == ""):
        if tag_local in ("Fill","Stroke","Halo","Font","Graphic","Mark"):
            pass

def _ensure_rule(root, rule_name: str) -> ET.Element:
    rule = _find_rule(root, rule_name=rule_name)
    if rule is not None:
        return rule
    style_node = (
        root.find(".//sld:UserStyle", NS) or
        root.find(".//se:UserStyle", NS)
    )
    if style_node is None:
        style_node = ET.SubElement(root, f"{{{NS['sld']}}}UserStyle")
    feature_type_style = (
        style_node.find("sld:FeatureTypeStyle", NS) or
        style_node.find("se:FeatureTypeStyle", NS) or
        ET.SubElement(style_node, f"{{{NS['sld']}}}FeatureTypeStyle")
    )
    rule = ET.SubElement(feature_type_style, f"{{{NS['sld']}}}Rule")
    nm = ET.SubElement(rule, f"{{{NS['sld']}}}Name")
    nm.text = str(rule_name)
    return rule

def _ensure_fts(root):
    fts = root.find(".//sld:FeatureTypeStyle", NS)
    if fts is not None:
        return fts
    nl = root.find("sld:NamedLayer", NS) or ET.SubElement(root, f"{{{NS['sld']}}}NamedLayer")
    us = nl.find("sld:UserStyle", NS) or ET.SubElement(nl, f"{{{NS['sld']}}}UserStyle")
    fts = us.find("sld:FeatureTypeStyle", NS) or ET.SubElement(us, f"{{{NS['sld']}}}FeatureTypeStyle")
    return fts

def _find_or_create_rule(root, *, rule_name: Optional[str]):
    r = _find_rule(root, rule_name=rule_name)
    if r is not None:
        return r
    fts = _ensure_fts(root)
    r = ET.SubElement(fts, f"{{{NS['sld']}}}Rule")
    if rule_name:
        nm = ET.SubElement(r, f"{{{NS['sld']}}}Name");  nm.text = str(rule_name)
        tt = ET.SubElement(r, f"{{{NS['sld']}}}Title"); tt.text = str(rule_name)
    return r

# ----------------------------- Text helpers -----------------------------

ANCHORS = {
    "top-left": (0, 1), "top": (0.5, 1), "top-right": (1, 1),
    "left": (0, 0.5), "center": (0.5, 0.5), "right": (1, 0.5),
    "bottom-left": (0, 0), "bottom": (0.5, 0), "bottom-right": (1, 0),
}

def _add_env_function(parent, key: str, default_literal: str):
    fn = ET.SubElement(parent, f"{{{NS['ogc']}}}Function", {"name": "env"})
    ET.SubElement(fn, f"{{{NS['ogc']}}}Literal").text = key
    ET.SubElement(fn, f"{{{NS['ogc']}}}Literal").text = default_literal
    return fn

def _if_then_else_env(parent, env_key: str, default_builder):
    fn = ET.SubElement(parent, f"{{{NS['ogc']}}}Function", {"name": "if_then_else"})
    cond = ET.SubElement(fn, f"{{{NS['ogc']}}}Function", {"name": "greaterThan"})
    left = ET.SubElement(cond, f"{{{NS['ogc']}}}Function", {"name": "strLength"})
    _add_env_function(left, env_key, "")
    ET.SubElement(cond, f"{{{NS['ogc']}}}Literal").text = "0"
    _add_env_function(fn, env_key, "")
    default_builder(fn)
    return fn

def add_text_symbolizer(
    rule,
    symb=None,
    *,
    geom_type: Optional[str] = None,
    geom_name='geom',
    text_field: Optional[str] = None,
    text_literal: Optional[str] = None,
    text_font_family: Optional[str] = None,
    text_font_style: Optional[str] = None,
    text_font_weight: Optional[str] = None,
    text_size: Optional[int | float] = None,
    text_color: Optional[str] = None,
    text_halo_color: Optional[str] = None,
    text_halo_radius: Optional[int | float] = None,
    text_halo_opacity: Optional[int | float] = None,
    text_rotation: Optional[int | float] = None,
    text_anchor: Optional[str] = None,
    text_displacement_x: Optional[int | float] = None,
    text_displacement_y: Optional[int | float] = None,
    follow_line: bool = True,
    vendor_options: dict | None = None,
    allow_env_preview: bool = True,
    is_with_text: bool = False,
):
    if not is_with_text or (not text_field and not text_literal):
        _rm_all(rule, "sld:TextSymbolizer", "se:TextSymbolizer")
        return None

    tns = _ns_of(symb)
    _rm_all(rule, "sld:TextSymbolizer", "se:TextSymbolizer")
    ts = ET.SubElement(rule, f"{{{NS[tns]}}}TextSymbolizer")

    # --- Geometry? (эхэнд) ---
    if geom_type in ("polygon", "multipolygon"):
        g = ET.SubElement(ts, f"{{{NS[tns]}}}Geometry")
        fn = ET.SubElement(g, f"{{{NS['ogc']}}}Function", {"name": "interiorPoint"})
        ET.SubElement(fn, f"{{{NS['ogc']}}}PropertyName").text = geom_name

    # --- Label ---
    label = ET.SubElement(ts, f"{{{NS[tns]}}}Label")
    if allow_env_preview:
        def _default_label(parent):
            if text_field:
                ET.SubElement(parent, f"{{{NS['ogc']}}}PropertyName").text = text_field
            else:
                ET.SubElement(parent, f"{{{NS['ogc']}}}Literal").text = _text(text_literal)
        _if_then_else_env(label, "label", _default_label)
    else:
        if text_field:
            ET.SubElement(label, f"{{{NS['ogc']}}}PropertyName").text = text_field
        else:
            ET.SubElement(label, f"{{{NS['ogc']}}}Literal").text = _text(text_literal)

    # --- Font? ---
    font = ET.SubElement(ts, f"{{{NS[tns]}}}Font")
    _set_css(font, "font-family", text_font_family)
    _set_css(font, "font-style",  text_font_style)
    _set_css(font, "font-weight", text_font_weight)
    # font-size (namespace-т тааруулж)
    size_param_tag = "SvgParameter" if tns == "se" else "CssParameter"
    fs = ET.SubElement(font, f"{{{NS[tns]}}}{size_param_tag}", {"name": "font-size"})
    if allow_env_preview:
        _add_env_function(fs, "size", str(text_size if text_size is not None else 12))
    else:
        fs.text = str(text_size if text_size is not None else 12)

    # --- LabelPlacement? ---
    lp = ET.SubElement(ts, f"{{{NS[tns]}}}LabelPlacement")
    if geom_type in ("line", "multiline") and follow_line:
        ET.SubElement(lp, f"{{{NS[tns]}}}LinePlacement")
    else:
        pp = ET.SubElement(lp, f"{{{NS[tns]}}}PointPlacement")
        ax, ay = ANCHORS.get(text_anchor or "center", (0.5, 0.5))
        ap = ET.SubElement(pp, f"{{{NS[tns]}}}AnchorPoint")
        apx = ET.SubElement(ap, f"{{{NS[tns]}}}AnchorPointX")
        apy = ET.SubElement(ap, f"{{{NS[tns]}}}AnchorPointY")
        if allow_env_preview:
            _add_env_function(apx, "ax", str(ax))
            _add_env_function(apy, "ay", str(ay))
        else:
            ET.SubElement(apx, f"{{{NS['ogc']}}}Literal").text = str(ax)
            ET.SubElement(apy, f"{{{NS['ogc']}}}Literal").text = str(ay)
        disp = ET.SubElement(pp, f"{{{NS[tns]}}}Displacement")
        dx = ET.SubElement(disp, f"{{{NS[tns]}}}DisplacementX")
        dy = ET.SubElement(disp, f"{{{NS[tns]}}}DisplacementY")
        _dx = 0 if text_displacement_x is None else text_displacement_x
        _dy = 0 if text_displacement_y is None else text_displacement_y
        if allow_env_preview:
            _add_env_function(dx, "dx", str(_dx))
            _add_env_function(dy, "dy", str(_dy))
        else:
            ET.SubElement(dx, f"{{{NS['ogc']}}}Literal").text = str(_dx)
            ET.SubElement(dy, f"{{{NS['ogc']}}}Literal").text = str(_dy)
        if text_rotation is not None:
            rot = ET.SubElement(pp, f"{{{NS[tns]}}}Rotation")
            if allow_env_preview:
                def _default_rot(parent):
                    ET.SubElement(parent, f"{{{NS['ogc']}}}Literal").text = str(text_rotation)
                _if_then_else_env(rot, "rot", _default_rot)
            else:
                ET.SubElement(rot, f"{{{NS['ogc']}}}Literal").text = str(text_rotation)

    # --- Halo? ---
    has_halo = any(v is not None for v in (text_halo_color, text_halo_radius, text_halo_opacity))
    if has_halo:
        halo = ET.SubElement(ts, f"{{{NS[tns]}}}Halo")
        if text_halo_radius is not None:
            ET.SubElement(halo, f"{{{NS[tns]}}}Radius").text = str(text_halo_radius)
        hf = ET.SubElement(halo, f"{{{NS[tns]}}}Fill")
        _set_css(hf, "fill", text_halo_color)
        _set_css(hf, "fill-opacity", text_halo_opacity)

    # --- Fill? (label color) ---
    if text_color:
        fill = ET.SubElement(ts, f"{{{NS[tns]}}}Fill")
        _set_css(fill, "fill", text_color)

    # --- Vendor options ---
    vo = {
        "conflictResolution": "true",
        "partials": "true",
        "spaceAround": "2",
        "goodnessOfFit": "0.5",
    }
    if geom_type in ("line", "multiline") and follow_line:
        vo.update({
            "followLine": "true",
            "maxAngleDelta": "45",
            "maxDisplacement": "150",
            "repeat": "300",
            "labelAllGroup": "true",
        })
    if vendor_options:
        vo.update({str(k): str(v) for k, v in vendor_options.items()})
    for k, v in vo.items():
        ET.SubElement(ts, f"{{{NS[tns]}}}VendorOption", {"name": k}).text = v
    return ts

# ----------------------------- Main updater -----------------------------

def update_rule_in_sld_xml_safe(
    sld_xml,
    *,
    rule_name = None,
    property_name = None,
    literal_value= None,
    filters = None,
    symbolizer,
    # Симбол параметрүүд
    fill_color=None, fill_opacity=None,
    stroke_color=None, stroke_width=None, stroke_opacity=None,
    stroke_dasharray=None, stroke_linecap=None, stroke_linejoin=None,
    size=None, icon=None, rotation=None,
    # Текстийн параметрүүд
    text_field= None,
    text_literal = None,
    text_size=None, text_color=None,
    text_font_family=None, text_font_style=None, text_font_weight=None,
    text_halo_color=None, text_halo_radius=None, text_halo_opacity=None,
    text_anchor = None,
    text_displacement_x = None,
    text_displacement_y = None,
    text_rotation = None,
    vendor_options = None,
    # Мета, масштаб
    rule_name_set = None,
    rule_title = None,
    min_scale=None, max_scale=None,
    rule_opacity=None,
    # Бусад
    geom_name: str = "geom",
    is_with_text: bool = True,
    allow_env_preview: bool = True,
):
    tree = ET.ElementTree(ET.fromstring(sld_xml))
    root = tree.getroot()
    rule = _find_rule(
        root,
        rule_name=rule_name,
        property_name=property_name,
        literal_value=literal_value,
    )
    if rule is None:
        fallback_name = (
            rule_name
            or (f"{property_name}={literal_value}" if property_name and literal_value is not None else None)
        )
        fts = _ensure_fts(root)
        rule = ET.SubElement(fts, f"{{{NS['sld']}}}Rule")
        if fallback_name:
            nm = ET.SubElement(rule, f"{{{NS['sld']}}}Name");  nm.text  = str(fallback_name)
            tt = ET.SubElement(rule, f"{{{NS['sld']}}}Title"); tt.text  = str(fallback_name)
        if isinstance(filters, list) and len(filters) > 0:
            flt = _build_filter_from_items(filters)
            if len(list(flt)) > 0:
                _insert_after_header(rule, flt)

    # Name / Title
    if rule_name_set is not None:
        nm = _first(rule, "sld:Name", "se:Name")
        if nm is None:
            nm = ET.SubElement(rule, f"{{{NS['sld']}}}Name")
        nm.text = str(rule_name_set)
    if rule_title is not None:
        tt = _first(rule, "sld:Title", "se:Description/se:Title")
        if tt is None:
            tt = ET.SubElement(rule, f"{{{NS['sld']}}}Title")
        tt.text = str(rule_title)

    # Filters (overwrite) зөв байрлалд
    if filters is not None:
        _rm_all(rule, "ogc:Filter")
        if isinstance(filters, list) and len(filters) > 0:
            flt = _build_filter_from_items(filters)
            if len(list(flt)) > 0:
                _insert_after_header(rule, flt)

    # Scale denominators BEFORE first symbolizer
    if min_scale is not None:
        ms = _first(rule, "sld:MinScaleDenominator")
        if ms is None:
            ms = ET.Element(f"{{{NS['sld']}}}MinScaleDenominator")
        ms.text = str(int(min_scale))
        _rm_all(rule, "sld:MinScaleDenominator")
        _ensure_before_symbolizers(rule, ms)

    if max_scale is not None:
        mx = _first(rule, "sld:MaxScaleDenominator")
        if mx is None:
            mx = ET.Element(f"{{{NS['sld']}}}MaxScaleDenominator")
        mx.text = str(int(max_scale))
        _rm_all(rule, "sld:MaxScaleDenominator")
        _ensure_before_symbolizers(rule, mx)

    # Symbolizer selection
    symb_key = (symbolizer or "").lower()
    symb_map = {
        "polygon": ("sld", "PolygonSymbolizer"),
        "line":    ("sld", "LineSymbolizer"),
        "point":   ("sld", "PointSymbolizer"),
        "raster":  ("sld", "RasterSymbolizer"),
        "text":    ("sld", "TextSymbolizer"),
    }
    if symb_key not in symb_map:
        raise ValueError(f"Unsupported symbolizer: {symbolizer!r}")
    ns_key, tag_local = symb_map[symb_key]
    symb = _first(rule, f"{ns_key}:{tag_local}")
    if symb is None:
        symb = ET.SubElement(rule, f"{{{NS[ns_key]}}}{tag_local}")

    if rule_opacity is not None:
        _set_css(symb, "opacity", rule_opacity)

    if symb_key == "polygon":
        no_fill_color = _is_none_like(fill_color)
        zero_opacity = isinstance(fill_opacity, (int, float)) and float(fill_opacity) == 0.0
        if fill_color == '#ffffff':
            _remove_child(symb, "sld", "Fill")
        elif not (no_fill_color and zero_opacity):
            fill = _ensure(symb, "sld", "Fill")
            _set_css(fill, "fill", fill_color)
            _set_css(fill, "fill-opacity", fill_opacity)
        else:
            _remove_child(symb, "sld", "Fill")

        stroke = _ensure(symb, "sld", "Stroke")
        _set_css(stroke, "stroke", stroke_color)
        _set_css(stroke, "stroke-width", stroke_width)
        _set_css(stroke, "stroke-opacity", stroke_opacity)
        _set_css(stroke, "stroke-dasharray", stroke_dasharray)
        _set_css(stroke, "stroke-linecap", stroke_linecap)
        _set_css(stroke, "stroke-linejoin", stroke_linejoin)

    elif symb_key == "line":
        stroke = _ensure(symb, "sld", "Stroke")
        _set_css(stroke, "stroke", stroke_color)
        _set_css(stroke, "stroke-width", stroke_width)
        _set_css(stroke, "stroke-opacity", stroke_opacity)
        _set_css(stroke, "stroke-dasharray", stroke_dasharray)
        _set_css(stroke, "stroke-linecap", stroke_linecap)
        _set_css(stroke, "stroke-linejoin", stroke_linejoin)

    elif symb_key == "point":
        gns = _ns_of(symb)
        graphic = _first(symb, f"{gns}:Graphic") or ET.SubElement(symb, f"{{{NS[gns]}}}Graphic")
        _rm_all(graphic, "sld:ExternalGraphic", "se:ExternalGraphic", "sld:Mark", "se:Mark",
                         "sld:Size", "se:Size", "sld:Rotation", "se:Rotation")

        if icon:
            href = _to_file_url(icon)
            ext = ET.SubElement(graphic, f"{{{NS[gns]}}}ExternalGraphic")
            online = ET.SubElement(ext, f"{{{NS[gns]}}}OnlineResource")
            online.set(f"{{{NS['xlink']}}}href", href)
            fmt = ET.SubElement(ext, f"{{{NS[gns]}}}Format")
            fmt.text = _infer_mime_from_ext(href)
        else:
            mark = ET.SubElement(graphic, f"{{{NS[gns]}}}Mark")
            mfill = ET.SubElement(mark, f"{{{NS[gns]}}}Fill");   _set_css(mfill, "fill",  fill_color)
            mstroke = ET.SubElement(mark, f"{{{NS[gns]}}}Stroke"); _set_css(mstroke, "stroke", stroke_color)
            _set_css(mstroke, "stroke-opacity", stroke_opacity)
            _set_css(mstroke, "stroke-width",   stroke_width)

        if size is not None:
            sz = ET.SubElement(graphic, f"{{{NS[gns]}}}Size")
            sz.text = str(size)

        if rotation is not None:
            grot = ET.SubElement(graphic, f"{{{NS[gns]}}}Rotation")
            grot.text = str(rotation)

    elif symb_key == "raster":
        if rule_opacity is not None:
            _set_css(symb, "opacity", rule_opacity)

    # TextSymbolizer (optional)
    add_text_symbolizer(
        rule,
        symb=symb,
        geom_type={"polygon": "polygon", "line": "line", "point": "point", "raster": None}.get(symb_key),
        geom_name=geom_name,
        text_field=text_field, text_literal=text_literal,
        text_font_family=text_font_family, text_font_style=text_font_style, text_font_weight=text_font_weight,
        text_size=text_size, text_color=text_color,
        text_halo_color=text_halo_color, text_halo_radius=text_halo_radius, text_halo_opacity=text_halo_opacity,
        text_rotation=text_rotation, text_anchor=text_anchor,
        text_displacement_x=text_displacement_x, text_displacement_y=text_displacement_y,
        follow_line=True, vendor_options=vendor_options,
        allow_env_preview=allow_env_preview, is_with_text=is_with_text,
    )

    try:
        ET.indent(tree, space="  ", level=0)  # Python 3.9+
    except Exception:
        print("Indentation failed")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")

# ----------------------------- Utils ------------------------------------

def _find_all_matching_rules(root, *, rule_name=None, property_name=None, literal_value=None):
    matches = []
    rules = root.findall(".//sld:Rule", NS) + root.findall(".//se:Rule", NS)
    for r in rules:
        ok = False
        if rule_name:
            nm = r.find("sld:Name", NS) or r.find("se:Name", NS)
            if nm is not None and _text(nm.text) == _text(rule_name):
                ok = True
        if not ok and property_name is not None and literal_value is not None:
            for eq in r.findall(".//ogc:PropertyIsEqualTo", NS):
                pn = eq.find("ogc:PropertyName", NS)
                lit = eq.find("ogc:Literal", NS)
                if pn is not None and lit is not None:
                    if _text(pn.text) == _text(property_name) and _text(lit.text).strip("'\"") == _text(literal_value).strip("'\""):
                        ok = True
                        break
        if ok:
            matches.append(r)
    return matches

def _cleanup_empty_parents(root):
    for us in root.findall(".//sld:UserStyle", NS) + root.findall(".//se:UserStyle", NS):
        for fts in list(us.findall("sld:FeatureTypeStyle", NS)) + list(us.findall("se:FeatureTypeStyle", NS)):
            has_rule = (
                fts.find("sld:Rule", NS) is not None or
                fts.find("se:Rule", NS) is not None
            )
            if not has_rule:
                us.remove(fts)
    for nl in root.findall(".//sld:NamedLayer", NS):
        for us in list(nl.findall("sld:UserStyle", NS)) + list(nl.findall("se:UserStyle", NS)):
            if len(list(us)) == 0:
                nl.remove(us)
    for nl in list(root.findall("sld:NamedLayer", NS)):
        if len(list(nl)) == 0:
            root.remove(nl)
    for us in list(root.findall("sld:UserStyle", NS)) + list(root.findall("se:UserStyle", NS)):
        if len(list(us)) == 0:
            root.remove(us)

def _rule_name_of(r):
    nm = r.find("sld:Name", NS) or r.find("se:Name", NS)
    if nm is not None and (nm.text or "").strip():
        return (nm.text or "").strip()
    for ch in list(r):
        tag = ch.tag.split("}", 1)[-1] if "}" in ch.tag else ch.tag
        if tag == "Name" and (ch.text or "").strip():
            return (ch.text or "").strip()
    return ""

def delete_rule_in_sld_xml(
    sld_xml: str,
    *,
    rule_name: str | None = None,
    property_name: str | None = None,
    literal_value: str | None = None,
    prune_empty: bool = True,
) -> tuple[str, int]:
    if not rule_name and not (property_name and literal_value is not None):
        raise ValueError("delete_rule_in_sld_xml: rule_name эсвэл (property_name + literal_value) шаардлагатай.")
    key = (str(rule_name).strip() if rule_name is not None else None)
    tree = ET.ElementTree(ET.fromstring(sld_xml))
    root = tree.getroot()
    parent_map = {child: parent for parent in root.iter() for child in parent}
    removed = 0
    rules = root.findall(".//sld:Rule", NS) + root.findall(".//se:Rule", NS)
    for r in list(rules):
        match = False
        if key:
            rn = _rule_name_of(r)
            if rn == key:
                match = True
        if not match and property_name is not None and literal_value is not None:
            for eq in r.findall(".//ogc:PropertyIsEqualTo", NS):
                pn = eq.find("ogc:PropertyName", NS)
                lit = eq.find("ogc:Literal", NS)
                if pn is not None and lit is not None:
                    left  = str((pn.text or "").strip())
                    right = str((lit.text or "")).strip("'\"").strip()
                    if left == str(property_name).strip() and right == str(literal_value).strip():
                        match = True
                        break
        if match:
            p = parent_map.get(r)
            if p is not None:
                try:
                    p.remove(r)
                    removed += 1
                except Exception:
                    try:
                        for ch in list(p):
                            if ch is r:
                                p.remove(ch)
                                removed += 1
                                break
                    except Exception:
                        print("Indentation failed")
    if removed > 0 and prune_empty:
        _cleanup_empty_parents(root)
    try:
        ET.indent(tree, space="  ", level=0)
    except Exception:
        print("Indentation failed")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8"), removed

def _strip_geometry_symbolizers(sld_xml: str, *, rule_name: str):
    tree = ET.ElementTree(ET.fromstring(sld_xml))
    root = tree.getroot()
    rule = _find_rule(root, rule_name=rule_name)
    if rule is None:
        return sld_xml
    for tag in ("PolygonSymbolizer", "LineSymbolizer", "PointSymbolizer", "RasterSymbolizer"):
        for n in list(rule.findall(f".//sld:{tag}", NS)) + list(rule.findall(f".//se:{tag}", NS)):
            try:
                rule.remove(n)
            except Exception:
                print("Failed to remove geometry symbolizer")
    try:
        ET.indent(tree, space="  ", level=0)
    except Exception:
        print("Indentation failed")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")
