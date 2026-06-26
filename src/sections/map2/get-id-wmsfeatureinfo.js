import { toLonLat } from "ol/proj";

/**
 * layerName: "point:gnssa" гэх мэт (WMTS layer-тай ижил)
 * WMS_URL: "http://local.nextgis.mn/geoserver/point/wms" (workspace-тай)
 */
export async function getIdByWmsFeatureInfo({
  map,
  coordinate,
  layerName,
  WMS_URL,
  infoFormat = "application/json",
  featureCount = 5,
}) {
  const view = map.getView();
  const resolution = view.getResolution();
  const projection = view.getProjection();

  // GeoServer WMS GetFeatureInfo URL
  const url =
    `${WMS_URL}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${encodeURIComponent(layerName)}` +
    `&QUERY_LAYERS=${encodeURIComponent(layerName)}` +
    `&INFO_FORMAT=${encodeURIComponent(infoFormat)}` +
    `&FEATURE_COUNT=${featureCount}` +
    `&SRS=${encodeURIComponent(projection.getCode())}` +
    `&X=50&Y=50` + // dummy, OL доороос зөв url гаргах өөр арга бий (доор)
    ``;

  // ✅ OpenLayers-д зөв X/Y, BBOX, WIDTH/HEIGHT-г автоматаар бодуулах хамгийн зөв:
  const source = new (await import("ol/source/TileWMS")).default({
    url: WMS_URL,
    params: {
      LAYERS: layerName,
      QUERY_LAYERS: layerName,
      INFO_FORMAT: infoFormat,
      FEATURE_COUNT: featureCount,
      TILED: true,
    },
    serverType: "geoserver",
    crossOrigin: "anonymous",
  });

  const infoUrl = source.getFeatureInfoUrl(coordinate, resolution, projection, {
    INFO_FORMAT: infoFormat,
    FEATURE_COUNT: featureCount,
  });

  // Debug: харж шалгахын тулд WMS GetFeatureInfo URL‑ийг log хийе
  // eslint-disable-next-line no-console
  console.log("[WMS DEBUG] GetFeatureInfo URL", {
    layerName,
    WMS_URL,
    infoUrl,
  });

  if (!infoUrl) return null;

  const res = await fetch(infoUrl);
  if (!res.ok) return null;

  // GeoServer алдаа гарвал INFO_FORMAT‑ийг үл хэрэгсэж PNG/XML буцаадаг
  // (EXCEPTIONS=inimage default). JSON биш бол parse хийхгүй, чимээгүй буцана.
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("json")) return null;

  const data = await res.json();

  // GeoServer ихэвчлэн { type:"FeatureCollection", features:[...] }
  const feat = data?.features?.[0];
  if (!feat) return null;

  const props = feat.properties || {};
  // энд өөрийн хүссэн primary key нэрээ тааруулна:
  const id = props.point_id ?? props.id ?? null;

  return { id, feature: feat, lonlat: toLonLat(coordinate, projection) };
}
