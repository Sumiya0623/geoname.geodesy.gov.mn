"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";

// ─────────────────────────────────────────────────────────
// Terrain3DView — CesiumJS 3D бөмбөрцөг, WMS давхаргатай.
// map.geodesy.gov.mn төслөөс нэвтрүүлсэн; geoname‑ий GeoServer хаяг ба
// давхаргын бүтэцтэй тааруулсан.
//
// Cesium‑ийн статик файлууд public/cesium/ дороос үйлчилнэ (CESIUM_BASE_URL).
// Сан нь ~4 МБ тул зөвхөн 3D горим асаах үед л динамикаар ачаална.
// ─────────────────────────────────────────────────────────

let cesiumPromise = null;

function loadCesium() {
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = import("cesium").then((mod) => {
    window.CESIUM_BASE_URL = "/cesium/";
    // Cesium Ion (ГАДААД үйлчилгээ) ашиглахгүй — токен байхгүй үед
    // сүлжээний хүсэлт явуулж алдаа өгөхөөс сэргийлнэ.
    mod.Ion.defaultAccessToken = undefined;
    return mod;
  });
  return cesiumPromise;
}

const Terrain3DView = forwardRef(
  ({ visible, overlays, wmsUrl, forwardedRef }, ref) => {
    // Динамик боодлоос ирэх forwardedRef эсвэл шууд ref — хоёуланг дэмжинэ.
    const resolvedRef = forwardedRef || ref;
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const cesiumRef = useRef(null);
    const wmsLayersRef = useRef({});
    const [viewerReady, setViewerReady] = useState(false);

    // ── Гадагш нээх API: OpenLayers‑тэй байрлалаа солилцоно ──
    useImperativeHandle(resolvedRef, () => ({
      syncFromOL(center, zoom, rotation) {
        const viewer = viewerRef.current;
        const Cesium = cesiumRef.current;
        if (!viewer || !Cesium) return;
        // OL‑ийн zoom → камерын өндөр. 38,000 км нь дэлхийн бүтэн харагдац.
        const height = 38000000 / 2 ** zoom;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(
            center[0],
            center[1],
            height,
          ),
          orientation: {
            heading: -rotation,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        });
        viewer.scene.requestRender();
      },
      getPosition() {
        const viewer = viewerRef.current;
        const Cesium = cesiumRef.current;
        if (!viewer || !Cesium) return null;
        const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
        const zoom = Math.log2(38000000 / Math.max(carto.height, 1));
        return {
          center: [
            Cesium.Math.toDegrees(carto.longitude),
            Cesium.Math.toDegrees(carto.latitude),
          ],
          zoom: Math.max(1, Math.min(zoom, 20)),
          rotation: 0,
        };
      },
    }));

    // ── Viewer‑ийг НЭГ удаа үүсгэнэ ──
    useEffect(() => {
      if (!containerRef.current || viewerRef.current) return undefined;
      let destroyed = false;

      loadCesium().then((Cesium) => {
        if (destroyed || !containerRef.current) return;
        cesiumRef.current = Cesium;

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          shadows: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
        });

        // Суурь давхарга: OSM + OpenTopoMap (сүүдэрлэлт)
        viewer.imageryLayers.removeAll();
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maximumLevel: 19,
            credit: new Cesium.Credit("OSM"),
          }),
        );
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
            maximumLevel: 17,
            credit: new Cesium.Credit("OpenTopoMap"),
          }),
        );

        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Анхдагч харагдац — Монгол
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(106.9, 47.9, 900000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
        });

        viewerRef.current = viewer;
        setViewerReady(true);
      });

      return () => {
        destroyed = true;
        if (viewerRef.current && !viewerRef.current.isDestroyed()) {
          viewerRef.current.destroy();
        }
        viewerRef.current = null;
        wmsLayersRef.current = {};
        setViewerReady(false);
      };
    }, []);

    // ── WMS давхаргуудыг тааруулах ──
    const syncWms = useCallback(() => {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium || !wmsUrl) return;

      (overlays || []).forEach((ov) => {
        if (!ov.layerFullName) return;
        const existing = wmsLayersRef.current[ov.id];
        if (existing) {
          existing.show = !!ov.visible;
          existing.alpha = ov.opacity ?? 1;
          return;
        }
        const provider = new Cesium.WebMapServiceImageryProvider({
          url: ov.url || wmsUrl,
          layers: ov.layerFullName,
          parameters: {
            TRANSPARENT: "true",
            FORMAT: "image/png",
            VERSION: "1.1.1",
            ...(ov.cqlFilter ? { CQL_FILTER: ov.cqlFilter } : {}),
            ...(ov.styles ? { STYLES: ov.styles } : {}),
          },
          credit: "",
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = ov.opacity ?? 1;
        layer.show = !!ov.visible;
        wmsLayersRef.current[ov.id] = layer;
      });
      viewer.scene.requestRender();
    }, [overlays, wmsUrl]);

    useEffect(() => {
      if (viewerReady) syncWms();
    }, [viewerReady, syncWms]);

    // ── Харагдах болоход хэмжээг нь дахин тооцно ──
    useEffect(() => {
      if (visible && viewerRef.current) {
        setTimeout(() => {
          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.resize();
            viewerRef.current.scene.requestRender();
          }
        }, 100);
      }
    }, [visible]);

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: visible ? "block" : "none",
            zIndex: 1,
          }}
        />
      </>
    );
  },
);

Terrain3DView.displayName = "Terrain3DView";

export default Terrain3DView;
