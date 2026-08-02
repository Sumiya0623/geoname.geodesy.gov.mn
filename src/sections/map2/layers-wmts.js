import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import ImageWMS from "ol/source/ImageWMS";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import LayerGroup from "ol/layer/Group";
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { get as getProjection } from "ol/proj";
import { getTopLeft, getWidth } from "ol/extent";

/**
 * NEXT_PUBLIC_GEOSERVER_URL жишээ:
 *   http://local.nextgis.mn/geoserver
 *   эсвэл http://point.local.nextgis.mn:8080/geoserver
 *
 * WMTS service ихэнхдээ:
 *   /geoserver/gwc/service/wmts   (workspace орохгүй)
 */
function buildWmtsServiceUrl(baseGeoserverUrl) {
  const base = String(baseGeoserverUrl || "").replace(/\/+$/, "");
  // base == "http://local.nextgis.mn/geoserver"
  return `${base}/gwc/service/wmts`;
}

const GWC_WMTS = buildWmtsServiceUrl(process.env.NEXT_PUBLIC_GEOSERVER_URL);
const MATRIX_SET = "WebMercatorQuad";
const projection = getProjection("EPSG:3857");
const projectionExtent = projection.getExtent();
const size = getWidth(projectionExtent) / 256;
const MAX_ZOOM = 19;
const resolutions = Array.from({ length: MAX_ZOOM }, (_, z) => size / 2 ** z);
const matrixIds = Array.from({ length: MAX_ZOOM }, (_, z) => `${z}`);

const tileGrid = new WMTSTileGrid({
  origin: getTopLeft(projectionExtent),
  resolutions,
  matrixIds,
});

function makeNetworkLayer({
  workspace,
  layer,
  title,
  visible = false,
  zIndex = 200,
}) {
  const layerName = `${workspace}:${layer}`;

  const source = new WMTS({
    url: GWC_WMTS,
    layer: layerName,
    matrixSet: MATRIX_SET,
    format: "image/png",
    projection,
    tileGrid,
    // style битгий өг — layer-ийн default style автоматаар авна
    wrapX: true,
    crossOrigin: "anonymous",
  });

  const olLayer = new TileLayer({
    visible,
    preload: 1,
    source,
  });

  olLayer.setZIndex(zIndex);
  olLayer.set("name", layerName);
  olLayer.set("title", title || layerName);
  olLayer.set("workspace", workspace);
  // GNSS WMTS layer гэдгийг заасан flag
  olLayer.set("isGnssWmts", true);

  return olLayer;
}

// Нэрийн ангиллын per‑type view‑ийн WMTS давхарга (GWC cache, WebMercatorQuad,
// image/png). Зөвхөн maxZoom хүртэл харагдана — дээш нь WMS амьдаар рендерлэнэ.
export function makeViewWmtsLayer({
  workspace = "geoname",
  view,
  maxZoom = 14,
  zIndex = 300,
}) {
  const layerName = `${workspace}:${view}`;
  const source = new WMTS({
    url: GWC_WMTS,
    layer: layerName,
    matrixSet: MATRIX_SET,
    format: "image/png",
    projection,
    tileGrid,
    wrapX: true,
    crossOrigin: "anonymous",
  });
  const olLayer = new TileLayer({
    source,
    visible: true,
    preload: 1,
    maxZoom, // cache хийсэн zoom хүртэл л харагдана (дээш нь WMS)
  });
  olLayer.setZIndex(zIndex);
  olLayer.set("name", `${layerName}__wmts`);
  return olLayer;
}

// Дурын GWC layer‑ийг (WebMercatorQuad gridset, image/png) WMTS давхаргаар авах.
// geoname:geoname зэрэг зөвхөн WebMercatorQuad‑д кэшлэгдсэн растеруудад тохиромжтой
// (gwc/service/wms + EPSG:3857 нь 900913 gridset байхгүйд 400 өгдөг).
export function makeGwcWmtsLayer({
  workspace = "geoname",
  layer,
  title,
  visible = false,
  zIndex,
}) {
  const layerName = `${workspace}:${layer}`;
  const source = new WMTS({
    url: GWC_WMTS,
    layer: layerName,
    matrixSet: MATRIX_SET,
    format: "image/png",
    projection,
    tileGrid,
    wrapX: true,
    crossOrigin: "anonymous",
  });
  const olLayer = new TileLayer({ source, visible, preload: 1 });
  if (zIndex != null) olLayer.setZIndex(zIndex);
  olLayer.set("name", layerName);
  if (title) olLayer.set("title", title);
  return olLayer;
}

