// "Шийдвэрийн сан" overlay — ЗЗ нэгжийн тогтоол/шийдвэрийн тоог газрын зурагт
// ХИЛ (полигон) + тооны badge болгож харуулна. Zoom түвшингээс хамааран задарна:
//   zoom < 7      → аймаг
//   7 ≤ zoom < 9  → сум
//   zoom ≥ 9      → баг    (bbox‑оор зөвхөн харагдах багийг татна)
// Hover: хулгана дээгүүр байгаа нэгжийн хилийг тодруулна.
// Badge дээр дарахад: тухайн нэгжийн шийдвэрүүдийн жагсаалтыг гаргана (onSelectUnit).
// zoom 2‑5 дээр ЗЗ нэгжгүй (улсын хэмжээ) баримтын тоог тусад нь (onNational).
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import Style from "ol/style/Style";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import { fromLonLat, transformExtent } from "ol/proj";

import axiosInstance, { endpoints } from "src/utils/axios";

const LEVEL_COLOR = { aimag: "#1d4ed8", sum: "#0891b2", bag: "#059669" };
const HOVER = "#f59e0b";
// Шийдвэргүй нэгжийн хил — зөвхөн байршлын хүрээ болгож саарлаар
const EMPTY_STROKE = "#b0b7c3";

function levelForZoom(zoom) {
  if (zoom < 7) return "aimag";
  if (zoom < 9) return "sum";
  return "bag";
}

