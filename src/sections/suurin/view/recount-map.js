"use client";

import "ol/ol.css";
import "ol-ext/dist/ol-ext.css";
import Map from "ol/Map";
import View from "ol/View";
import Feature from "ol/Feature";
import XYZ from "ol/source/XYZ";
import WKT from "ol/format/WKT";
import Point from "ol/geom/Point";
import Draw from "ol/interaction/Draw";
import TileWMS from "ol/source/TileWMS";
import TileLayer from "ol/layer/Tile";
import GeoJSON from "ol/format/GeoJSON";
import PropTypes from "prop-types";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import LayerSwitcher from "ol-ext/control/LayerSwitcher";
import { Fill, Style, Stroke, Circle as CircleStyle } from "ol/style";
import { fromLonLat, transformExtent } from "ol/proj";
import { useRef, useEffect } from "react";

import { makeGwcWmtsLayer } from "src/sections/map2/layers-wmts";

import { Box, Card } from "@mui/material";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;

// Сонгосон обьектыг тод харуулах style (цэг/шугам/полигон)
const HIGHLIGHT_STYLE = new Style({
  image: new CircleStyle({
    radius: 10,
    fill: new Fill({ color: "rgba(255,86,0,0.9)" }),
    stroke: new Stroke({ color: "#ffffff", width: 2.5 }),
  }),
  stroke: new Stroke({ color: "#ff5600", width: 4 }),
  fill: new Fill({ color: "rgba(255,86,0,0.25)" }),
});

// Олон нэгж харагдвал хилийг тодруулах style
const BORDER_STYLE = new Style({
  stroke: new Stroke({ color: "#d32f2f", width: 3, lineDash: [8, 6] }),
});

// Суурь давхаргууд (LayerSwitcher‑т radio‑оор гарна)
const BASES = [
  {
    title: "Зураглал",
    make: () =>
      new TileLayer({
        source: new XYZ({
          url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          crossOrigin: "anonymous",
        }),
      }),
  },
  {
    title: "Хиймэл дагуул",
    make: () =>
      new TileLayer({
        source: new XYZ({
          url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
          crossOrigin: "anonymous",
        }),
      }),
  },
  {
    // geoname:geoname — нэрсийн M100k растер (GWC, зөвхөн WebMercatorQuad → WMTS)
    title: "Нэрийн зураг (M100k)",
    make: () => makeGwcWmtsLayer({ workspace: "geoname", layer: "geoname" }),
  },
  {
    title: "Байр зүй M100k",
    make: () =>
      new TileLayer({
        source: new TileWMS({
          url: `${GEOSERVER}/gwc/service/wms`,
          params: {
            LAYERS: "point:raster",
            FORMAT: "image/png",
            TRANSPARENT: "true",
            TILED: "true",
            VERSION: "1.1.1",
          },
          crossOrigin: "anonymous",
          serverType: "geoserver",
          hidpi: false, // GWC 256×256 — HiDPI 282px зөрүүнээс сэргийлнэ
        }),
      }),
  },
];