export function buildLayersByName(apiItems, workspace = "point") {
  const layersByName = {};
  const uiItems = [];

  (apiItems || []).forEach((it, idx) => {
    if (!it?.layer) return;

    const layerName = `${workspace}:${it.layer}`;
    const olLayer = makeNetworkLayer({
      workspace,
      layer: it.layer,
      title: it.name,
      visible: false,
      zIndex: 200 + idx,
    });
    layersByName[layerName] = olLayer;
    uiItems.push({
      ...it,
      layerName,
    });
  });

  return { layersByName, uiItems };
}

export default function makeWmtsLayerGroup(apiItems = [], workspace = "point") {
  const { layersByName, uiItems } = buildLayersByName(apiItems, workspace);
  const layers = Object.values(layersByName);
  const group = new LayerGroup({ layers });
  group.set("name", `${workspace}:wmts_group`);
  group.set("title", "WMTS layers");
  group.set("layersByName", layersByName);
  group.set("uiItems", uiItems);
  return { group, layersByName, uiItems };
}

export function setLayerVisible(layersByName, layerName, visible) {
  const layer = layersByName?.[layerName];
  if (layer) layer.setVisible(Boolean(visible));
}

export function getWmtsDebugConfig() {
  return {
    GWC_WMTS,
    MATRIX_SET,
    MAX_ZOOM,
    matrixIds,
  };
}

// ----------------------------------------------------------------------
// Давхаргын zIndex тавина. LayerGroup (WMTS кэш + амьд WMS хосолсон) дээр
// OpenLayers нь бүлгийн zIndex‑ийг доторх давхаргууд руу ӨВЛҮҮЛДЭГГҮЙ тул
// бүлэг байвал доторх давхарга бүр дээр нь тавина — эс тэгвэл эрэмбэ ажиллахгүй.
// ----------------------------------------------------------------------
export function setLayerZIndex(layer, z) {
  if (!layer) return;
  layer.setZIndex(z);
  if (typeof layer.getLayers === "function") {
    layer.getLayers().forEach((l) => setLayerZIndex(l, z));
  }
}