export function createLegalOverlay(map, opts = {}) {
  const { onSelectUnit, onNational } = opts;
  const boundarySource = new VectorSource();
  const badgeSource = new VectorSource();
  const gj = new GeoJSON();
  let hoveredId = null;
  let enabled = false;
  let timer = null;
  let reqId = 0;
  // Инкремент ачаалалт: level солигдоход л цэвэрлэнэ. Пан хийхэд зөвхөн харагдах
  // мужийн ШИНЭ нэгжийг нэмнэ (дэлгэцээс гарсан хэсгийг дахин ачаалахгүй).
  let currentLevel = null;
  let loadedIds = new Set();

  const boundaryLayer = new VectorLayer({
    source: boundarySource,
    zIndex: 2790,
    visible: false,
    style: (f) => {
      const color = LEVEL_COLOR[f.get("level")] || "#1d4ed8";
      const hov = f.get("id") === hoveredId;
      const has = (f.get("count") || 0) > 0;
      // Шийдвэргүй — зөвхөн саарал хил (дэвсгэргүй), шийдвэртэй — цэнхэр тодруулга
      if (!has && !hov) {
        return new Style({
          stroke: new Stroke({ color: EMPTY_STROKE, width: 1 }),
          fill: new Fill({ color: "rgba(0,0,0,0)" }),
        });
      }
      return new Style({
        stroke: new Stroke({ color: hov ? HOVER : color, width: hov ? 3 : 2 }),
        fill: new Fill({
          color: hov ? "rgba(245,158,11,0.18)" : "rgba(29,78,216,0.10)",
        }),
      });
    },
  });
  const badgeLayer = new VectorLayer({
    source: badgeSource,
    zIndex: 2800,
    visible: false,
    style: (f) => {
      const color = LEVEL_COLOR[f.get("level")] || "#1d4ed8";
      const hov = f.get("id") === hoveredId;
      return new Style({
        text: new Text({
          text: String(f.get("count")),
          font: "bold 13px sans-serif",
          fill: new Fill({ color: "#ffffff" }),
          backgroundFill: new Fill({ color: hov ? HOVER : color }),
          backgroundStroke: new Stroke({ color: "#ffffff", width: 2 }),
          padding: [3, 7, 3, 7],
        }),
      });
    },
  });
  map.addLayer(boundaryLayer);
  map.addLayer(badgeLayer);

  async function update() {
    if (!enabled) return;
    const view = map.getView();
    const size = map.getSize();
    if (!size) return;
    const proj = view.getProjection();
    const zoom = view.getZoom() ?? 6;

    // Улсын хэмжээ (unit=NULL) — zoom 2‑5 дээр
    if (onNational) {
      if (zoom < 5.5) {
        try {
          const nr = await axiosInstance.get(
            endpoints.legal.mapCounts("level=national"),
          );
          onNational(nr.data?.national_count ?? 0);
        } catch (e) {
          onNational(0);
        }
      } else {
        onNational(null);
      }
    }

    const level = levelForZoom(zoom);
    // empty=1 → шийдвэргүй нэгжийн хил ч ирнэ (саарал контекст хүрээ)
    let q = `level=${level}&empty=1`;
    if (level !== "aimag") {
      const ext4326 = transformExtent(
        view.calculateExtent(size),
        proj,
        "EPSG:4326",
      );
      q += `&bbox=${ext4326.join(",")}`;
    }
    const levelChanged = level !== currentLevel;
    const my = ++reqId;
    try {
      const res = await axiosInstance.get(endpoints.legal.mapCounts(q));
      if (my !== reqId || !enabled) return;
      const feats = gj.readFeatures(res.data, {
        dataProjection: "EPSG:4326",
        featureProjection: proj,
      });
      if (levelChanged) {
        // Түвшин солигдсон — бүгдийг цэвэрлэж шинээр
        boundarySource.clear();
        badgeSource.clear();
        loadedIds = new Set();
        currentLevel = level;
      }
      // Зөвхөн ШИНЭ (өмнө ачаалаагүй) нэгжийг нэмнэ — пан үед давхардуулахгүй,
      // дэлгэцээс гарсан хэсгийг дахин ачаалахгүй.
      const newB = [];
      const newBadge = [];
      feats.forEach((f) => {
        const id = f.get("id");
        if (loadedIds.has(id)) return;
        loadedIds.add(id);
        newB.push(f);
        if (!(f.get("count") > 0)) return; // шийдвэргүй бол badge гаргахгүй
        const p = new Feature({
          geometry: new Point(fromLonLat([f.get("cx"), f.get("cy")])),
        });
        p.setProperties({
          id,
          name: f.get("name"),
          count: f.get("count"),
          level: f.get("level"),
        });
        newBadge.push(p);
      });
      if (newB.length) boundarySource.addFeatures(newB);
      if (newBadge.length) badgeSource.addFeatures(newBadge);
    } catch (e) {
      /* алгасна */
    }
  }

  const onMove = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(update, 250);
  };

  const onPointerMove = (e) => {
    if (!enabled || e.dragging) return;
    let hit = null;
    map.forEachFeatureAtPixel(
      e.pixel,
      (f, layer) => {
        if (layer === boundaryLayer || layer === badgeLayer) {
          hit = f.get("id");
          return true;
        }
        return false;
      },
      { hitTolerance: 3 },
    );
    if (hit !== hoveredId) {
      hoveredId = hit;
      boundaryLayer.changed();
      badgeLayer.changed();
      const el = map.getTargetElement();
      if (el) el.style.cursor = hit != null ? "pointer" : "";
    }
  };

  const onClick = (e) => {
    if (!enabled || !onSelectUnit) return;
    let props = null;
    map.forEachFeatureAtPixel(
      e.pixel,
      (f, layer) => {
        if (layer === badgeLayer) {
          props = f.getProperties();
          return true;
        }
        return false;
      },
      { hitTolerance: 5 },
    );
    if (props) onSelectUnit(props);
  };

  return {
    setEnabled(on) {
      enabled = on;
      boundaryLayer.setVisible(on);
      badgeLayer.setVisible(on);
      if (on) {
        map.on("moveend", onMove);
        map.on("pointermove", onPointerMove);
        map.on("singleclick", onClick);
        update();
      } else {
        map.un("moveend", onMove);
        map.un("pointermove", onPointerMove);
        map.un("singleclick", onClick);
        boundarySource.clear();
        badgeSource.clear();
        loadedIds = new Set();
        currentLevel = null;
        if (onNational) onNational(null);
      }
    },
    destroy() {
      map.un("moveend", onMove);
      map.un("pointermove", onPointerMove);
      map.un("singleclick", onClick);
      if (timer) clearTimeout(timer);
      map.removeLayer(boundaryLayer);
      map.removeLayer(badgeLayer);
    },
  };
}