export default function RecountMap({
  cqlFilter,
  layer = "geoname:core_recount",
  height = 540,
  refreshKey = 0,
  drawMode = false,
  drawType = "Point",
  onDrawn,
  fitExtent,
  flyTarget,
  onMoveEnd,
  borders,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const drawSrcRef = useRef(null);
  const drawRef = useRef(null);
  const highlightSrcRef = useRef(null);
  const borderSrcRef = useRef(null);
  const onDrawnRef = useRef(onDrawn);
  const onMoveEndRef = useRef(onMoveEnd);

  useEffect(() => {
    onDrawnRef.current = onDrawn;
    onMoveEndRef.current = onMoveEnd;
  });

  useEffect(() => {
    if (!elRef.current || mapRef.current) return undefined;

    // Суурь давхаргууд — баг (radio), эхний "Байр зүй M100k" идэвхтэй
    const baseLayers = BASES.map((b, i) => {
      const L = b.make();
      L.set("title", b.title);
      L.set("baseLayer", true);
      L.setVisible(i === BASES.length - 1);
      return L;
    });

    // Газар зүйн нэр — бүх per-type view нэгтгэсэн LayerGroup (таних тэмдэгтэй)
    const namesLayer = new TileLayer({
      visible: true,
      zIndex: 40,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        params: {
          LAYERS: "geoname:names",
          FORMAT: "image/png",
          TRANSPARENT: "true",
          TILED: "true",
          VERSION: "1.1.1",
        },
        crossOrigin: "anonymous",
        serverType: "geoserver",
      }),
    });
    namesLayer.set("title", "Нэр (таних тэмдэг)");

    // Дахин тооллого — тухайн төслийн recount
    const overlay = new TileLayer({
      visible: true,
      zIndex: 50,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        params: {
          LAYERS: layer,
          FORMAT: "image/png",
          TRANSPARENT: "true",
          TILED: "true",
          VERSION: "1.1.1",
          ...(cqlFilter ? { CQL_FILTER: cqlFilter } : {}),
        },
        crossOrigin: "anonymous",
        serverType: "geoserver",
      }),
    });
    overlay.set("title", "Дахин тооллого");
    overlayRef.current = overlay;

    // Сонгосон обьектыг тод харуулах давхарга — switcher‑т харуулахгүй
    const highlightSrc = new VectorSource();
    highlightSrcRef.current = highlightSrc;
    const highlightLayer = new VectorLayer({
      source: highlightSrc,
      zIndex: 95,
      style: HIGHLIGHT_STYLE,
    });
    highlightLayer.set("displayInLayerSwitcher", false);

    // Олон нэгжийн хил тодруулах давхарга
    const borderSrc = new VectorSource();
    borderSrcRef.current = borderSrc;
    const borderLayer = new VectorLayer({
      source: borderSrc,
      zIndex: 70,
      style: BORDER_STYLE,
    });
    borderLayer.set("displayInLayerSwitcher", false);

    // Зурах давхарга (drawMode үед дүрс тавина) — switcher‑т харуулахгүй
    const drawSrc = new VectorSource();
    drawSrcRef.current = drawSrc;
    const drawLayer = new VectorLayer({ source: drawSrc, zIndex: 100 });
    drawLayer.set("displayInLayerSwitcher", false);

    const map = new Map({
      target: elRef.current,
      layers: [
        ...baseLayers,
        namesLayer,
        overlay,
        borderLayer,
        highlightLayer,
        drawLayer,
      ],
      view: new View({ center: fromLonLat([103, 47]), zoom: 5 }),
    });
    mapRef.current = map;

    // ol-ext LayerSwitcher control (баруун дээд буланд)
    map.addControl(
      new LayerSwitcher({
        reordering: false,
        trash: false,
        extent: false,
        collapsed: true,
      }),
    );

    // Газрын зураг хөдлөхөд харагдах хүрээг (4326 bbox) эцэг рүү дамжуулна
    map.on("moveend", () => {
      if (!onMoveEndRef.current) return;
      const ext = map.getView().calculateExtent(map.getSize());
      const b = transformExtent(ext, "EPSG:3857", "EPSG:4326");
      onMoveEndRef.current(b);
    });

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CQL шүүлт (төсөл/үе шат) шинэчлэгдэхэд
  useEffect(() => {
    if (!overlayRef.current) return;
    overlayRef.current
      .getSource()
      .updateParams({ CQL_FILTER: cqlFilter || undefined });
  }, [cqlFilter]);

  // Шинэ бичлэг нэмэгдэх/устахад зургийн давхаргыг дахин татах
  useEffect(() => {
    if (refreshKey && overlayRef.current) overlayRef.current.getSource().refresh();
  }, [refreshKey]);

  // Олон нэгж харагдвал хилийг тодруулах (locate‑ийн borders GeoJSON)
  useEffect(() => {
    const src = borderSrcRef.current;
    if (!src) return;
    src.clear();
    if (!borders?.features?.length) return;
    try {
      const feats = new GeoJSON().readFeatures(borders, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      src.addFeatures(feats);
    } catch (e) {
      // ignore
    }
  }, [borders]);

  // ЗЗ нэгж сонгоход тухайн нэгжийн хүрээ рүү navigate (fit)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitExtent || fitExtent.length !== 4) return;
    try {
      const ext3857 = transformExtent(fitExtent, "EPSG:4326", "EPSG:3857");
      map.getView().fit(ext3857, {
        padding: [40, 40, 40, 40],
        maxZoom: 13,
        duration: 600,
      });
    } catch (e) {
      // ignore
    }
  }, [fitExtent]);

  // "Байршил" дарахад тухайн обьектын одоогийн байршил руу navigate + ТОД харуулах
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    highlightSrcRef.current?.clear();
    if (!flyTarget) return;
    const view = map.getView();
    try {
      let geom = null;
      if (flyTarget.geom) {
        geom = new GeoJSON().readGeometry(flyTarget.geom, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });
      } else if (flyTarget.lon != null && flyTarget.lat != null) {
        geom = new Point(fromLonLat([flyTarget.lon, flyTarget.lat]));
      }
      if (!geom) return;
      // Тод тэмдэглэгээ
      highlightSrcRef.current?.addFeature(new Feature(geom));
      // Navigate
      if (geom.getType() === "Point") {
        view.animate({ center: geom.getCoordinates(), zoom: 15, duration: 600 });
      } else {
        view.fit(geom.getExtent(), {
          padding: [80, 80, 80, 80],
          maxZoom: 16,
          duration: 600,
        });
      }
    } catch (e) {
      // ignore
    }
  }, [flyTarget]);

  // Зурах горим — дүрс тавьж байршил (WKT) буцаана
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    if (drawMode) {
      drawSrcRef.current?.clear();
      const draw = new Draw({ source: drawSrcRef.current, type: drawType });
      draw.on("drawend", (e) => {
        const g = e.feature
          .getGeometry()
          .clone()
          .transform("EPSG:3857", "EPSG:4326");
        const wkt = new WKT().writeGeometry(g);
        if (onDrawnRef.current) onDrawnRef.current(wkt);
        setTimeout(() => {
          if (drawRef.current && mapRef.current) {
            mapRef.current.removeInteraction(drawRef.current);
            drawRef.current = null;
          }
          drawSrcRef.current?.clear();
        }, 0);
      });
      map.addInteraction(draw);
      drawRef.current = draw;
    }
    return () => {
      if (drawRef.current && mapRef.current) {
        mapRef.current.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [drawMode, drawType]);

  return (
    <Card sx={{ overflow: "hidden", position: "relative" }}>
      <Box
        ref={elRef}
        sx={{
          width: "100%",
          height,
          cursor: drawMode ? "crosshair" : "default",
        }}
      />
    </Card>
  );
}

RecountMap.propTypes = {
  cqlFilter: PropTypes.string,
  layer: PropTypes.string,
  height: PropTypes.number,
  refreshKey: PropTypes.number,
  drawMode: PropTypes.bool,
  drawType: PropTypes.string,
  onDrawn: PropTypes.func,
  fitExtent: PropTypes.arrayOf(PropTypes.number),
  flyTarget: PropTypes.object,
  onMoveEnd: PropTypes.func,
  borders: PropTypes.object,
};
