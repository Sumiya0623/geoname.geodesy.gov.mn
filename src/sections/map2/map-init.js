import VectorLayer from "ol/layer/Vector";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import GeoJSON from "ol/format/GeoJSON";
import Map from "ol/Map";
import View from "ol/View";
import MousePosition from "ol/control/MousePosition";
import { toStringHDMS } from "ol/coordinate";
import { fromLonLat } from "ol/proj";
import { boundingExtent } from "ol/extent";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import CircleStyle from "ol/style/Circle";

const WMS_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms`;

export function initMap(opts) {
  const {
    mapRef,
    clusterSourceRef,
    vectorSourceRef,
    measureSourceRef,
    measurementSearchSourceRef,
    radiusCircleSourceRef,
    linkLineSourceRef,
    linkLineLayerRef,
    nameGeomSourceRef,
    nameGeomLayerRef,
    clusterLayerRef,
    measurementSearchLayerRef,
    drawInteractionRef,
    geoserverLayerMap,
    setSelectedName,
    setSidebarOpen,
    updateScaleFromView,
    baseMapLayers,
    baseMap,
    radiusCircleLayerRef,
    Cluster,
    getClusterStyle,
    getDefaultPointStyle,
    measureStyle,
    getMeasurementSearchStyle,
    adminSourceRef,
    showAdminBoundaries,
    buildAdminWmsParams,
    mapObjRef,
    baseLayerRef,
    urlParams,
    setAnchorPosition,
    handleClearHighlight,
    enabledGeoserverFiltersRef,
    cqlWmsLayerRef,
    recountLayerRef,
    setFeatureSelector,
    sidebarOpen,
    lastClickCoordinateRef,
  } = opts;

  if (!mapRef.current) return;

  const baseLayer = baseMapLayers[baseMap] || baseMapLayers.CRV;

  clusterSourceRef.current = new Cluster({
    distance: 40,
    minDistance: 10,
    source: vectorSourceRef.current,
  });

  const vectorLayer = new VectorLayer({
    source: clusterSourceRef.current,
    style: (feature) => {
      const features = feature.get("features");
      const size = features ? features.length : 1;
      if (size > 1) return getClusterStyle(size);
      // Return default point style for individual points
      return getDefaultPointStyle();
    },
    zIndex: 2000,
  });
  clusterLayerRef.current = vectorLayer;

  const measureLayer = new VectorLayer({
    source: measureSourceRef.current,
    style: measureStyle,
  });

  const measurementSearchLayer = new VectorLayer({
    source: measurementSearchSourceRef.current,
    style: getMeasurementSearchStyle,
    zIndex: 3000, // Much higher than all other layers
    visible: true,
  });
  measurementSearchLayerRef.current = measurementSearchLayer;

  const radiusCircleLayer = new VectorLayer({
    source: radiusCircleSourceRef.current,
    zIndex: 2500,
    visible: true,
  });
  radiusCircleLayerRef.current = radiusCircleLayer;

  const linkLineLayer = new VectorLayer({
    source: linkLineSourceRef.current,
    style: new Style({
      stroke: new Stroke({
        color: "rgba(25,118,210,0.9)",
        width: 2,
      }),
    }),
    zIndex: 2600,
    visible: true,
  });
  linkLineLayerRef.current = linkLineLayer;

  // Дарсан объектын геометрийг ТОД УЛААНААР тодруулах давхарга (цэг/шугам/талбай).
  // Цагаан гадуур (casing) + улаан дотор → аль ч дэвсгэр дээр тод харагдана.
  const nameGeomLayer = new VectorLayer({
    source: nameGeomSourceRef.current,
    style: [
      new Style({
        stroke: new Stroke({ color: "rgba(255,255,255,0.9)", width: 7 }),
      }),
      new Style({
        stroke: new Stroke({ color: "#e11d48", width: 4 }),
        fill: new Fill({ color: "rgba(225,29,72,0.15)" }),
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: "#e11d48" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
      }),
    ],
    zIndex: 2700,
    visible: true,
  });
  nameGeomLayerRef.current = nameGeomLayer;

  const adminLayer = new TileLayer({
    source: (adminSourceRef.current = new TileWMS({
      url: WMS_URL,
      params: buildAdminWmsParams(),
      serverType: "geoserver",
    })),
    opacity: 0.7,
    visible: showAdminBoundaries,
  });

  const map = new Map({
    target: mapRef.current,
    layers: [
      baseLayer,
      adminLayer,
      vectorLayer,
      measureLayer,
      radiusCircleLayer,
      linkLineLayer,
      nameGeomLayer,
      measurementSearchLayer,
    ],
    view: new View({
      center:
        urlParams.lat && urlParams.lon
          ? fromLonLat([urlParams.lon, urlParams.lat])
          : fromLonLat([103.8467, 46.8625]),
      zoom: urlParams.zoom || 6,
      maxZoom: 18,
    }),
  });

  baseLayerRef.current = baseLayer;
  mapObjRef.current = map;

  const mousePositionControl = new MousePosition({
    coordinateFormat: function (coord) {
      const hdms = toStringHDMS(coord);
      return hdms;
    },
    projection: "EPSG:4326",
    className: "ol-mouse-position",
    target: document.getElementById("mouse-position"),
    undefinedHTML: "&nbsp;",
  });

  map.addControl(mousePositionControl);
  map.on("click", async (event) => {
    if (lastClickCoordinateRef) {
      lastClickCoordinateRef.current = event.coordinate;
    }
    const isDrawing = drawInteractionRef.current !== null;
    if (isDrawing) return;

    const measurementHit = map.forEachFeatureAtPixel(
      event.pixel,
      (feat, layer) =>
        layer === measurementSearchLayerRef.current ? feat : null,

      { hitTolerance: 5 },
    );
    if (measurementHit) {
      const measurementData = measurementHit.get("measurement");
      if (measurementData) {
        let measure = measurementData.point;
        measure["network_id"] = measurementData?.network?.id || "";

        setSelectedName(measure);

        const mapElement = map.getTargetElement();
        const rect = mapElement.getBoundingClientRect();
        setAnchorPosition({
          top: rect.top + event.pixel[1],
          left: rect.left + event.pixel[0] + 10, // Add 10px offset
        });

        setSidebarOpen(true);
        return;
      }
    }

    const clusterHit = map.forEachFeatureAtPixel(
      event.pixel,
      (feat, layer) => (layer === clusterLayerRef.current ? feat : null),
      { hitTolerance: 5 },
    );
    if (clusterHit) {
      const allSub = clusterHit.get("features") || [];
      const sub = allSub.filter((f) => {
        const lk = f && f.get && f.get("__gsvKey");
        const fid =
          lk && lk.startsWith("geoserver_")
            ? lk.slice("geoserver_".length)
            : null;
        return fid
          ? enabledGeoserverFiltersRef.current.has(String(fid))
          : false;
      });
      if (sub.length > 1) {
        const coords = sub.map((f) => f.getGeometry().getCoordinates());
        const firstCoord = coords[0];
        const allSameLocation = coords.every(
          (coord) =>
            Math.abs(coord[0] - firstCoord[0]) < 0.0001 &&
            Math.abs(coord[1] - firstCoord[1]) < 0.0001,
        );

        if (allSameLocation) {
          const features = sub.map((f) => {
            const pointData = f.get("pointData") || {};

            return {
              ...pointData,
              final_x: f.get("final_x"),
              final_y: f.get("final_y"),
              final_z: f.get("final_z"),
              network_id: f.get("network_id") || "",
            };
          });

          const pixel = map.getEventPixel(event.originalEvent);
          setFeatureSelector({
            show: true,
            features: features,
            position: { x: pixel[0], y: pixel[1] },
          });
          return;
        } else {
          const extent = boundingExtent(coords);
          const view = map.getView();
          view.fit(extent, {
            duration: 400,
            max: 18,
            padding: [40, 40, 40, 40],
          });
          return;
        }
      }
      if (sub.length === 1) {
        const f = sub[0];
        const pointData = f.get("pointData");
        pointData["final_x"] = f.get("final_x");
        pointData["final_y"] = f.get("final_y");
        pointData["final_z"] = f.get("final_z");
        pointData["network_id"] = f.get("network_id") || "";
        if (pointData) {
          setSelectedName(pointData);
          const mapElement = map.getTargetElement();
          const rect = mapElement.getBoundingClientRect();
          setAnchorPosition({
            top: rect.top + event.pixel[1],
            left: rect.left + event.pixel[0] + 10, // Add 10px offset
          });

          setSidebarOpen(true);
          return;
        }
      }
    }

    try {
      const view = map.getView();
      const allFeatures = [];
      if (cqlWmsLayerRef.current && cqlWmsLayerRef.current.getVisible()) {
        try {
          const src = cqlWmsLayerRef.current.getSource();
          if (src && typeof src.getFeatureInfoUrl === "function") {
            const infoUrl = src.getFeatureInfoUrl(
              event.coordinate,
              view.getResolution(),
              view.getProjection(),
              { INFO_FORMAT: "application/json", FEATURE_COUNT: 50 },
            );

            if (infoUrl) {
              const resp = await fetch(infoUrl, {
                credentials: "same-origin",
              });
              if (resp.ok) {
                const data = await resp.json();
                if (data && data.features && data.features.length > 0) {
                  data.features.forEach((feat) => {
                    const props =
                      feat && feat.properties ? feat.properties : null;
                    if (props && (props.id || props.point_id)) {
                      if (
                        !props.final_x &&
                        feat.geometry &&
                        feat.geometry.coordinates
                      ) {
                        const coords = feat.geometry.coordinates;
                        props.final_x = coords[0];
                        props.final_y = coords[1];
                      }
                      // Улаан highlight-д зориулж бүтэн геометрийг хадгална
                      props._geom = feat.geometry || null;
                      allFeatures.push(props);
                    }
                  });
                }
              }
            }
          }
        } catch (cqlErr) {
          console.error("GetFeatureInfo for CQL layer failed", cqlErr);
        }
      }

      if (
        geoserverLayerMap.current &&
        typeof geoserverLayerMap.current.entries === "function"
      ) {
        for (const [layerKey, layer] of geoserverLayerMap.current.entries()) {
          try {
            // Доод zoom‑ийн (кэш) давхарга нь `${layerKey}__wmts` түлхүүртэй тул
            // "__wmts" дагаварыг хасаж жинхэнэ filterId‑г гаргана — эс бөгөөс
            // enabled олдохгүй → доод zoom дээр нэр дарахад popup гарахгүй.
            let baseKey = String(layerKey);
            if (baseKey.endsWith("__wmts")) baseKey = baseKey.slice(0, -6);
            const fid = baseKey.startsWith("geoserver_")
              ? baseKey.slice("geoserver_".length)
              : null;
            if (fid && !enabledGeoserverFiltersRef.current.has(String(fid)))
              continue;
            if (
              !layer ||
              (typeof layer.getVisible === "function" && !layer.getVisible())
            )
              continue;

            // Нэг ангилалд доод zoom (кэш, maxZoom 11) + дээд zoom (амьд WMS,
            // minZoom 11) гэсэн ХОЁР давхарга байдаг. getVisible() нь zoom мужийг
            // тооцдоггүй тул одоогийн zoom тухайн давхаргын (minZoom, maxZoom]
            // мужид байгаа эсэхийг шалгаж, зөвхөн харагдаж буй давхаргыг дуудна —
            // эс бөгөөс байрлал бүрт 2 давхардсан үр дүн гарна.
            const zNow = view.getZoom();
            const lMin =
              typeof layer.getMinZoom === "function"
                ? layer.getMinZoom()
                : -Infinity;
            const lMax =
              typeof layer.getMaxZoom === "function"
                ? layer.getMaxZoom()
                : Infinity;
            if (!(zNow > lMin && zNow <= lMax)) continue;

            const isFromStaticLayer = layer.get("isStaticLayer") || false;
            const layerFilterData = layer.get("filterData") || {};

            const src = layer.getSource && layer.getSource();
            if (!src || typeof src.getFeatureInfoUrl !== "function") continue;

            const infoUrl = src.getFeatureInfoUrl(
              event.coordinate,
              view.getResolution(),
              view.getProjection(),
              { INFO_FORMAT: "application/json", FEATURE_COUNT: 50 },
            );

            if (!infoUrl) continue;

            const resp = await fetch(infoUrl, { credentials: "same-origin" });
            if (!resp.ok) continue;

            const data = await resp.json();

            if (data && data.features && data.features.length > 0) {
              data.features.forEach((feat) => {
                const props = feat && feat.properties ? feat.properties : null;
                if (props && props.id) {
                  if (
                    !props.final_x &&
                    feat.geometry &&
                    feat.geometry.coordinates
                  ) {
                    const coords = feat.geometry.coordinates;
                    props.final_x = coords[0];
                    props.final_y = coords[1];
                  }

                  // Улаан highlight-д зориулж бүтэн геометрийг хадгална
                  props._geom = feat.geometry || null;
                  props.isFromStaticLayer = isFromStaticLayer;
                  props.layerInfo = {
                    layerKey,
                    filterId: fid,
                    groupName: layerFilterData.groupName,
                    isStatic: isFromStaticLayer,
                  };
                  allFeatures.push(props);
                }
              });
            }
          } catch (innerErr) {
            console.error("GetFeatureInfo for layer failed", innerErr);
          }
        }
      }

      // Recount vector (төслийн газрын зураг) — feature дээр дарахад дэлгэрэнгүй
      if (
        recountLayerRef &&
        recountLayerRef.current &&
        recountLayerRef.current.getVisible()
      ) {
        const rcFeat = map.forEachFeatureAtPixel(
          event.pixel,
          (feat, lyr) => (lyr === recountLayerRef.current ? feat : null),
          { hitTolerance: 6 },
        );
        if (rcFeat) {
          const props = { ...rcFeat.getProperties() };
          delete props.geometry;
          const g = rcFeat.getGeometry();
          // _geom‑ийг 4326 GeoJSON болгож highlight‑д зориулна
          try {
            props._geom = JSON.parse(
              new GeoJSON().writeGeometry(g, {
                dataProjection: "EPSG:4326",
                featureProjection: view.getProjection(),
              }),
            );
          } catch (e) {
            props._geom = null;
          }
          props._isRecount = true;
          allFeatures.push(props);
        }
      }

      if (allFeatures.length === 0) {
      } else if (allFeatures.length === 1) {
        setSelectedName(allFeatures[0]);

        const mapElement = map.getTargetElement();
        const rect = mapElement.getBoundingClientRect();
        setAnchorPosition({
          top: rect.top + event.pixel[1],
          left: rect.left + event.pixel[0] + 10, // Add 10px offset
        });

        setSidebarOpen(true);
        return;
      } else {
        const pixel = map.getEventPixel(event.originalEvent);
        setFeatureSelector({
          show: true,
          features: allFeatures,
          position: { x: pixel[0], y: pixel[1] },
        });
        return;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("GetFeatureInfo failed", e);
    }

    if (sidebarOpen) setSidebarOpen(false);
    setSelectedName(null);
    handleClearHighlight();
  });

  const view = map.getView();
  // Зөвхөн масштаб (scale badge)‑ыг шинэчилнэ. GNSS WMTS/WMS zoom‑switch логик нь
  // энэ төсөлд GNSS давхарга байхгүй тул (point төслөөс хуулагдсан) хассан.
  const onResChange = () => {
    updateScaleFromView(view);
  };
  onResChange();
  view.on("change:resolution", onResChange);

  return () => {
    // map.removeControl(scaleLineControl);
    map.setTarget(null);
  };
}