// ----------------------------------------------------------------------
// BaseMapLayer (backend) тохиргооноос OpenLayers давхарга бүтээнэ.
// Газрын зургийн бүх хуудас (том зураг, байршил харах цонх …) НЭГ л энэ
// функцийг ашиглана — hardcode давхарга байхгүй.
// ----------------------------------------------------------------------
export function buildOlBaseLayer(cfg) {
  const p = cfg?.params || {};
  const st = cfg?.source_type;
  // Хоосон зураг (blank) — source‑гүй давхарга: юу ч зурахгүй, зөвхөн дэвсгэр
  // (цагаан/тунгалаг) үлдэнэ. Хэрэглэгч зөвхөн өөрийн overlay датаг харах үед.
  if (st === "blank") return new TileLayer({});
  if (st === "osm") return new TileLayer({ source: new OSM() });
  if (st === "xyz")
    return new TileLayer({
      source: new XYZ({
        url: cfg.url,
        ...(p.maxZoom ? { maxZoom: p.maxZoom } : {}),
      }),
    });
  const gsBase = process.env.NEXT_PUBLIC_GEOSERVER_URL;
  const parts = String(cfg?.gs_layer || "").split(":");
  const ws = cfg?.workspace || parts[0] || "";
  const layerName = parts.length > 1 ? parts[1] : parts[0];
  // Амьд WMS давхарга (workspace‑ийн /wms) — өндөр зумд бүрэн чанартай рендер
  const liveWms = (minZoom) =>
    new TileLayer({
      source: new TileWMS({
        url: `${gsBase}/${ws}/wms`,
        params: {
          LAYERS: cfg.gs_layer,
          STYLES: p.styles || "",
          FORMAT: "image/png",
          TRANSPARENT: "true",
          TILED: "true",
          VERSION: "1.1.1",
          ...(p.cql ? { CQL_FILTER: p.cql } : {}),
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        hidpi: false,
      }),
      visible: true,
      ...(minZoom != null ? { minZoom } : {}),
    });

  // UNTILED WMS — харагдах хэсгийг НЭГ зураг болгон рендерлэнэ. Тайлын зах дээр
  // label тасрахгүй/алгасахгүй (params.untiled=true бол нэр бүрэн харагдана).
  const untiledWms = (minZoom) =>
    new ImageLayer({
      source: new ImageWMS({
        url: `${gsBase}/${ws}/wms`,
        params: {
          LAYERS: cfg.gs_layer,
          STYLES: p.styles || "",
          FORMAT: "image/png",
          TRANSPARENT: "true",
          VERSION: "1.1.1",
          ...(p.cql ? { CQL_FILTER: p.cql } : {}),
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
        ratio: 1,
      }),
      visible: true,
      ...(minZoom != null ? { minZoom } : {}),
    });

  if (st === "wmts") {
    // WMTS (GWC кэш, WebMercatorQuad) — layer нэр workspace‑гүй
    const wmts = makeGwcWmtsLayer({
      workspace: ws,
      layer: layerName,
      visible: true,
    });
    // params.maxZoom (эсвэл wmts_max) өгвөл: z≤maxZoom GWC кэш, түүнээс ЦААШ
    // АМЬД WMS (кэш дуусахад чанар унахгүй — WMS эх өгөгдлөөс бүрэн нягтралаар
    // рендерлэнэ). Хоёуланг нь Group‑оор нэгтгэнэ.
    const wmtsMax = Number(p.maxZoom ?? p.max_zoom ?? p.wmts_max ?? p.wmtsMax);
    if (wmtsMax) {
      wmts.setMaxZoom(wmtsMax); // z ≤ wmtsMax
      return new LayerGroup({ layers: [wmts, liveWms(wmtsMax)] }); // wms: z > wmtsMax
    }
    return wmts;
  }
  // wms — cached=true бол GWC кэш (WMS‑C), эс бөгөөс workspace‑ийн амьд WMS.
  // params.untiled=true бол z ≥ untiled_min (default 8)‑д UNTILED (нэг зураг) —
  // label бүрэн харагдана; түүнээс доош tiled (хурдан). Group‑оор нэгтгэнэ.
  const cached = !!p.cached;
  if (!cached) {
    if (p.untiled) {
      const umin = Number(p.untiled_min ?? p.untiledMin ?? 7);
      const tiled = liveWms(); // z < umin: tiled (хурдан)
      tiled.setMaxZoom(umin);
      return new LayerGroup({ layers: [tiled, untiledWms(umin)] }); // z ≥ umin: untiled
    }
    return liveWms();
  }
  const cachedWms = new TileLayer({
    source: new TileWMS({
      url: `${gsBase}/gwc/service/wms`,
      params: {
        LAYERS: cfg.gs_layer,
        STYLES: p.styles || "",
        FORMAT: "image/png",
        TRANSPARENT: "true",
        TILED: "true",
        VERSION: "1.1.1",
        ...(p.cql ? { CQL_FILTER: p.cql } : {}),
      },
      serverType: "geoserver",
      crossOrigin: "anonymous",
      hidpi: false, // GWC 256×256 — HiDPI 282px зөрүүнээс сэргийлнэ
    }),
    visible: true,
  });
  // wms + cached + wmts_max: z≤max кэш, z>max амьд
  const cmax = Number(p.wmts_max ?? p.wmtsMax);
  if (cmax) {
    cachedWms.setMaxZoom(cmax);
    return new LayerGroup({ layers: [cachedWms, liveWms(cmax)] });
  }
  return cachedWms;
}
