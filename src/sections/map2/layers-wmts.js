import TileLayer from "ol/layer/Tile";
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
