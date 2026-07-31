"use client";
import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Box,
  Fab,
  Tab,
  Menu,
  Tabs,
  Stack,
  Table,
  Paper,
  Button,
  Dialog,
  Divider,
  Collapse,
  MenuItem,
  Tooltip,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  Layers as LayersIcon,
  Straighten as RulerIcon,
  Search as SearchIcon,
} from "@mui/icons-material";

import "ol/ol.css";
import "ol-layerswitcher/dist/ol-layerswitcher.css";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import VectorLayer from "ol/layer/Vector";
import RegularShape from "ol/style/RegularShape";
import ImageWMS from "ol/source/ImageWMS";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import TileWMS from "ol/source/TileWMS";
import VectorSource from "ol/source/Vector";
import Cluster from "ol/source/Cluster";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Circle from "ol/geom/Circle";
import Polygon, { circular } from "ol/geom/Polygon";
import LineString from "ol/geom/LineString";
import GeometryCollection from "ol/geom/GeometryCollection";
import { fromLonLat, toLonLat, transform, transformExtent } from "ol/proj";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import Text from "ol/style/Text";
import { getDistance, getLength } from "ol/sphere";
import Draw, { createBox } from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import Modify from "ol/interaction/Modify";
import GeoJSON from "ol/format/GeoJSON";
import { boundingExtent } from "ol/extent";
import {
  registerMapDraw,
  registerClearDraw,
  registerMapExtent,
  commitMapEdit,
  cancelMapEdit,
  registerMapEditGeom,
  registerRecountReload,
} from "../../components/map/mapDraw";
import NameSidebar from "../../components/map/NameSidebar";
import LayerControl from "../../components/map/LayerControl";

import FeatureSelector from "../../components/map/FeatureSelector";

import {
  buildLayersByName,
  makeViewWmtsLayer,
  buildOlBaseLayer,
} from "./layers-wmts";
import { createLegalOverlay } from "./legal-overlay";
import { useGetGeoserver, useGetBaseLayers } from "src/api/map";
import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import LegalNewEditForm from "src/sections/legal/legal-new-edit-form";
import { useGetLegalUnits } from "src/api/legal";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";
import GeoserverDialog from "src/components/map/geoserverDialog";
import FeatureTabPanel from "src/components/map/FeatureTabPanel";
import RecountEditDialog from "src/components/map/RecountEditDialog";
import FieldCalcDialog from "src/components/map/FieldCalcDialog";
import RecountLegend from "src/components/map/RecountLegend";
import MapAddName from "src/components/map/MapAddName";
import { statusColor } from "src/components/map/recountStatus";
import MapHeader from "src/components/map/MapHeader";
import axiosInstance, { endpoints } from "src/utils/axios";
import { usePathname } from "next/navigation";
import "./style.css";
import { setViewportVar } from "src/utils/viewportHeight";
import { initMap } from "./map-init";
import { statusCheck } from "../utils/statusCheck";
import { useResponsive } from "src/hooks/use-responsive";

const WMS_PARAMS = {
  LAYERS: "point:point",
  FORMAT: "image/png",
  TRANSPARENT: true,
  VERSION: "1.1.1",
  STYLES: "",
  EXCEPTIONS: "application/vnd.ogc.se_inimage",
};
const ADMIN_WMS_PARAMS = {
  LAYERS: "point:core_adminunit",
  FORMAT: "image/png",
  TRANSPARENT: true,
  VERSION: "1.1.1",
  STYLES: "",
  CQL_FILTER: "parent_id IS NULL",
};
const WMS_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms`;
// Газар зүйн нэр (geoname_view) WMS суурь URL — толгойн хайлтад
const GEONAME_WMS_URL = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/geoname/wms?service=WMS&version=1.1.0&request=GetMap&bbox=87,41,120,52&layers=geoname:geoname_view&srs=EPSG:4326&width=768&height=330&format=image/png`;
// Шийдвэрийн панелийн хүснэгт — бусад жагсаалттай ижил бүтэц (TableHeadCustom)
const LEGAL_TABLE_HEAD = [
  { id: "", label: "Nº", width: 44 },
  { id: "name", label: "Нэр" },
  { id: "type", label: "Төрөл", width: 130 },
  { id: "unit", label: "Нэгж", width: 110 },
  { id: "order_date", label: "Огноо", width: 130 },
  { id: "order_number", label: "Дугаар", width: 80 },
  { id: "names_count", label: "Нэрс", width: 70, align: "right" },
  { id: "", label: "", width: 84, align: "right" },
];

const RADIUS_FILL_COLOR = "rgba(33, 150, 243, 0.1)";
const RADIUS_STROKE_COLOR = "#2196f3";
const RADIUS_CENTER_STROKE_COLOR = "white";

const buildWmsParams = (overrides = {}) => ({ ...WMS_PARAMS, ...overrides });

// status_id → өнгө (map2 нь RECOUNT_STATUS татаж дүүргэнэ)
let recountStatusColorById = {};

// Аравтын градус → DMS (Градус°Минут′Секунд″Чиглэл) — доод status bar‑д
function toDMS(decimal, isLat) {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const dir = isLat ? (decimal >= 0 ? "N" : "S") : decimal >= 0 ? "E" : "W";
  const minStr = String(min).padStart(2, "0");
  const secStr = parseFloat(sec) < 10 ? `0${sec}` : sec;
  return `${deg}°${minStr}′${secStr}″${dir}`;
}

// Attribute хүснэгтэд ХАРАГДАХГҮЙ техникийн багана (дотоод түлхүүрүүд).
// Дата нь татагдсан хэвээр (засах/устгах/шүүлтэд хэрэгтэй) ч анхдагчаар
// нуугдана — 'Багана харуулах/нуух' цэснээс буцааж нээж болно.
const HIDDEN_FEATURE_COLS = [
  "id",
  "project_id",
  "name_id",
  "type_id",
  "type_l1",
  "type_l2",
  "type",
  "unit_ids",
  "nomek_codes",
];

// Доод мөрөнд сонгож болох масштабууд
const MAP_SCALE_OPTIONS = [
  5000, 10000, 25000, 50000, 100000, 200000, 500000, 1000000,
];

// Ангиллын ЗУРАГДАХ дараалал — Удирдлага панелийн ↑/↓ товчоор солигдоно.
// {type_id: эрэмбэ}. Жагсаалтын доод талынх нь ӨНДӨР zIndex‑тэй → дээр зурагдана.
let recountTypeOrder = {};
// Орон зайн сонголтоор ОЛДСОН тооллогын id‑ууд — газрын зураг дээр тодорно
let recountSelectedIds = new Set();

// Recount харагдац нь ХОЁР ГОРИМТОЙ:
//   • z > 12 (ойр)  — ДЭЛГЭРЭНГҮЙ: од + нэр (фонт нь px‑ээр ТҮГЖЭЭТЭЙ) + статус
//   • z ≤ 12 (хол)  — CLUSTER: ойр цэгүүд нэг бөмбөлөгт нийлж ТОО нь бичигдэнэ
//     (шугам/талбай нь дүрсээрээ, нэргүй харагдана) → овоорохгүй
const RECOUNT_LABEL_PX = 12; // шошгын өндөр (px, бүх zoom дээр ижил)
const RECOUNT_CLUSTER_MAX_ZOOM = 11; // үүнээс хол бол cluster
const RECOUNT_CLUSTER_DISTANCE = 50; // cluster нэгтгэх зай (px)

// Нэрний доор дараалсан ӨНГӨТ ЗУРААС — status бүрд нэг сегмент (давтагдашгүй өнгө).
// ШУГАМАН дүрс дээр зураас нь мөн placement:"line" — нэр шигээ МУРУЙГ ДАГАНА.
// (line placement нь offsetX‑ийг дэмждэггүй тул зураас бүрийг зайн тэмдэгтээр
// зэрэгцүүлж байрлуулна: бүх мөр ижил өргөнтэй тул төвдөө тэгширнэ.)
const BAR_PAD = 8; // зураас хооронд оруулах зайн тэмдэгтийн тоо

function recountStatusBars(feature, isLine) {
  const ids = String(feature.get("status_ids") || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const n = ids.length;
  return ids.map((id, i) => {
    const fill = new Fill({ color: recountStatusColorById[id] || "#64748b" });
    const stroke = new Stroke({ color: "#fff", width: 2 });
    const font = "bold 13px sans-serif";
    if (isLine) {
      return new Style({
        text: new Text({
          text:
            " ".repeat(BAR_PAD * i) + "━━" + " ".repeat(BAR_PAD * (n - 1 - i)),
          font,
          placement: "line",
          overflow: true,
          maxAngle: Math.PI / 4,
          offsetY: 11, // нэрийн ЯГ доор, шугамын дагуу
          fill,
          stroke,
        }),
      });
    }
    return new Style({
      text: new Text({
        text: "━━",
        font,
        textAlign: "left",
        offsetX: 10 + i * 16,
        offsetY: 12, // нэрийн ЯГ доор (ойртуулсан)
        fill,
        stroke,
      }),
    });
  });
}

// z ≤ 12 — CLUSTER бөмбөлөг (доторх тоо нь нэгтгэсэн цэгийн тоо).
// Ганц цэг бол энгийн улаан од (нэргүй).
function makeRecountClusterStyle(feature) {
  const n = (feature.get("features") || []).length;
  if (n <= 1) {
    return new Style({
      image: new RegularShape({
        points: 5,
        radius: 8,
        radius2: 3.5,
        fill: new Fill({ color: "rgba(211, 47, 47, 0.22)" }),
        stroke: new Stroke({ color: "#fff", width: 1 }),
      }),
    });
  }
  const r = 11 + Math.min(13, Math.log2(n) * 3.5);
  return new Style({
    image: new CircleStyle({
      radius: r,
      fill: new Fill({ color: "rgba(12, 245, 82, 0.79)" }),
      stroke: new Stroke({ color: "#fff", width: 2 }),
    }),
    text: new Text({
      text: String(n),
      font: `bold ${Math.round(r * 0.85)}px sans-serif`,
      fill: new Fill({ color: "#fff" }),
    }),
  });
}

// z ≤ 12 — шугам/талбайг ЗӨВХӨН дүрсээр (нэргүй). Цэгүүдийг cluster харуулна.
function makeRecountLowStyle(feature) {
  const geom = feature.getGeometry();
  const t = geom ? geom.getType() : "Point";
  if (t.indexOf("Line") >= 0) {
    return new Style({ stroke: new Stroke({ color: "#d32f2f", width: 3 }) });
  }
  if (t.indexOf("Polygon") >= 0) {
    return new Style({
      fill: new Fill({ color: "rgba(211,47,47,0.25)" }),
      stroke: new Stroke({ color: "#d32f2f", width: 2 }),
    });
  }
  return null;
}

// Recount ДЭЛГЭРЭНГҮЙ style (z > 12) — цэг(од)/шугам/талбай + нэр + өнгөт статус
// зураас. Энэ түвшинд БҮХ нэр зурагдана (ерөнхийлөлтгүй), фонт нь түгжээтэй.
function makeRecountStyle(feature) {
  const geom = feature.getGeometry();
  const t = geom ? geom.getType() : "Point";
  const name = feature.get("name") || "";
  const isLine = t.indexOf("Line") >= 0;

  const showLabel = !!name;
  const labelFont = `${RECOUNT_LABEL_PX}px sans-serif`;
  const labelFill = new Fill({ color: "#111" });
  const labelStroke = new Stroke({ color: "#fff", width: 3 });

  // Ангиллын дарааллаас зурагдах эрэмбэ (том нь дээр)
  const zIdx =
    recountTypeOrder[feature.get("type_id")] ??
    recountTypeOrder[feature.get("type_l2")] ??
    recountTypeOrder[feature.get("type_l1")] ??
    0;

  let base;
  if (isLine) {
    // Шугам — нэрийг ШУГАМЫН ДАГУУ (curve) байрлуулна
    base = new Style({
      stroke: new Stroke({ color: "#d32f2f", width: 3 }),
      text: showLabel
        ? new Text({
            text: name,
            font: labelFont,
            placement: "line",
            overflow: true,
            maxAngle: Math.PI / 4,
            fill: labelFill,
            stroke: labelStroke,
          })
        : undefined,
    });
  } else {
    const pointLabel = showLabel
      ? new Text({
          text: name,
          font: labelFont,
          textAlign: "left",
          offsetX: 9,
          overflow: true,
          fill: labelFill,
          stroke: labelStroke,
        })
      : undefined;
    if (t.indexOf("Point") >= 0) {
      base = new Style({
        image: new RegularShape({
          points: 5,
          radius: 8,
          radius2: 3.5,
          fill: new Fill({ color: "#d32f2f" }),
          stroke: new Stroke({ color: "#fff", width: 1 }),
        }),
        text: pointLabel,
      });
    } else {
      base = new Style({
        fill: new Fill({ color: "rgba(211,47,47,0.25)" }),
        stroke: new Stroke({ color: "#d32f2f", width: 2 }),
        text: pointLabel,
      });
    }
  }
  // Сонгогдсон объектыг ТОД (улбар шар халь + өндөр zIndex) харуулна
  if (recountSelectedIds.has(String(feature.get("id")))) {
    base.setZIndex(zIdx + 10000);
    const img = base.getImage?.();
    if (img?.getStroke?.()) {
      img.getStroke().setColor("#f59e0b");
      img.getStroke().setWidth(3);
    }
    if (base.getStroke?.()) {
      base.getStroke().setColor("#f59e0b");
      base.getStroke().setWidth(5);
    }
  } else {
    base.setZIndex(zIdx);
  }
  return showLabel ? [base, ...recountStatusBars(feature, isLine)] : [base];
}
const buildAdminWmsParams = (overrides = {}) => ({
  ...ADMIN_WMS_PARAMS,
  ...overrides,
});

// Backend‑ийн BaseMapLayer тохиргооноос OpenLayers давхарга байгуулна.
// source_type: osm | xyz | wms | wmts. params: {maxZoom, cached, styles, cql}.
// GeoJSON geometry (EPSG:4326)‑оос [minLon, minLat, maxLon, maxLat] bbox олох.
// Цэг/шугам/талбай (Multi‑, GeometryCollection орно) бүгдэд ажиллана.
const geoJsonBbox = (geom) => {
  if (!geom) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [x, y] = coords;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    coords.forEach(visit);
  };
  if (geom.type === "GeometryCollection") {
    (geom.geometries || []).forEach((g) => visit(g?.coordinates));
  } else {
    visit(geom.coordinates);
  }
  if (minX === Infinity) return null;
  return [minX, minY, maxX, maxY];
};

export const getNetworkColor = (networkName) => {
  const colors = {
    "ГРАВИМЕТРИЙН СҮЛЖЭЭ": "#00e676",
    "ӨНДРИЙН СҮЛЖЭЭ": "#ff6b35",
    "GNSS-ИЙН СҮЛЖЭЭ": "#7c4dff",
    "ТРИАНГУЛЯЦИЙН СҮЛЖЭЭ": "#00e5ff",
  };
  return colors[networkName] || "#ff3d00";
};

const inActiveWMS = {
  source: new TileWMS({
    url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms`,
    params: {
      // LAYERS: "point:basemap",
      LAYERS: "point:unknown",
      FORMAT: "image/png",
      TRANSPARENT: true,
      VERSION: "1.1.1",
    },
    serverType: "geoserver",
    crossOrigin: "anonymous",
  }),
};

function Map2() {
  const mdUp = useResponsive("up", "md");

  // Read URL parameters
  const urlParams = useMemo(() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      lat: params.get("lat") ? parseFloat(params.get("lat")) : null,
      lon: params.get("lon") ? parseFloat(params.get("lon")) : null,
      zoom: params.get("zoom") ? parseInt(params.get("zoom")) : null,
      point_id: params.get("point_id"),
    };
  }, []);

  // useGetGeoserver();
  useEffect(() => {
    setViewportVar();
    window.visualViewport?.addEventListener("resize", setViewportVar);
    return () =>
      window.visualViewport?.removeEventListener("resize", setViewportVar);
  }, []);

  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const baseLayerRef = useRef(null); // currently mounted basemap layer (TileLayer or LayerGroup)

  const measureSourceRef = useRef(new VectorSource());
  const vectorSourceRef = useRef(new VectorSource());
  const measurementSearchSourceRef = useRef(new VectorSource());
  const measurementSearchLayerRef = useRef(null);
  const radiusCircleSourceRef = useRef(new VectorSource());
  const radiusCircleLayerRef = useRef(null);
  const linkLineSourceRef = useRef(new VectorSource());
  const linkLineLayerRef = useRef(null);
  const nameGeomSourceRef = useRef(new VectorSource());
  const nameGeomLayerRef = useRef(null);
  const clusterSourceRef = useRef(null);
  const clusterLayerRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const snapInteractionRef = useRef(null);
  const adminSourceRef = useRef(null);
  const geoserverLayerMap = useRef(new Map());
  const baseLayerMap = useRef(new Map());
  const cqlWmsSourceRef = useRef(null);
  const cqlWmsLayerRef = useRef(null);
  const clusterStyleCacheRef = useRef({});
  const inactiveWmsLayerRef = useRef(null);
  const activeGnssLayersRef = useRef(new Set());
  const lastClickCoordinateRef = useRef(null);

  const [baseMap, setBaseMap] = useState("CRV");
  const [baseMapOpacity, setBaseMapOpacity] = useState({});

  // Төслийн газрын зураг (champaign/<id>/map) — тухайн төслийн recount (тодруулалт) WMS
  const pathname = usePathname();
  const _cmMatch = (pathname || "").match(
    /^\/dashboard\/champaign\/([^/]+)\/map/,
  );
  const recountProjectId = _cmMatch ? _cmMatch[1] : null;
  const [recountOn, setRecountOn] = useState(true);
  // Recount панелийн (type checkbox + draft) бүрдүүлсэн CQL. null → бүх recount.
  const [recountCql, setRecountCql] = useState(null);
  const recountLayerRef = useRef(null);
  // Төслийн ажлын талбай (ProjectArea) — Тодруулалт панелийн хөлөөс ирнэ.
  // null → давхарга унтраалттай.
  const [projectAreas, setProjectAreas] = useState(null);
  // Доод attribute хүснэгтийн toolbar‑аас нээгдсэн нэрийн форм.
  // {mode:"new"|"link", type:{id,name,desc}, geom, top, left}
  const [tabNameForm, setTabNameForm] = useState(null);
  // Формыг толгойн мөрөөс нь чирэх (drag) — курсорын шилжилтээр top/left
  const tabFormDragRef = useRef(null);
  const startTabFormDrag = useCallback((e) => {
    e.preventDefault();
    tabFormDragRef.current = { x: e.clientX, y: e.clientY };
    const onMove = (ev) => {
      const d = tabFormDragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      tabFormDragRef.current = { x: ev.clientX, y: ev.clientY };
      setTabNameForm((prev) =>
        prev
          ? {
              ...prev,
              top: Math.max(0, prev.top + dy),
              left: Math.max(0, prev.left + dx),
            }
          : prev,
      );
    };
    const onUp = () => {
      tabFormDragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);
  const projectAreaLayerRef = useRef(null);
  // Доод status bar — курсорын солбицол (DMS) ба масштаб
  const [cursorCoords, setCursorCoords] = useState({ lon: null, lat: null });
  const [mapScale, setMapScale] = useState(null);
  // Давхаргын жагсаалт дахь ИДЭВХТЭЙ давхарга (мөр дээр дарж сонгоно)
  // Зүүн 'Удирдлага' панелийн эзлэх өргөн (чирж солино) — доод хүснэгт үүнтэй уялдана
  const [managePanelW, setManagePanelW] = useState(0);
  // Доод attribute хүснэгт — нээсэн ангилал/давхарга бүрд НЭГ ТАБ
  const [featureTabs, setFeatureTabs] = useState([]);
  const [activeTabKey, setActiveTabKey] = useState(null);
  const [splitH, setSplitH] = useState(280); // доод хэсгийн өндөр (чирж солино)
  const splitDragRef = useRef(null);
  const featureTabsRef = useRef([]);
  // Мөр засах диалог (тооллого)
  const [editRow, setEditRow] = useState(null);
  // Field Calculator (бөөнөөр талбар шинэчлэх) — аль табд ажиллах
  const [fieldCalcTab, setFieldCalcTab] = useState(null);
  // Чанарын шалгалтын үр дүн (dialog)
  const [qualityReport, setQualityReport] = useState(null);
  const recountExtraLayersRef = useRef([]); // low(шугам/талбай) + cluster давхарга
  const recountLoadRef = useRef(null); // (cql, doFit) => recount vector‑ийг WFS‑ээр ачаална
  const [recountStatuses, setRecountStatuses] = useState([]); // [{id,name,color}]
  const [recountStatusCounts, setRecountStatusCounts] = useState({}); // {id:count}
  // Backend‑ээс ирсэн overlay‑ууд (hardcoded биш) — config‑оор нь generic
  // рендерлэнэ. key → OL layer, key → on/off.
  const [mapReady, setMapReady] = useState(false);
  const [extraOverlayOn, setExtraOverlayOn] = useState({});
  const extraOverlayLayersRef = useRef({});
  // "Шийдвэрийн сан" overlay (ЗЗ нэгжийн тогтоол/шийдвэрийн тоо). URL ?overlay=legal
  // үед автоматаар асна (legal хуудасны "Газрын зураг" товчноос ирэхэд).
  const [overlayLegal, setOverlayLegal] = useState(false);
  const legalOverlayRef = useRef(null);
  // Badge дээр дарахад тухайн нэгжийн шийдвэрүүд + улсын хэмжээний тоо (zoom 2‑5)
  const [legalDocsUnit, setLegalDocsUnit] = useState(null); // {id,name,level,count}
  const [legalDocs, setLegalDocs] = useState([]);
  const [legalDocsCount, setLegalDocsCount] = useState(0);
  const [legalDocsSearch, setLegalDocsSearch] = useState("");
  const [legalDocsLoading, setLegalDocsLoading] = useState(false);
  const [legalNational, setLegalNational] = useState(null);
  // Хүснэгт — бусад жагсаалттай ижил (useTable + TableHeadCustom + пагинаци)
  const legalTable = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "order_date",
    defaultRowsPerPage: 10,
  });
  // Панелийн хэмжээ — зүүн/доод ирмэг, буланг чирж өөрчилнө
  // Шийдвэрийн CRUD — эрхээр нь товчнуудыг харуулна
  const legalPerms = useMenuPermissions({ content: "legal" });
  const [legalForm, setLegalForm] = useState(null); // {mode:'create'|'edit', row}
  const [legalDelRow, setLegalDelRow] = useState(null);
  // Мөрийн 3 цэгийн цэс — бусад хүснэгттэй ижил (Засах / Устгах)
  const [legalMenu, setLegalMenu] = useState(null);
  const { enqueueSnackbar: legalSnack } = useSnackbar();
  const [legalDocsRefresh, setLegalDocsRefresh] = useState(0);
  const refetchLegalDocs = useCallback(
    () => setLegalDocsRefresh((n) => n + 1),
    [],
  );
  // Модны хүснэгтийн дүрснээс — доод attribute хүснэгтэд ТАБ болгож нээнэ
  const openLegalTab = useCallback(
    (f) => {
      setLegalDocs([]);
      setLegalDocsSearch("");
      legalTable.onResetPage();
      setLegalDocsUnit(f);
      setActiveTabKey("legal");
      setFeatureTabs((prev) => {
        const rest = prev.filter((t) => t.key !== "legal");
        return [
          ...rest,
          { key: "legal", kind: "legal", label: f.name || "Шийдвэр" },
        ];
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Газрын зургийн badge‑аас дуудахад ашиглана (init effect нь нэг л удаа ажилладаг)
  const openLegalTabRef = useRef(null);
  openLegalTabRef.current = openLegalTab;
  // Overlay давхаргуудын ил тод байдал (key→0..1)
  const [overlayOpacity, setOverlayOpacity] = useState({
    BASEMAP: 1,
    NOMENCLATURE: 1,
    DEM: 0.85,
  });
  const [selectedName, setSelectedName] = useState(null);
  const [geomEditing, setGeomEditing] = useState(false); // байрлал засах горим
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureResult, setMeasureResult] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState({ top: 0, left: 0 });
  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [layerControlAnchor, setLayerControlAnchor] = useState(null);
  const [showAdminBoundaries, setShowAdminBoundaries] = useState(false);
  const [enabledGeoserverFilters, setEnabledGeoserverFilters] = useState(
    new Set(),
  );
  const enabledGeoserverFiltersRef = useRef(new Set());
  const [geoserverSearchValue, setGeoserverSearchValue] = useState("");
  const [geoserverLayerOrder, setGeoserverLayerOrder] = useState([]);
  const [filters, setFilters] = useState({
    aimag: "",
    soum: "",
    number: "",
  });
  const [scaleDenom, setScaleDenom] = useState(0);

  // const { constants: statusList } = useGetConstantsForStatus("POINTSTATUS")

  // SearchPoint state
  const [searchPointState, setSearchPointState] = useState({
    activeTab: 0,
    searchParams: {
      lat: "",
      lon: "",
      radius_meter: 1000,
      nomek: "",
      network: "",
      system: "",
      class_in: "",
    },
    nomekSearchParams: {
      nomek: "",
    },
    showAdvanced: false,
    isSearching: false,
    shouldSearch: false,
    hasUnitSearchResults: false,
    hasNomekSearchResults: false,
    isDrawingMode: false,
    selectedNameId: null,
    page: 1,
    pageSize: 20,
    submittedCoordinateParams: null,
    submittedUnitFilters: null,
    submittedNomekValue: "",
    nomekValidation: {
      isValid: true,
      error: "",
    },
  });

  const updateScaleFromView = (view) => {
    try {
      const resolution = view.getResolution();
      if (resolution == null) return;
      const projection = view.getProjection();
      const mpu = projection?.getMetersPerUnit?.() || 1;
      const dpi = (window.devicePixelRatio || 1) * 96;
      const inchesPerMeter = 39.37;
      const center = view.getCenter();
      const [, lat] = transform(center, projection, "EPSG:4326");
      const latCorrection = 1 / Math.cos((lat * Math.PI) / 180);
      const scale = resolution * mpu * inchesPerMeter * dpi * latCorrection;
      setScaleDenom(Math.max(1, Math.round(scale)));
    } catch (_) {}
  };
  const [forceGeoserverOpen, setForceGeoserverOpen] = useState(false);
  // Толгойн хайлтын утга (илэрц 1‑с их бол дэлгэрэнгүй форм руу дамжина)
  const [geonameSearchTerm, setGeonameSearchTerm] = useState(null);
  const headerSearchNonce = useRef(0);
  const [forceGeoserverTab, setForceGeoserverTab] = useState(null);
  // Хайлтын илэрцийг газрын зургийн дээд талд хуудаслалттай хүснэгтээр жагсаах.
  // searchQuery = {params, count}; nameResults = одоогийн хуудасны мөрүүд.
  const [nameResults, setNameResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState(null);
  const [searchPage, setSearchPage] = useState(0); // 0‑based
  const [nameResultsLoading, setNameResultsLoading] = useState(false);
  // Хуудасны хэмжээ + серверээс ирсэн БОДИТ нийт тоо (searchQuery.count хуучирч болно)
  const [searchPageSize, setSearchPageSize] = useState(50);
  const [searchCount, setSearchCount] = useState(0);
  // Илэрцийн хүснэгтийн доторх шүүлт/эрэмбэ
  const [resTerm, setResTerm] = useState(""); // нэр, дугаар
  const [resType, setResType] = useState(["", "", ""]); // Төрөл→Дэд→Ангилал
  const [resAimag, setResAimag] = useState(""); // AdminUnit id
  const [resSum, setResSum] = useState(""); // AdminUnit id
  const [resGeom, setResGeom] = useState(""); // point | line | polygon | ""
  const [resOrder, setResOrder] = useState({ by: "name", desc: false });
  // Илэрцийн шүүлтийн сонголтууд — Төрөл → Дэд төрөл → Ангилал (parent‑аар)
  const [resTypeOpts, setResTypeOpts] = useState([[], [], []]);
  const fetchCats = useCallback(async (parent) => {
    try {
      const q = parent ? new URLSearchParams({ parent }).toString() : "";
      const res = await axiosInstance.get(endpoints.nameCategory.list(q));
      return res?.data?.results || res?.data || [];
    } catch (e) {
      return [];
    }
  }, []);
  useEffect(() => {
    fetchCats(null).then((r) => setResTypeOpts([r, [], []]));
  }, [fetchCats]);
  // Түвшин сонгоход дараагийн түвшнийг татаж, доошхийг цэвэрлэнэ
  const pickResType = useCallback(
    async (level, id) => {
      setSearchPage(0);
      const next = [...resType];
      next[level] = id;
      for (let i = level + 1; i < 3; i += 1) next[i] = "";
      setResType(next);
      if (level < 2) {
        const kids = id ? await fetchCats(id) : [];
        setResTypeOpts((prev) => {
          const o = [...prev];
          o[level + 1] = kids;
          for (let i = level + 2; i < 3; i += 1) o[i] = [];
          return o;
        });
      }
    },
    [resType, fetchCats],
  );
  // UNITLEVEL Constant‑ийн нэр ЯГ таарах ёстой ("Аймаг" гэвэл хоосон буцна)
  const { units: resAimagOptions } = useGetLegalUnits(
    "Аймаг/Нийслэл",
    null,
    true,
  );
  const { units: resSumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    resAimag || null,
    !!resAimag,
  );
  // Илэрцийн хүснэгтийг чирж хэмжээ өөрчлөх (resizable)
  const resDragRef = useRef(null);
  const [featureSelector, setFeatureSelector] = useState({
    show: false,
    features: [],
    position: { x: 0, y: 0 },
  });

  const { geoserver } = useGetGeoserver();

  // Backend‑ээс role‑оор шүүсэн суурь/нэмэлт давхаргын тохиргоо (/settings/gis
  // → basemap). LayerControl эдгээрээр л радио/checkbox‑оо харуулна — эрхгүй
  // давхарга харагдахгүй, нэр/дараалал/өнгө backend‑ээс ирнэ.
  const { baseLayers, baseLayersLoading } = useGetBaseLayers();
  // Ачаалж дуустал null (LayerControl hardcoded fallback харуулна, фликкер
  // гарахгүй). Ачаалсны дараа л role‑оор шүүсэн жагсаалтаар удирдана.
  const baseConfigs = useMemo(
    () =>
      baseLayersLoading
        ? null
        : (baseLayers || [])
            .filter((l) => l.layer_type === "base")
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [baseLayers, baseLayersLoading],
  );
  const overlayConfigs = useMemo(
    () =>
      baseLayersLoading
        ? null
        : (baseLayers || [])
            .filter((l) => l.layer_type === "overlay")
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [baseLayers, baseLayersLoading],
  );

  // Systems‑оос WMS давхаргууд үүсгэж map дээр нэмэх
  const [systemLayersByName, setSystemLayersByName] = useState({});
  const geoserverLeafLayers = useMemo(() => {
    if (!Array.isArray(geoserver)) return [];

    const leaves = [];
    const collectLeaves = (nodes = []) => {
      nodes.forEach((n) => {
        if (n.children && n.children.length > 0) {
          collectLeaves(n.children);
        } else if (n.layer) {
          leaves.push(n);
        }
      });
    };

    geoserver.forEach((group) => collectLeaves(group.children || []));

    return leaves;
  }, [geoserver]);

  useEffect(() => {
    if (!Array.isArray(geoserverLeafLayers) || geoserverLeafLayers.length === 0)
      return;

    const { layersByName, uiItems } = buildLayersByName(
      geoserverLeafLayers,
      "point",
    );
    setSystemLayersByName(layersByName);
    setSystemUiItems(uiItems);
  }, [geoserverLeafLayers]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

    const mapLayers = map.getLayers().getArray();

    Object.values(systemLayersByName).forEach((olLayer) => {
      if (!mapLayers.includes(olLayer)) {
        map.addLayer(olLayer);
      }
    });
  }, [systemLayersByName]);

  // Цэгийн системийн admin unit/network/system dropdown‑ууд geoname‑д
  // хэрэггүй — registered API дуудахгүйн тулд хоосон.
  const aimags = useMemo(() => [], []);
  const soums = useMemo(() => [], []);
  const networks = [];
  const systems = [];

  // ----- Суурь давхаргууд — backend BaseMapLayer тохиргооноос ДИНАМИК байгуулна.
  // Нэр/gs_layer/төрөл/source_type өөрчлөгдвөл газрын зурагт шууд тусна.
  // Ачаалж дуустал (baseConfigs=null) энгийн fallback (CRV/OSM).
  const baseMapLayers = useMemo(() => {
    if (baseConfigs && baseConfigs.length) {
      const out = {};
      baseConfigs.forEach((cfg) => {
        try {
          out[cfg.key] = buildOlBaseLayer(cfg);
        } catch (e) {
          /* алгасна */
        }
      });
      return out;
    }
    return {
      CRV: new TileLayer({
        source: new XYZ({
          url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        }),
      }),
      OSM: new TileLayer({ source: new OSM() }),
    };
  }, [baseConfigs]);

  const measureStyle = useMemo(
    () =>
      new Style({
        fill: new Fill({ color: "rgba(255, 255, 255, 0.2)" }),
        stroke: new Stroke({ color: "#ffcc33", width: 3, lineDash: [10, 10] }),
        image: new CircleStyle({
          radius: 5,
          stroke: new Stroke({ color: "#ffcc33", width: 2 }),
          fill: new Fill({ color: "rgba(255, 204, 51, 0.4)" }),
        }),
      }),
    [],
  );
  const radiusStroke = useMemo(
    () =>
      new Stroke({ color: RADIUS_STROKE_COLOR, width: 2, lineDash: [5, 5] }),
    [],
  );
  const radiusFill = useMemo(() => new Fill({ color: RADIUS_FILL_COLOR }), []);
  const radiusCenterImage = useMemo(
    () =>
      new CircleStyle({
        radius: 6,
        fill: new Fill({ color: RADIUS_STROKE_COLOR }),
        stroke: new Stroke({ color: RADIUS_CENTER_STROKE_COLOR, width: 2 }),
      }),
    [],
  );
  const radiusAreaStyle = useMemo(
    () =>
      new Style({
        stroke: radiusStroke,
        fill: radiusFill,
      }),
    [radiusFill, radiusStroke],
  );
  const radiusCenterStyle = useMemo(
    () =>
      new Style({
        image: radiusCenterImage,
      }),
    [radiusCenterImage],
  );
  const geodesicStyle = useMemo(
    () =>
      new Style({
        geometry: (feature) =>
          feature.get("modifyGeometry") || feature.getGeometry(),
        fill: radiusFill,
        stroke: radiusStroke,
        image: radiusCenterImage,
      }),
    [radiusCenterImage, radiusFill, radiusStroke],
  );
  const getDefaultPointStyle = () =>
    new Style({
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: "#3399CC" }),
        stroke: new Stroke({ color: "#ffffff", width: 1.25 }),
      }),
    });

  const getMeasurementSearchStyle = (feature) => {
    const status = statusCheck(
      feature?.get("measurement")?.point?.status?.name,
    );
    const offsetRadius = 8;

    const styles = [
      new Style({
        image: new CircleStyle({
          radius: offsetRadius + 2,
          fill: new Fill({
            color: status ? "rgba(0, 255, 0, 0.15)" : "rgba(255, 0, 0, 0.15)",
          }),
        }),
      }),
      new Style({
        image: new CircleStyle({
          radius: offsetRadius,
          fill: new Fill({ color: status ? "#3cff00ff" : "#ff0000ff" }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
        // text: new Text({
        //   text: (featureIndex + 1).toString(),
        //   fill: new Fill({ color: "#ffffff" }),
        //   font: "bold 10px Arial",
        // }),
      }),
    ];
    return styles;
  };

  const getClusterStyle = (size) => {
    const bucket = size >= 50 ? "lg" : size >= 10 ? "md" : "sm";
    const key = `${bucket}-${size}`;
    if (!clusterStyleCacheRef.current[key]) {
      const radius = Math.max(14, Math.min(30, 10 + Math.log(size + 1) * 6));
      const color =
        bucket === "lg"
          ? "rgba(244,67,54,0.95)" // red
          : bucket === "md"
            ? "rgba(255,193,7,0.95)" // amber
            : "rgba(76,175,80,0.95)"; // green
      const fontSize = bucket === "lg" ? 14 : bucket === "md" ? 12 : 11;

      const outer = new Style({
        image: new CircleStyle({
          radius: radius + 3,
          fill: new Fill({ color: "rgba(255,255,255,0.95)" }),
        }),
      });

      const inner = new Style({
        image: new CircleStyle({
          radius,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: "#ffffff", width: 2 }),
        }),
        text: new Text({
          text: String(size),
          fill: new Fill({ color: "#ffffff" }),
          stroke: new Stroke({ color: "rgba(0,0,0,0.35)", width: 3 }),
          font: `bold ${fontSize}px Roboto, sans-serif`,
        }),
      });

      clusterStyleCacheRef.current[key] = [outer, inner];
    }
    return clusterStyleCacheRef.current[key];
  };

  const formatLength = (line) => {
    const length = getLength(line, { projection: "EPSG:3857" });
    return length > 1000
      ? Math.round((length / 1000) * 100) / 100 + " км"
      : Math.round(length * 100) / 100 + " м";
  };

  const handleBaseLayerToggle = (layer, enabled, group) => {
    const map = mapObjRef.current;
    if (!map) {
      console.error("Map not available");
      return;
    }

    if (
      !baseLayerMap.current ||
      typeof baseLayerMap.current.has !== "function"
    ) {
      baseLayerMap.current = new Map();
    }

    const layerKey = `baselayer_${layer.id}`;

    if (enabled) {
      // Хэрэв backend‑ээс layer.desc ирсэн (жишээ нь gnssa, gnssb)
      // бол WMS биш, өмнө нь үүсгэсэн WMTS давхаргыг ON/OFF болгоно.
      if (layer.layer) {
        const wmtsKey = `point:${layer.layer}`;
        const wmtsLayer = systemLayersByName[wmtsKey];
        if (wmtsLayer) {
          const mapLayers = map.getLayers().getArray();
          if (!mapLayers.includes(wmtsLayer)) {
            map.addLayer(wmtsLayer);
          }
          wmtsLayer.setVisible(true);
        }
        return;
      }

      if (!baseLayerMap.current.has(layerKey)) {
        let baseUrl, layerName;

        if (layer.url && layer.url.includes("?")) {
          try {
            const urlObj = new URL(layer.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
            layerName =
              urlObj.searchParams.get("layers") ||
              urlObj.searchParams.get("LAYERS");
          } catch (e) {
            return;
          }
        } else if (group.url) {
          try {
            const urlObj = new URL(group.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
            layerName =
              urlObj.searchParams.get("layers") ||
              urlObj.searchParams.get("LAYERS");
          } catch (e) {
            return;
          }
        } else {
          return;
        }

        if (!layerName) {
          layerName = layer.layer_name || layer.name;
        }

        if (!layerName) {
          console.error("No layer name found:", { layer, group });
          return;
        }

        const params = buildWmsParams({
          LAYERS: layerName,
          TILED: true,
          ...(layer.cql_filter ? { CQL_FILTER: layer.cql_filter } : {}),
        });

        const source = new TileWMS({
          url: baseUrl,
          params,
          serverType: "geoserver",
          crossOrigin: "anonymous",
        });

        const wmsLayer = new TileLayer({
          source,
          opacity: layer.opacity || 0.8,
          visible: true,
          zIndex: 200 + (Number(layer.id) || 0),
        });

        source.on("tileloaderror", (event) =>
          console.error("Tile load error for", layer.name, event),
        );

        baseLayerMap.current.set(layerKey, wmsLayer);
        map.addLayer(wmsLayer);

        setTimeout(() => {
          wmsLayer.getSource().refresh();
          map.render();
        }, 100);
      } else {
        const existingLayer = baseLayerMap.current.get(layerKey);
        if (existingLayer) {
          existingLayer.setVisible(true);
        }
      }
    } else {
      const layer_obj = baseLayerMap.current.get(layerKey);
      if (layer_obj) {
        layer_obj.setVisible(false);
      }
    }
  };

  const handleBaseLayerOrderChange = (newOrder) => {
    if (!mapObjRef.current) return;

    const baseZIndex = 200;

    newOrder.forEach((group, groupIndex) => {
      if (group.children && group.children.length > 0) {
        group.children.forEach((layer, layerIndex) => {
          const layerKey = `baselayer_${layer.id}`;
          const mapLayer = baseLayerMap.current?.get(layerKey);
          if (mapLayer) {
            const zIndex = baseZIndex + groupIndex * 100 + layerIndex;
            mapLayer.setZIndex(zIndex);
          }
        });
      } else {
        const layerKey = `baselayer_${group.id}`;
        const mapLayer = baseLayerMap.current?.get(layerKey);
        if (mapLayer) {
          const zIndex = baseZIndex + groupIndex * 100;
          mapLayer.setZIndex(zIndex);
        }
      }
    });

    mapObjRef.current.render();
  };

  const handleBaseLayerOpacityChange = (layer, group, opacity) => {
    if (!mapObjRef.current) return;

    const layerKey = `baselayer_${layer.id}`;
    const mapLayer = baseLayerMap.current?.get(layerKey);

    if (mapLayer) {
      mapLayer.setOpacity(opacity);
      mapObjRef.current.render();
    } else {
      console.warn(`Layer not found in map: ${layer.name}`);
    }
  };

  const handleBaseMapOpacityChange = (basemapKey, opacity) => {
    if (!mapObjRef.current) return;

    setBaseMapOpacity((prev) => ({
      ...prev,
      [basemapKey]: opacity,
    }));

    if (baseLayerRef.current && baseMap === basemapKey) {
      baseLayerRef.current.setOpacity(opacity);
      mapObjRef.current.render();
    }
  };

  const handleInactiveWmsToggle = (enabled) => {
    const map = mapObjRef.current;
    if (!map) return;

    if (enabled) {
      if (!inactiveWmsLayerRef.current) {
        inactiveWmsLayerRef.current = new TileLayer(inActiveWMS);
        inactiveWmsLayerRef.current.setZIndex(1500);
      }
      map.addLayer(inactiveWmsLayerRef.current);
    } else {
      if (inactiveWmsLayerRef.current) {
        map.removeLayer(inactiveWmsLayerRef.current);
      }
    }
  };

  const handleInactiveWmsOpacityChange = (opacity) => {
    if (inactiveWmsLayerRef.current) {
      inactiveWmsLayerRef.current.setOpacity(opacity);
      if (mapObjRef.current) {
        mapObjRef.current.render();
      }
    }
  };

  // Газрын зургийг тухайн байршил руу нисгэх (нэгж/нэрлэвэр/солбицол)
  const handleFlyTo = useCallback((target) => {
    const map = mapObjRef.current;
    if (!map || !target) return;
    if (target.bbox && target.bbox.length === 4) {
      const ext = transformExtent(target.bbox, "EPSG:4326", "EPSG:3857");
      map.getView().fit(ext, {
        duration: 800,
        maxZoom: 15,
        padding: [60, 60, 60, 60],
      });
    } else if (target.center && target.center.length === 2) {
      map.getView().animate({
        center: fromLonLat(target.center),
        zoom: target.zoom || 13,
        duration: 800,
      });
    }
  }, []);

  // Толгойн хайлт — нэрээр geoname_view‑д CQL тавьж газрын зурагт харуулна.
  // Илэрц 1‑с их бол зүүн талын дэлгэрэнгүй филтрийг нээж, "Нэр"‑д утгыг сетлэнэ.
  const handleHeaderSearch = useCallback(async (textVal) => {
    handleGeoserverFilterChange("geoname_search", false, {
      id: "geoname_search",
    });
    if (!textVal) return;
    const esc = String(textVal).replace(/'/g, "''");
    handleGeoserverFilterChange("geoname_search", true, {
      id: "geoname_search",
      name: "Хайлт",
      layer: "geoname:geoname_view",
      cql_filter: `name ILIKE '%${esc}%'`,
      groupUrl: GEONAME_WMS_URL,
    });
    try {
      const q = new URLSearchParams({ name: textVal, page_size: 1 }).toString();
      const res = await axiosInstance.get(endpoints.geoname.list(q));
      if ((res?.data?.count ?? 0) > 1) {
        setForceGeoserverOpen(true);
        headerSearchNonce.current += 1;
        setGeonameSearchTerm({ term: textVal, n: headerSearchNonce.current });
      }
    } catch (e) {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGeoserverFilterChange = (filterId, enabled, filterData) => {
    const map = mapObjRef.current;
    if (!map) return;

    const isStaticLayer = filterData?.isFromStaticLayer || false;

    if (
      !geoserverLayerMap.current ||
      typeof geoserverLayerMap.current.has !== "function"
    ) {
      geoserverLayerMap.current = new Map();
    }

    setEnabledGeoserverFilters((prev) => {
      const normalized = new Set(Array.from(prev, (v) => String(v)));
      const key = String(filterId);
      if (enabled) {
        normalized.add(key);
      } else {
        normalized.delete(key);
      }
      return normalized;
    });

    if (enabled) {
      const layerKey = `geoserver_${filterId}`;

      if (!geoserverLayerMap.current.has(layerKey)) {
        // Нэрийн ангилал — ГАНЦ geoname_view, БҮХ zoom‑д default style geoname_types
        // (бүрэн, style editor‑оор шинэчлэгддэг). z<11/z≥11 гэж 2 давхаргад хуваасан
        // нь зөвхөн техникийн (ratio) шалтгаантай; хоёул ижил style ашиглана.
        // CQL‑ээр төрөл (+ сонгосон нэгж) шүүнэ.
        // ЧУХАЛ: geoname_view‑ийн GWC давхаргад parameterFilters ХООСОН тул
        // gwc/service/wms нь CQL_FILTER‑ийг ҮЛ ТООМСОРЛОН кэшлэсэн (шүүлтгүй)
        // тайлыг буцаадаг → ямар ч ангилал сонгосон БҮХ нэр харагдана. Иймд
        // амьд /geoname/wms‑ээр дуудна: GeoServer‑ийн direct WMS integration
        // CQL байвал кэшийг алгасаж, зөв шүүсэн тайл рендерлэнэ.
        // Тодруулалтын сан — recount_view‑г ӨӨРИЙН default style (geoname төрлийн
        // тэмдэг)‑ээр рендерлэнэ. CQL (id IN ...)‑ээр сонгосон тодруулалтыг л
        // харуулна. GWC/WMTS нь CQL‑ийг үл тоомсорлодог тул амьд ImageWMS ашиглана.
        if (filterData.recountView) {
          const gsBase = process.env.NEXT_PUBLIC_GEOSERVER_URL;
          const wmsParams = buildWmsParams({
            LAYERS: "geoname:recount_view",
            // geoname‑ийн ТӨРЛИЙН танигдах тэмдэг (type SLD)‑ээр зурна — recount_view нь
            // geoname_view‑тэй ижил баганатай (type_id/type_l1/l2/name) тул тохирно.
            // geoname_types (geoname_types_full БИШ) — учир нь бүх төрлийн жинхэнэ
            // icon (уул г.м.) энд бий; "_full" нь синкгүй тул icon дутуу (ногоон дугуй).
            STYLES: "geoname_types",
            ...(filterData.cql_filter
              ? { CQL_FILTER: filterData.cql_filter }
              : {}),
          });
          const rcLayer = new ImageLayer({
            source: new ImageWMS({
              url: `${gsBase}/geoname/wms`,
              params: wmsParams, // STYLES="" → recount_view default (type) style
              serverType: "geoserver",
              crossOrigin: "anonymous",
              ratio: 1,
            }),
            opacity: 1,
            visible: true,
            zIndex: 600 + (Number(filterId) || 0), // нэрсийн дээр тод харагдана
          });
          rcLayer.set("filterId", filterId);
          rcLayer.set("filterData", filterData);
          geoserverLayerMap.current.set(layerKey, rcLayer);
          map.addLayer(rcLayer);
          return;
        }
        if (filterData.nameCached) {
          const gsBase = process.env.NEXT_PUBLIC_GEOSERVER_URL;
          // UNTILED ImageWMS — харагдах хэсгийг НЭГ зураг болгон рендерлэнэ.
          // TileWMS (256×256 тайл) үед тайлын зааг дээрх label хоёр тайл дээр
          // ДАВХАР зурагдана; ImageWMS нэг зурагтай тул давхцахгүй.
          const wmsParams = buildWmsParams({
            LAYERS: "geoname:geoname_view",
            ...(filterData.cql_filter
              ? { CQL_FILTER: filterData.cql_filter }
              : {}),
          });
          // zoom <11 — ерөнхийлсөн default style
          const cachedLayer = new ImageLayer({
            source: new ImageWMS({
              url: `${gsBase}/geoname/wms`,
              params: wmsParams,
              serverType: "geoserver",
              crossOrigin: "anonymous",
              ratio: 1,
            }),
            opacity: 0.9,
            visible: true,
            maxZoom: 11, // z<11
            zIndex: 300 + (Number(filterId) || 0),
          });
          cachedLayer.set("filterId", filterId);
          geoserverLayerMap.current.set(`${layerKey}__wmts`, cachedLayer);
          map.addLayer(cachedLayer);
          // zoom ≥11 — ижил geoname_types style (бүх төрлийн нэр).
          // ЧУХАЛ: өмнө "geoname_types_full" ашигладаг байсан нь ХУУЧИРСАН (12 төрөл
          // дутуу: Гол г.м.) + backend‑д синк хийгддэггүй тул z>11‑д тэдгээр нэр алга
          // болдог байсан. geoname_types нь бүрэн бөгөөд style editor‑оор шинэчлэгддэг.
          const liveLayer = new ImageLayer({
            source: new ImageWMS({
              url: `${gsBase}/geoname/wms`,
              params: wmsParams,
              serverType: "geoserver",
              crossOrigin: "anonymous",
              ratio: 1,
            }),
            opacity: 0.9,
            visible: true,
            minZoom: 11, // z≥11
            zIndex: 100 + (Number(filterId) || 0),
          });
          liveLayer.set("filterId", filterId);
          liveLayer.set("filterData", filterData);
          geoserverLayerMap.current.set(layerKey, liveLayer);
          map.addLayer(liveLayer);
          return;
        }
        // Per‑type view (GeoStyler style‑тай) — zoom ≤14 WMTS cache, >14 амьд WMS.
        // CQL/STYLES хэрэггүй (view нь өөрөө шүүсэн, default style = засагдсан SLD).
        if (filterData.viewName) {
          const wmtsLayer = makeViewWmtsLayer({
            workspace: "geoname",
            view: filterData.viewName,
            maxZoom: 14,
            zIndex: 300 + (Number(filterId) || 0),
          });
          wmtsLayer.set("filterId", filterId);
          geoserverLayerMap.current.set(`${layerKey}__wmts`, wmtsLayer);
          map.addLayer(wmtsLayer);

          const wmsSrc = new TileWMS({
            url: filterData.groupUrl.split("?")[0],
            params: buildWmsParams({
              LAYERS: `geoname:${filterData.viewName}`,
              TILED: true,
            }),
            serverType: "geoserver",
            crossOrigin: "anonymous",
          });
          const wmsHi = new TileLayer({
            source: wmsSrc,
            opacity: 0.9,
            visible: true,
            minZoom: 14, // zoom >14 дээр л (WMTS‑ийн дээр)
            zIndex: 100 + (Number(filterId) || 0),
          });
          wmsHi.set("filterId", filterId);
          wmsHi.set("filterData", filterData);
          geoserverLayerMap.current.set(layerKey, wmsHi);
          map.addLayer(wmsHi);
          return;
        }
        const baseUrl = filterData.groupUrl.split("?")[0];
        const urlObj = new URL(filterData.groupUrl);
        const layerNameHint =
          filterData.layer ||
          urlObj.searchParams.get("layers") ||
          urlObj.searchParams.get("LAYERS") ||
          urlObj.searchParams.get("typename") ||
          urlObj.searchParams.get("TYPENAME") ||
          "point:point";

        // Хэрвээ энэ давхаргад WMTS давхарга үүсгэсэн бол түүнийг ON/OFF болгоно.
        if (filterData.layer) {
          const wmtsKey = filterData.layer.includes(":")
            ? filterData.layer
            : `point:${filterData.layer}`;
          const wmtsLayer = systemLayersByName[wmtsKey];
          if (wmtsLayer) {
            const mapLayers = map.getLayers().getArray();
            if (!mapLayers.includes(wmtsLayer)) {
              map.addLayer(wmtsLayer);
            }
            wmtsLayer.setVisible(true);

            // GNSS төрлийн идэвхтэй давхаргыг бүртгэнэ (WMS‑ийн бүрэн нэрээр)
            if (filterData.layer.toLowerCase().includes("gnss")) {
              const fullName = filterData.layer.includes(":")
                ? filterData.layer
                : `point:${filterData.layer}`;
              activeGnssLayersRef.current.add(fullName);
            }
          }
        }

        const layerName = layerNameHint;

        const params = buildWmsParams({
          LAYERS: layerName,
          TILED: true,
          ...(filterData && filterData.cql_filter
            ? { CQL_FILTER: filterData.cql_filter }
            : {}),
          // Навчид per‑type view (GeoStyler) style байвал түүгээр рендерлэнэ.
          ...(filterData && filterData.styles
            ? { STYLES: filterData.styles }
            : {}),
        });

        // Debug: WMS URL + CQL_FILTER (geoserver filters)
        // eslint-disable-next-line no-console
        console.log("[WMS DEBUG] creating geoserver layer", {
          baseUrl,
          params,
          from: "handleGeoserverFilterChange",
        });

        const source = new TileWMS({
          url: baseUrl,
          params,
          serverType: "geoserver",
          crossOrigin: "anonymous",
          // GWC кэштэй (gwc/service/wms) давхаргад HiDPI 282px tile нь 256
          // gridset‑тэй таарахгүй (400) — GWC зам дээр hidpi‑г унтраана.
          hidpi: !String(baseUrl).includes("/gwc/"),
        });

        const wmsLayer = new TileLayer({
          source,
          opacity: 0.9,
          visible: true,
          zIndex: 100 + (Number(filterId) || 0),
        });

        wmsLayer.set("isStaticLayer", isStaticLayer);
        wmsLayer.set("filterId", filterId);
        wmsLayer.set("filterData", filterData);
        // GNSS WMS давхарга гэдгийг заасан flag болон name
        if (
          filterData.layer &&
          filterData.layer.toLowerCase().includes("gnss")
        ) {
          const fullName = filterData.layer.includes(":")
            ? filterData.layer
            : `point:${filterData.layer}`;
          wmsLayer.set("name", fullName);
          wmsLayer.set("isGnssWms", true);
        }

        geoserverLayerMap.current.set(layerKey, wmsLayer);
        map.addLayer(wmsLayer);
      }
    } else {
      const layerKey = `geoserver_${filterId}`;
      const layer = geoserverLayerMap.current.get(layerKey);

      // WMS‑ээр үүсгэсэн давхарга байвал map‑аас авна.
      if (layer) {
        map.removeLayer(layer);
        geoserverLayerMap.current.delete(layerKey);
      }
      // Per‑type view‑ийн WMTS давхарга байвал бас авна.
      const wmtsLayer2 = geoserverLayerMap.current.get(`${layerKey}__wmts`);
      if (wmtsLayer2) {
        map.removeLayer(wmtsLayer2);
        geoserverLayerMap.current.delete(`${layerKey}__wmts`);
      }

      // Энэ filter‑т таарах WMTS давхарга байвал харагдах байдлыг OFF болгоно.
      if (filterData?.layer) {
        const wmtsKey = filterData.layer.includes(":")
          ? filterData.layer
          : `point:${filterData.layer}`;
        const wmtsLayer = systemLayersByName[wmtsKey];
        if (wmtsLayer) {
          wmtsLayer.setVisible(false);
        }

        // GNSS төрлийн идэвхтэй давхаргаас хасна
        if (filterData.layer.toLowerCase().includes("gnss")) {
          const fullName = filterData.layer.includes(":")
            ? filterData.layer
            : `point:${filterData.layer}`;
          activeGnssLayersRef.current.delete(fullName);
        }
      }
    }
  };

  const handleGeoserverOrderChange = (newOrder) => {
    setGeoserverLayerOrder(newOrder);
  };

  useEffect(() => {
    enabledGeoserverFiltersRef.current = new Set(
      Array.from(enabledGeoserverFilters, (v) => String(v)),
    );
  }, [enabledGeoserverFilters]);

  useEffect(() => {
    if (!mapObjRef.current || geoserverLayerOrder.length === 0) {
      return;
    }

    const baseZIndex = 100;
    geoserverLayerOrder.forEach((group, index) => {
      const zIndex = baseZIndex + index;

      const leaves = [];
      const collectLeaves = (nodes) => {
        if (!nodes) return;
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            collectLeaves(node.children);
          } else {
            leaves.push(node);
          }
        });
      };
      collectLeaves(group.children);

      leaves.forEach((leaf) => {
        const layerKey = `geoserver_${leaf.id}`;
        if (geoserverLayerMap.current.has(layerKey)) {
          const layer = geoserverLayerMap.current.get(layerKey);
          if (layer.getZIndex() !== zIndex) {
            layer.setZIndex(zIndex);
          }
        }
      });
    });
  }, [geoserverLayerOrder]);

  // === Init map once ===
  useEffect(() => {
    // Prevent multiple map initialization
    if (mapObjRef.current) {
      return;
    }

    const cleanup = initMap({
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
      buildWmsParams,
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
      activeGnssLayersRef,
      lastClickCoordinateRef,
    });

    // "Шийдвэрийн сан" overlay‑ыг үүсгэнэ (эхэндээ унтраалттай)
    if (mapObjRef.current) {
      legalOverlayRef.current = createLegalOverlay(mapObjRef.current, {
        onNational: setLegalNational,
        onSelectUnit: (props) => {
          // Доод attribute хүснэгтэд «Шийдвэр» таб болгож нээнэ
          openLegalTabRef.current?.({
            unitId: props.id,
            name: props.name,
            level: props.level,
            count: props.count,
          });
        },
      });
    }

    if (mapObjRef.current) setMapReady(true);

    return () => {
      if (cleanup && typeof cleanup === "function") {
        cleanup();
      }
      if (legalOverlayRef.current) {
        legalOverlayRef.current.destroy();
        legalOverlayRef.current = null;
      }
      if (mapObjRef.current) {
        mapObjRef.current.setTarget(null);
        mapObjRef.current = null;
      }
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // "Шийдвэрийн сан" overlay‑г асаах/унтраах
  useEffect(() => {
    legalOverlayRef.current?.setEnabled(overlayLegal);
  }, [overlayLegal]);

  // URL ?overlay=legal → автоматаар асаах (legal хуудасны товчноос ирэхэд)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ov = new URLSearchParams(window.location.search).get("overlay");
    if (ov === "legal") setOverlayLegal(true);
  }, []);

  // Badge дарсан нэгжийн шийдвэрүүд — хайлт + хуудаслалттай (search үед debounce)
  useEffect(() => {
    if (!legalDocsUnit) return undefined;
    const run = async () => {
      setLegalDocsLoading(true);
      try {
        // Эх сурвалж: газрын зургийн badge ({id}) эсвэл модны зангилаа
        // ({unitId, typeId, noUnit})
        const unitId = legalDocsUnit.unitId ?? legalDocsUnit.id;
        const qs = new URLSearchParams({
          page: String(legalTable.page + 1),
          page_size: String(legalTable.rowsPerPage),
          ordering: `${legalTable.order === "desc" ? "-" : ""}${legalTable.orderBy}`,
        });
        if (legalDocsUnit.noUnit) qs.set("no_unit", "1");
        else if (unitId != null) qs.set("map_unit", String(unitId));
        if (legalDocsUnit.typeId) qs.set("type", String(legalDocsUnit.typeId));
        if (legalDocsSearch.trim()) qs.set("search", legalDocsSearch.trim());
        const res = await axiosInstance.get(
          endpoints.legal.list(qs.toString()),
        );
        setLegalDocs(res?.data?.results || []);
        setLegalDocsCount(res?.data?.count || 0);
      } catch (e) {
        setLegalDocs([]);
        setLegalDocsCount(0);
      } finally {
        setLegalDocsLoading(false);
      }
    };
    const t = setTimeout(run, legalDocsSearch ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    legalDocsUnit,
    legalDocsSearch,
    legalTable.page,
    legalTable.rowsPerPage,
    legalTable.order,
    legalTable.orderBy,
    legalDocsRefresh,
  ]);

  // Шийдвэр устгах (доод жагсаалтаас)
  const handleLegalDelete = useCallback(async () => {
    if (!legalDelRow) return;
    try {
      await axiosInstance.delete(endpoints.legal.delete(legalDelRow.id));
      legalSnack("Шийдвэр устгагдлаа");
      setLegalDelRow(null);
      refetchLegalDocs();
    } catch (err) {
      legalSnack(err?.response?.data?.detail || "Устгах үед алдаа гарлаа", {
        variant: "warning",
      });
    }
  }, [legalDelRow, legalSnack, refetchLegalDocs]);

  // Дэлгэрэнгүй хайлтаас илэрц ирэхэд ({params, count}) — хуудаслалттай хүснэгт
  const handleNameSearchResults = useCallback((meta) => {
    if (!meta || !meta.count) {
      setSearchQuery(null);
      setSearchPage(0);
      setNameResults([]);
      setFeatureTabs((prev) => prev.filter((t) => t.key !== "search"));
      return;
    }
    setSearchQuery(meta);
    setSearchPage(0);
    // Доод attribute хүснэгтэд ТАБ болгож харуулна
    setActiveTabKey("search");
    setFeatureTabs((prev) => {
      const rest = prev.filter((t) => t.key !== "search");
      return [
        ...rest,
        { key: "search", kind: "search", label: "Хайлтын илэрц" },
      ];
    });
  }, []);

  // Идэвхтэй хайлтын одоогийн хуудсыг серверээс татна
  useEffect(() => {
    if (!searchQuery) return undefined;
    let active = true;
    setNameResultsLoading(true);
    const run = async () => {
      try {
        const qp = {
          ...searchQuery.params,
          page: searchPage + 1,
          page_size: searchPageSize,
          ordering: `${resOrder.desc ? "-" : ""}${resOrder.by}`,
        };
        if (resTerm.trim()) qp.search = resTerm.trim();
        // Хамгийн гүн сонгосон ангилал (backend нь удмыг нь хамруулна)
        const deepType = [...resType].reverse().find(Boolean);
        if (deepType) qp.type = deepType;
        // Сум сонгосон бол сумаар, эс бөгөөс аймгаар (удам багтана)
        if (resSum) qp.unit_tree = resSum;
        else if (resAimag) qp.unit_tree = resAimag;
        if (resGeom) qp.geom_type = resGeom;
        const q = new URLSearchParams(qp).toString();
        const res = await axiosInstance.get(endpoints.geoname.list(q));
        if (active) {
          setNameResults(res?.data?.results || []);
          setSearchCount(res?.data?.count ?? searchQuery.count ?? 0);
        }
      } catch (e) {
        if (active) setNameResults([]);
      } finally {
        if (active) setNameResultsLoading(false);
      }
    };
    // Бичиж байхад бүр товчлуур бүрд хүсэлт явуулахгүй (debounce)
    const t = setTimeout(run, resTerm ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    searchPage,
    searchPageSize,
    resTerm,
    resType,
    resAimag,
    resSum,
    resGeom,
    resOrder,
  ]);

  // Илэрцийн хүснэгтийн баруун‑доод булангаас чирж хэмжээ өөрчлөх

  // === Switch basemap when baseMap or wmsGroup changes ===
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

    const nextBase = baseMapLayers[baseMap] || baseMapLayers.CRV;
    const layers = map.getLayers();

    if (baseLayerRef.current) {
      const idx = layers.getArray().indexOf(baseLayerRef.current);
      if (idx >= 0) {
        layers.setAt(idx, nextBase);
      } else {
        layers.insertAt(0, nextBase);
      }
    } else {
      layers.insertAt(0, nextBase);
    }

    baseLayerRef.current = nextBase;
  }, [baseMap, baseMapLayers]);

  // === basemap opacity ===
  useEffect(() => {
    if (baseLayerRef.current && baseMapOpacity[baseMap] !== undefined) {
      baseLayerRef.current.setOpacity(baseMapOpacity[baseMap]);
      if (mapObjRef.current) {
        mapObjRef.current.render();
      }
    }
  }, [baseMap, baseMapOpacity]);

  // === Admin zooming + CQL filter ===
  useEffect(() => {
    if (filters.soum && mapObjRef.current) {
      const soum = soums.find((s) => String(s.id) === String(filters.soum));

      if (soum && soum.unit) {
        setShowAdminBoundaries(true);

        if (adminSourceRef.current) {
          adminSourceRef.current.updateParams(
            buildAdminWmsParams({
              CQL_FILTER: `unit='${soum.unit}'`,
            }),
          );
        }
      }
    } else if (filters.aimag && mapObjRef.current) {
      const aimag = aimags.find((a) => String(a.id) === String(filters.aimag));

      if (aimag && aimag.unit) {
        setShowAdminBoundaries(true);

        if (adminSourceRef.current) {
          adminSourceRef.current.updateParams(
            buildAdminWmsParams({
              CQL_FILTER: `unit='${aimag.unit}'`,
            }),
          );
        }
      }
    } else {
      setShowAdminBoundaries(false);
      if (adminSourceRef.current) {
        adminSourceRef.current.updateParams(
          buildAdminWmsParams({
            CQL_FILTER: "parent_id IS NULL",
          }),
        );
      }
    }
  }, [filters.aimag, filters.soum, aimags, soums]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (map) {
      const layers = map.getLayers().getArray();
      const adminLayer = layers.find(
        (layer) =>
          layer.getSource && layer.getSource() === adminSourceRef.current,
      );
      if (adminLayer) {
        adminLayer.setVisible(showAdminBoundaries);
      }
    }
  }, [showAdminBoundaries]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (mapRef.current && mapRef.current.requestFullscreen)
        mapRef.current.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleLayerControlOpen = (event) => {
    setLayerControlAnchor(event.currentTarget);
    setLayerControlOpen(true);
  };

  const handleLayerControlClose = () => {
    setLayerControlOpen(false);
    setLayerControlAnchor(null);
  };

  const handleFeatureSelect = (selectedFeature) => {
    setSelectedName(selectedFeature);
    setFeatureSelector({ show: false, features: [], position: { x: 0, y: 0 } });

    // Set anchor position for the sidebar
    const mapElement = mapObjRef.current?.getTargetElement();
    if (mapElement) {
      const rect = mapElement.getBoundingClientRect();
      setAnchorPosition({
        top: rect.top + featureSelector.position.y,
        left: rect.left + featureSelector.position.x + 10, // Add 10px offset
      });
    }

    setSidebarOpen(true);
  };

  const handleFeatureSelectorClose = () => {
    setFeatureSelector({ show: false, features: [], position: { x: 0, y: 0 } });
  };

  const toggleMeasure = () => {
    const map = mapObjRef.current;
    if (!map) return;

    if (isMeasuring) {
      if (drawInteractionRef.current) {
        map.removeInteraction(drawInteractionRef.current);
        drawInteractionRef.current = null;
      }
      if (snapInteractionRef.current) {
        map.removeInteraction(snapInteractionRef.current);
        snapInteractionRef.current = null;
      }
      setIsMeasuring(false);
      setMeasureResult("");
    } else {
      measureSourceRef.current.clear();
      setMeasureResult("");

      const draw = new Draw({
        source: measureSourceRef.current,
        type: "LineString",
        style: measureStyle,
      });

      draw.on("drawstart", () => {
        measureSourceRef.current.clear();
        setMeasureResult("");
      });

      draw.on("drawend", (evt) => {
        const geometry = evt.feature.getGeometry();
        const length = formatLength(geometry);
        setMeasureResult(length);
      });

      const snap = new Snap({
        source: vectorSourceRef.current,
        pixelTolerance: 15,
        vertex: true,
        edge: false,
      });

      map.addInteraction(draw);
      map.addInteraction(snap);
      drawInteractionRef.current = draw;
      snapInteractionRef.current = snap;
      setIsMeasuring(true);
    }
  };

  const clearMeasurements = () => {
    if (measureSourceRef.current) measureSourceRef.current.clear();
    setMeasureResult("");
    toggleMeasure();
  };

  const handleStartDrawing = useCallback(
    (callback) => {
      const map = mapObjRef.current;
      const source = radiusCircleSourceRef.current;
      if (!map || !source) return;

      source.clear();

      const geometryFunction = (coordinates, geometry, projection) => {
        if (!geometry) {
          geometry = new GeometryCollection([
            new Polygon([]),
            new Point(coordinates[0]),
          ]);
        }
        const geometries = geometry.getGeometries();
        const center = transform(coordinates[0], projection, "EPSG:4326");
        const last = transform(coordinates[1], projection, "EPSG:4326");
        const radius = getDistance(center, last);
        const circle = circular(center, radius, 128);
        circle.transform("EPSG:4326", projection);
        geometries[0].setCoordinates(circle.getCoordinates());
        geometry.setGeometries(geometries);
        return geometry;
      };

      const drawInteraction = new Draw({
        source: source,
        type: "Circle",
        geometryFunction: geometryFunction,
      });

      drawInteraction.on("drawend", (event) => {
        const feature = event.feature;
        const geometry = feature.getGeometry();

        if (geometry.getType() === "GeometryCollection") {
          const geometries = geometry.getGeometries();
          const polygon = geometries[0];
          const centerPoint = geometries[1];

          const centerCoords = centerPoint.getCoordinates();
          const centerLonLat = transform(
            centerCoords,
            "EPSG:3857",
            "EPSG:4326",
          );

          const polygonCoords = polygon.getCoordinates()[0];
          const firstPoint = transform(
            polygonCoords[0],
            "EPSG:3857",
            "EPSG:4326",
          );
          const radius = getDistance(centerLonLat, firstPoint);

          feature.setStyle(geodesicStyle);

          if (callback) {
            callback(centerLonLat, Math.round(radius));
          }
        }

        map.removeInteraction(drawInteraction);
      });

      const keyHandler = (event) => {
        if (event.key === "Escape") {
          map.removeInteraction(drawInteraction);
          source.clear();
          document.removeEventListener("keydown", keyHandler);
          if (callback) {
            callback(null, null);
          }
        }
      };

      map.addInteraction(drawInteraction);
      document.addEventListener("keydown", keyHandler);
    },
    [geodesicStyle],
  );

  // Ерөнхий төрлийн (Point/LineString/Polygon) геометр зурж, GeoJSON (4326)
  // буцаана. popup (NameDetailCard) нь requestMapDraw‑ээр дуудна. ESC → null.
  const startTypedDraw = useCallback((type) => {
    return new Promise((resolve) => {
      const map = mapObjRef.current;
      const source = radiusCircleSourceRef.current;
      if (!map || !source) {
        resolve(null);
        return;
      }
      source.clear();
      const draw = new Draw({ source, type: type || "Point" });
      // Зурж байх үед газрын зургийн click (GetFeatureInfo / recount popup)
      // ажиллахгүй байх ёстой — map-init нь drawInteractionRef‑ээр шалгадаг.
      drawInteractionRef.current = draw;
      const cleanup = () => {
        map.removeInteraction(draw);
        // Зурж дуусгасан (давхар) клик нь дараа нь map click болж дуудагдах тул
        // хамгаалалтыг нэг агшин хойшлуулж арилгана.
        setTimeout(() => {
          if (drawInteractionRef.current === draw)
            drawInteractionRef.current = null;
        }, 350);
        document.removeEventListener("keydown", keyHandler);
      };
      const keyHandler = (e) => {
        if (e.key === "Escape") {
          source.clear();
          cleanup();
          resolve(null);
        }
      };
      draw.on("drawend", (event) => {
        const geom = event.feature
          .getGeometry()
          .clone()
          .transform("EPSG:3857", "EPSG:4326");
        const geojson = new GeoJSON().writeGeometryObject(geom);
        cleanup();
        resolve(geojson);
      });
      map.addInteraction(draw);
      document.addEventListener("keydown", keyHandler);
    });
  }, []);

  // Attribute хүснэгтийн toolbar → геометр зуруулаад, түүний ХАЖУУД
  // нэрийн формыг нээнэ. ЗӨВХӨН төслийн газрын зураг дээр ажиллана.
  const openTabNameForm = useCallback(
    async (tab, mode) => {
      const map = mapObjRef.current;
      if (!map || !recountProjectId) return;
      const desc = (tab?.geomDesc || "").trim();
      const drawType =
        desc === "Шугам"
          ? "LineString"
          : desc === "Талбай"
            ? "Polygon"
            : "Point";
      window.dispatchEvent(
        new CustomEvent("map:notice", {
          detail: {
            title: "Зурах:",
            text: `Газрын зураг дээр ${desc || "цэг"} зурна уу (ESC — болих)`,
          },
        }),
      );
      const gj = await startTypedDraw(drawType);
      if (!gj) return;
      // Формыг зурсан геометрийн хажууд байрлуулна
      let flat = gj.coordinates;
      while (Array.isArray(flat[0])) flat = flat[0];
      let top = 120;
      let left = 120;
      try {
        const px = map.getPixelFromCoordinate(fromLonLat(flat));
        const rect = map.getTargetElement().getBoundingClientRect();
        top = Math.min(rect.top + px[1], window.innerHeight - 420);
        left = Math.min(rect.left + px[0] + 16, window.innerWidth - 380);
      } catch (e) {
        /* байрлал тодорхойлж чадсангүй — анхдагчаар */
      }
      setTabNameForm({
        mode,
        type: { id: tab.typeId, name: tab.label, desc: tab.geomDesc },
        geom: gj,
        top: Math.max(top, 60),
        left: Math.max(left, 12),
      });
    },
    [recountProjectId, startTypedDraw],
  );

  // Map2 ↔ popup гүүр — зурах функцийг бүртгэнэ
  useEffect(() => {
    registerMapDraw(startTypedDraw);
    return () => registerMapDraw(null);
  }, [startTypedDraw]);

  // Түр зурсан геометрийг арилгах гүүр (хадгалсны дараа)
  const clearDrawnGeom = useCallback(() => {
    radiusCircleSourceRef.current?.clear();
  }, []);
  useEffect(() => {
    registerClearDraw(clearDrawnGeom);
    return () => registerClearDraw(null);
  }, [clearDrawnGeom]);

  // Байрлал засах (QGIS маягаар) — дамжуулсан GeoJSON геометрийг (EPSG:4326,
  // geoname detail‑ийн `geom`) засах давхаргад оруулж, Modify+Snap‑аар vertex/цэг
  // зөөдөг болгоно. "Хадгалах" (editCommit) → засагдсан GeoJSON (4326),
  // ESC/Болих (editCancel) → null.
  // inputGeom: аль хэдийн client дээр (backend/WFS‑ээс) ачаалагдсан геометр —
  // OL Geometry (map projection 3857) ЭСВЭЛ GeoJSON geometry (EPSG:4326). Дахин
  // татахгүй. Modify+Snap‑аар засаад, "Хадгалах" → GeoJSON (4326), ESC/Болих → null.
  const startEditGeom = useCallback((inputGeom) => {
    return new Promise((resolve) => {
      const map = mapObjRef.current;
      const source = radiusCircleSourceRef.current;
      if (!map || !source || !inputGeom) {
        resolve(null);
        return;
      }
      source.clear();
      let olGeom = null;
      try {
        if (typeof inputGeom.getType === "function") {
          // OL Geometry — газрын зургийн projection (3857)‑д байгаа гэж үзнэ
          olGeom = inputGeom.clone();
        } else {
          // GeoJSON geometry (EPSG:4326) → 3857
          olGeom = new GeoJSON().readGeometry(inputGeom, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });
        }
      } catch (e) {
        resolve(null);
        return;
      }
      const feat = new Feature(olGeom);
      source.addFeature(feat);
      try {
        map.getView().fit(feat.getGeometry().getExtent(), {
          padding: [80, 80, 80, 80],
          maxZoom: 18,
          duration: 300,
        });
      } catch (e) {
        /* fit алдаа үл хайхарна */
      }
      const modify = new Modify({ source });
      const snap = new Snap({ source });
      const cleanup = () => {
        map.removeInteraction(modify);
        map.removeInteraction(snap);
        document.removeEventListener("keydown", keyHandler);
        window.removeEventListener("geoname:editCommit", onCommit);
        window.removeEventListener("geoname:editCancel", onCancel);
        source.clear();
        setGeomEditing(false);
      };
      const onCancel = () => {
        cleanup();
        resolve(null);
      };
      const keyHandler = (e) => {
        if (e.key === "Escape") onCancel();
      };
      const onCommit = () => {
        const geom = feat
          .getGeometry()
          .clone()
          .transform("EPSG:3857", "EPSG:4326");
        const out = new GeoJSON().writeGeometryObject(geom);
        cleanup();
        resolve(out);
      };
      map.addInteraction(modify);
      map.addInteraction(snap);
      document.addEventListener("keydown", keyHandler);
      window.addEventListener("geoname:editCommit", onCommit);
      window.addEventListener("geoname:editCancel", onCancel);
      setGeomEditing(true);
      // Popup‑г шууд нууна — зөвхөн газрын зургийн toolbar‑аар засна (давхардлыг арилгах)
      setSidebarOpen(false);
    });
  }, []);

  useEffect(() => {
    registerMapEditGeom(startEditGeom);
    return () => registerMapEditGeom(null);
  }, [startEditGeom]);

  // Харагдах хүрээ (EPSG:4326) авах гүүр — батлагдсан нэрийг сумын нутгаар хайхад
  useEffect(() => {
    registerMapExtent(() => {
      const map = mapObjRef.current;
      const size = map?.getSize();
      if (!map || !size) return null;
      const view = map.getView();
      return transformExtent(
        view.calculateExtent(size),
        view.getProjection(),
        "EPSG:4326",
      );
    });
    return () => registerMapExtent(null);
  }, []);

  // Удирдлага панелийн ИДЭВХТЭЙ давхарга (level3 ангилал) — орон зайн сонголт
  // ЗӨВХӨН энэ давхаргад хамаарна.
  const [activeRecountLayer, setActiveRecountLayer] = useState(null);
  useEffect(() => {
    const h = (e) =>
      setActiveRecountLayer(
        e?.detail?.id ? { id: e.detail.id, name: e.detail.name } : null,
      );
    window.addEventListener("recount:active", h);
    return () => window.removeEventListener("recount:active", h);
  }, []);

  // QGIS маягийн мэдэгдлийн мөр (жишээ нь идэвхтэй давхарга сонгоогүй үед)
  const [mapNotice, setMapNotice] = useState(null);
  useEffect(() => {
    const h = (e) => {
      setMapNotice(e?.detail || null);
      window.clearTimeout(h._t);
      h._t = window.setTimeout(() => setMapNotice(null), 10000);
    };
    window.addEventListener("map:notice", h);
    return () => {
      window.clearTimeout(h._t);
      window.removeEventListener("map:notice", h);
    };
  }, []);

  // Ангиллын зурагдах дарааллыг Удирдлага панелаас хүлээж авна
  useEffect(() => {
    const h = (e) => {
      const order = e?.detail?.order || [];
      const m = {};
      order.forEach((id, i) => {
        m[id] = order.length - i; // доод талынх нь ӨНДӨР → дээр зурагдана
      });
      recountTypeOrder = m;
      recountLayerRef.current?.changed();
      recountExtraLayersRef.current?.forEach((l) => l?.changed());
    };
    window.addEventListener("recount:order", h);
    return () => window.removeEventListener("recount:order", h);
  }, []);

  // Доод status bar — курсорын солбицол (DMS) + масштаб (96dpi, өргөрөгт тааруулсан)
  useEffect(() => {
    let map = null;
    let view = null;
    let cancelled = false;
    const onMove = (evt) => {
      if (evt.dragging) return;
      const [lon, lat] = toLonLat(evt.coordinate);
      setCursorCoords({ lon, lat });
    };
    const updateScale = () => {
      if (!view) return;
      const res = view.getResolution();
      if (res == null) return;
      const lat = toLonLat(view.getCenter())[1];
      const cosLat = Math.cos((lat * Math.PI) / 180);
      setMapScale(Math.round((res * cosLat * 96) / 0.0254));
    };
    const attach = () => {
      if (cancelled) return;
      map = mapObjRef.current;
      if (!map) {
        setTimeout(attach, 300);
        return;
      }
      view = map.getView();
      map.on("pointermove", onMove);
      view.on("change:resolution", updateScale);
      map.on("moveend", updateScale);
      updateScale();
    };
    attach();
    return () => {
      cancelled = true;
      if (map) {
        map.un("pointermove", onMove);
        map.un("moveend", updateScale);
      }
      if (view) view.un("change:resolution", updateScale);
    };
  }, []);

  // Тодруулалт — тухайн төслийн recount‑ыг WFS‑ээр (GeoJSON) татаж, client талд
  // OL vector‑оор рендерлэнэ. Сервер талын style/dedup/scale хамааралгүй — БҮХ
  // feature, БҮХ label харагдана (шүүлт = дэд олонлог). Ачаалахад extent‑д fit.
  useEffect(() => {
    if (!recountProjectId) return undefined;
    let layer = null; // дэлгэрэнгүй (z > 12)
    let lowLayer = null; // шугам/талбай (z ≤ 12)
    let clusterLayer = null; // цэгийн cluster (z ≤ 12)
    let cancelled = false;
    const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL;
    const geojson = new GeoJSON();

    const load = (cql, doFit) => {
      const map = mapObjRef.current;
      const src = layer && layer.getSource();
      if (!map || !src) return;
      const url =
        `${GS}/geoname/ows?service=WFS&version=2.0.0&request=GetFeature` +
        `&typeNames=geoname:recount_view&outputFormat=application/json` +
        `&srsName=EPSG:4326&CQL_FILTER=${encodeURIComponent(cql)}` +
        `&_ts=${Date.now()}`; // cache‑buster — шинэ recount гарцаагүй орж ирнэ
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          src.clear();
          const feats = geojson.readFeatures(data, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });
          src.addFeatures(feats);
          // Line/Polygon label‑ыг шинэ feature дээр дахин тооцуулна (fit‑гүй
          // reload үед OL нэрийг рендерлэдэггүй асуудлыг арилгана).
          if (layer) layer.changed();
          map.render();
          // Legend‑д зориулж статус бүрийн тоог тооцно (recount олон статустай
          // бол бүрд нь тоологдоно).
          const counts = {};
          feats.forEach((f) => {
            String(f.get("status_ids") || "")
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .forEach((id) => {
                counts[id] = (counts[id] || 0) + 1;
              });
          });
          setRecountStatusCounts(counts);
          if (doFit && feats.length) {
            const ext = src.getExtent();
            if (ext && Number.isFinite(ext[0]) && ext[0] !== ext[2]) {
              map.getView().fit(ext, {
                padding: [60, 60, 60, 60],
                maxZoom: 13,
                duration: 400,
              });
            }
          }
        })
        .catch(() => {});
    };

    const attach = () => {
      const map = mapObjRef.current;
      if (cancelled) return;
      if (!map) {
        setTimeout(attach, 300);
        return;
      }
      // GeoServer‑т recount_view нийтлэгдсэн эсэхийг баталгаажуулна
      axiosInstance
        .get(
          endpoints.recount.wms(
            new URLSearchParams({ project: recountProjectId }).toString(),
          ),
        )
        .catch(() => {});
      // Нэг эх сурвалж (WFS feature) дээр 3 давхарга:
      //  • layer     — z > 12: дэлгэрэнгүй (од + нэр + статус)
      //  • lowLayer  — z ≤ 12: зөвхөн шугам/талбайн дүрс (нэргүй)
      //  • clusterLayer — z ≤ 12: цэгүүдийн cluster (бөмбөлөг + тоо)
      // OL: minZoom нь "энэ zoom‑оос ДЭЭШ (exclusive)", maxZoom нь "энэ zoom
      // хүртэл (inclusive)" — 12 дээр яг таарч солигдоно.
      const src = new VectorSource();
      layer = new VectorLayer({
        source: src,
        style: makeRecountStyle,
        declutter: false, // энэ түвшинд зай хангалттай — бүх нэр харагдана
        zIndex: 60,
        minZoom: RECOUNT_CLUSTER_MAX_ZOOM,
      });
      lowLayer = new VectorLayer({
        source: src,
        style: makeRecountLowStyle,
        zIndex: 59,
        maxZoom: RECOUNT_CLUSTER_MAX_ZOOM,
      });
      clusterLayer = new VectorLayer({
        source: new Cluster({
          source: src,
          distance: RECOUNT_CLUSTER_DISTANCE,
          minDistance: 18,
          // Зөвхөн цэгүүдийг нэгтгэнэ (шугам/талбайг lowLayer зурна)
          geometryFunction: (f) => {
            const g = f.getGeometry();
            const gt = g && g.getType();
            if (gt === "Point") return g;
            if (gt === "MultiPoint") return new Point(g.getCoordinates()[0]);
            return null;
          },
        }),
        style: makeRecountClusterStyle,
        zIndex: 61,
        maxZoom: RECOUNT_CLUSTER_MAX_ZOOM,
      });
      recountLayerRef.current = layer;
      recountExtraLayersRef.current = [lowLayer, clusterLayer];
      recountLoadRef.current = load;
      [layer, lowLayer, clusterLayer].forEach((l) => {
        l.setVisible(recountOn);
        map.addLayer(l);
      });
      // Хуудас ачаалахад ДАТА ТАТАХГҮЙ, НАВИГАЦИ ХИЙХГҮЙ. Тодруулалтын
      // панелиас аймаг сонгоод CQL ирсэн үед л ачаална (доорх effect).
    };
    attach();
    return () => {
      cancelled = true;
      const map = mapObjRef.current;
      if (map) {
        [layer, lowLayer, clusterLayer].forEach((l) => l && map.removeLayer(l));
      }
      recountLayerRef.current = null;
      recountExtraLayersRef.current = [];
      recountLoadRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recountProjectId]);

  // Тодруулалт checkbox‑ийн харагдах байдал (3 давхарга — detail/low/cluster)
  useEffect(() => {
    if (recountLayerRef.current) recountLayerRef.current.setVisible(recountOn);
    recountExtraLayersRef.current?.forEach((l) => l?.setVisible(recountOn));
  }, [recountOn]);

  // RECOUNT_STATUS → status_id‑ийн өнгө (нэрний доорх зураас). Ачаалагдмагц дахин рендер.
  useEffect(() => {
    if (!recountProjectId) return;
    axiosInstance
      .get(endpoints.constant.dropdown("key=RECOUNT_STATUS"))
      .then((res) => {
        const items = res?.data?.results || res?.data || [];
        const map = {};
        items.forEach((s) => {
          map[s.id] = statusColor(s);
        });
        recountStatusColorById = map;
        recountLayerRef.current?.changed();
        setRecountStatuses(
          items.map((s) => ({
            id: s.id,
            name: s.name,
            color: statusColor(s),
          })),
        );
      })
      .catch(() => {});
  }, [recountProjectId]);

  // Recount панелийн шүүлт — vector‑ийг шинэ CQL‑ээр дахин ачаална (fit хийхгүй).
  const recountAppliedCqlRef = useRef(null);
  useEffect(() => {
    if (!recountProjectId) return;
    // Шүүлт ирээгүй (аймаг сонгоогүй) бол ЮУ Ч ТАТАХГҮЙ — давхаргыг хоосон байлгана
    if (!recountCql) {
      recountAppliedCqlRef.current = null;
      recountLayerRef.current?.getSource()?.clear();
      setRecountStatusCounts({});
      return;
    }
    const base = `project_id=${recountProjectId}`;
    const cql = `(${base}) AND (${recountCql})`;
    recountAppliedCqlRef.current = cql;
    if (recountLoadRef.current) recountLoadRef.current(cql, false);
  }, [recountCql, recountProjectId]);

  // popup дээр recount засах/устгасны дараа газрын зургийг шинэчлэх гүүр
  useEffect(() => {
    registerRecountReload(() => {
      if (recountLoadRef.current && recountAppliedCqlRef.current) {
        recountLoadRef.current(recountAppliedCqlRef.current, false);
      }
    });
    return () => registerRecountReload(null);
  }, []);

  // === Backend‑ээс ирсэн БҮХ overlay‑ууд (LEGAL‑ээс бусад) — config‑оор нь
  // generic рендерлэнэ (buildOlBaseLayer). Hardcoded давхарга байхгүй. ===
  const extraOverlayConfigs = useMemo(
    () => (overlayConfigs || []).filter((c) => c?.params?.special !== "legal"),
    [overlayConfigs],
  );

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapReady) return undefined;
    const built = {};
    extraOverlayConfigs.forEach((cfg) => {
      try {
        const lyr = buildOlBaseLayer(cfg);
        lyr.setVisible(!!extraOverlayOn[cfg.key]);
        lyr.setZIndex(300 + (cfg.sort_order || 0));
        const op = overlayOpacity[cfg.key] ?? cfg?.params?.opacity;
        if (op != null) lyr.setOpacity(op);
        map.addLayer(lyr);
        built[cfg.key] = lyr;
      } catch (e) {
        /* алгасна */
      }
    });
    extraOverlayLayersRef.current = built;
    return () => {
      Object.values(built).forEach((l) => {
        try {
          map.removeLayer(l);
        } catch (e) {
          /* алгасна */
        }
      });
      extraOverlayLayersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraOverlayConfigs, mapReady]);

  // Тэдгээрийн visibility / opacity
  useEffect(() => {
    Object.entries(extraOverlayLayersRef.current).forEach(([key, lyr]) => {
      lyr.setVisible(!!extraOverlayOn[key]);
    });
  }, [extraOverlayOn]);

  useEffect(() => {
    Object.entries(extraOverlayLayersRef.current).forEach(([key, lyr]) => {
      if (overlayOpacity[key] != null) lyr.setOpacity(overlayOpacity[key]);
    });
  }, [overlayOpacity]);

  const handleToggleExtraOverlay = useCallback((key) => {
    setExtraOverlayOn((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Давхаргын жагсаалтын тоолбар ──────────────────────────────────────
  // Идэвхтэй давхаргыг дээш/доош (zIndex) зөөнө. dir: -1 = дээш, 1 = доош
  // ── Давхарга/ангиллын үйлдлүүд ─────────────────────────────────────────
  // WFS‑ээр дурын давхаргын feature‑үүдийг татна (GeoJSON, CQL‑тэй).
  const fetchWfs = useCallback(async (layerName, cql, count = 1000) => {
    const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL;
    const ws = String(layerName || "").split(":")[0];
    const url =
      `${GS}/${ws}/ows?service=WFS&version=2.0.0&request=GetFeature` +
      `&typeNames=${encodeURIComponent(layerName)}` +
      `&outputFormat=application/json&srsName=EPSG:4326&count=${count}` +
      (cql ? `&CQL_FILTER=${encodeURIComponent(cql)}` : "");
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!data || !Array.isArray(data.features)) {
      throw new Error("WFS хариу буруу");
    }
    return data;
  }, []);

  // Доод хүснэгтэд ШИНЭ ТАБ нээнэ (аль хэдийн нээлттэй бол идэвхжүүлнэ)
  const openFeatureTab = useCallback(
    async ({ key, label, layer, cql, typeId = null, geomDesc = null }) => {
      setActiveTabKey(key);
      let exists = false;
      setFeatureTabs((prev) => {
        exists = prev.some((t) => t.key === key);
        return exists
          ? prev
          : [
              ...prev,
              {
                key,
                label,
                layer,
                cql,
                // Тодруулалтын ангилал (Constant) — toolbar‑ын «нэмэх»/«холбох»
                typeId,
                geomDesc,
                loading: true,
                rows: [],
                cols: [],
                page: 0,
                pageSize: 25,
                searchCol: "",
                searchText: "",
                orderBy: "",
                order: "asc",
                hiddenCols: new Set(),
                selected: new Set(),
                filteringSelected: false,
              },
            ];
      });
      if (exists) return;
      try {
        const data = await fetchWfs(layer, cql);
        const feats = data.features || [];
        const cols = [];
        feats.slice(0, 50).forEach((f) => {
          Object.keys(f.properties || {}).forEach((k) => {
            if (!cols.includes(k)) cols.push(k);
          });
        });
        const hidden = new Set(
          cols.filter((c) => HIDDEN_FEATURE_COLS.includes(c)),
        );
        setFeatureTabs((prev) =>
          prev.map((t) =>
            t.key === key
              ? {
                  ...t,
                  loading: false,
                  cols,
                  hiddenCols: hidden,
                  rows: feats.map((f) => ({
                    id: f.id,
                    props: f.properties || {},
                    geometry: f.geometry,
                  })),
                  total:
                    data.totalFeatures ?? data.numberMatched ?? feats.length,
                }
              : t,
          ),
        );
      } catch (err) {
        setFeatureTabs((prev) =>
          prev.map((t) =>
            t.key === key
              ? {
                  ...t,
                  loading: false,
                  error:
                    "Хүснэгт үүсгэж чадсангүй — растер давхарга эсвэл WFS идэвхгүй.",
                }
              : t,
          ),
        );
      }
    },
    [fetchWfs],
  );

  // Табын төлөвийг шинэчлэх туслах (toolbar‑ын үйлдлүүд)
  const patchTab = useCallback((key, patch) => {
    setFeatureTabs((prev) =>
      prev.map((t) =>
        t.key === key
          ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) }
          : t,
      ),
    );
  }, []);

  const closeFeatureTab = useCallback((key) => {
    // Шийдвэр / хайлтын таб хаагдвал татсан дата‑г нь цэвэрлэнэ
    if (key === "legal") {
      setLegalDocsUnit(null);
      setLegalDocs([]);
      setLegalDocsSearch("");
    }
    if (key === "search") {
      setSearchQuery(null);
      setSearchPage(0);
      setNameResults([]);
    }
    setFeatureTabs((prev) => {
      const next = prev.filter((t) => t.key !== key);
      setActiveTabKey((cur) =>
        cur === key ? (next.length ? next[next.length - 1].key : null) : cur,
      );
      return next;
    });
  }, []);

  useEffect(() => {
    featureTabsRef.current = featureTabs;
  }, [featureTabs]);

  // Табын дата‑г ДАХИН татна (засвар/устгалын дараа)
  const reloadTab = useCallback(
    async (key) => {
      const tab = featureTabsRef.current.find((t) => t.key === key);
      if (!tab) return;
      patchTab(key, { loading: true });
      try {
        const data = await fetchWfs(tab.layer, tab.cql);
        const feats = data.features || [];
        patchTab(key, {
          loading: false,
          rows: feats.map((f) => ({
            id: f.id,
            props: f.properties || {},
            geometry: f.geometry,
          })),
          total: data.totalFeatures ?? feats.length,
        });
      } catch (e) {
        patchTab(key, { loading: false });
      }
    },
    [fetchWfs, patchTab],
  );

  // Тодруулалт өөрчлөгдөх бүрд (нэмэх/засах/устгах) НЭЭЛТТЭЙ attribute
  // хүснэгтүүдийг ч дахин татна — зурагтай зэрэгцэн шинэчлэгдэнэ.
  useEffect(() => {
    const h = () => {
      (featureTabsRef.current || []).forEach((t) => {
        if (t.layer === "geoname:recount_view") reloadTab(t.key);
      });
    };
    window.addEventListener("recount:changed", h);
    return () => window.removeEventListener("recount:changed", h);
  }, [reloadTab]);

  // Мөрийн үйлдэл — засах / геометр эргүүлэх / устгах
  const handleRowAction = useCallback(
    async (tabKey, row, action) => {
      const rcId = row?.props?.id;
      if (!rcId) return;
      if (action === "edit") {
        setEditRow({ row, tabKey });
        return;
      }
      if (action === "reverse") {
        try {
          await axiosInstance.post(endpoints.recount.reverseGeom(rcId));
          window.dispatchEvent(new Event("recount:changed"));
          reloadTab(tabKey);
        } catch (e) {
          /* алгасна */
        }
        return;
      }
      if (action === "delete") {
        // eslint-disable-next-line no-alert
        if (!window.confirm("Энэ тооллогыг устгах уу?")) return;
        try {
          await axiosInstance.delete(endpoints.recount.delete(rcId));
          window.dispatchEvent(new Event("recount:changed"));
          reloadTab(tabKey);
        } catch (e) {
          /* алгасна */
        }
      }
    },
    [reloadTab],
  );

  // Доод хэсгийн өндөр — чирж өөрчлөх
  const startSplitResize = useCallback(
    (e) => {
      splitDragRef.current = { y: e.clientY, h: splitH };
      const onMove = (ev) => {
        const d = splitDragRef.current;
        if (!d) return;
        const next = Math.min(
          Math.max(140, d.h + (d.y - ev.clientY)),
          window.innerHeight - 220,
        );
        setSplitH(next);
      };
      const onUp = () => {
        splitDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [splitH],
  );

  // ── Орон зайн сонголт: зурсан муж дотор ОРСОН тооллогуудыг олно ───────
  // Олдвол: (1) тэдгээр рүү zoom, (2) газрын зураг дээр тодруулна,
  // (3) доод хэсэгт recount жагсаалтыг шинэ таб болгон нээнэ.
  const runSpatialSelect = useCallback(
    async (ringLonLat) => {
      if (!recountProjectId || !ringLonLat?.length) return;
      const ring = [...ringLonLat];
      const [fx, fy] = ring[0];
      const [lx, ly] = ring[ring.length - 1];
      if (fx !== lx || fy !== ly) ring.push([fx, fy]);
      // ЧУХАЛ: WFS 2.0 + EPSG:4326 дээр CQL‑ийн WKT нь LAT LON дараалалтай
      // (lon lat бичвэл үргэлж 0 үр дүн буцаана).
      const wkt = `POLYGON((${ring
        .map(([x, y]) => `${y.toFixed(6)} ${x.toFixed(6)}`)
        .join(",")}))`;
      // ЗӨВХӨН идэвхтэй давхарга (сонгосон ангилал) дотроос сонгоно
      const layerCql = activeRecountLayer?.id
        ? ` AND type_id=${activeRecountLayer.id}`
        : "";
      const cql =
        `project_id=${recountProjectId}${layerCql} ` +
        `AND INTERSECTS(geoloc, ${wkt})`;
      try {
        const data = await fetchWfs("geoname:recount_view", cql, 2000);
        const feats = data.features || [];
        if (!feats.length) {
          window.dispatchEvent(
            new CustomEvent("map:notice", {
              detail: {
                title: "Сонголт хоосон:",
                text: "Тэмдэглэсэн муж дотор тооллого олдсонгүй",
              },
            }),
          );
          return;
        }
        // (1) Zoom + (2) тодруулах
        const map = mapObjRef.current;
        recountSelectedIds = new Set(
          feats.map((f) => String(f.properties?.id)),
        );
        if (map) {
          const src = new VectorSource({
            features: new GeoJSON().readFeatures(data, {
              dataProjection: "EPSG:4326",
              featureProjection: map.getView().getProjection(),
            }),
          });
          map.getView().fit(src.getExtent(), {
            duration: 500,
            padding: [80, 80, 80, 80],
            maxZoom: 16,
          });
        }
        recountLayerRef.current?.changed();
        recountExtraLayersRef.current?.forEach((l) => l?.changed());
        // (3) Доод хэсэгт жагсаалт болгон нээнэ (мөрүүд нь сонгогдсон)
        const cols = [];
        feats.slice(0, 50).forEach((f) => {
          Object.keys(f.properties || {}).forEach((k) => {
            if (!cols.includes(k)) cols.push(k);
          });
        });
        const rows = feats.map((f) => ({
          id: f.id,
          props: f.properties || {},
          geometry: f.geometry,
        }));
        const key = `sel-${feats.length}-${rows[0]?.id || ""}`;
        setFeatureTabs((prev) => {
          const rest = prev.filter((t) => !t.key.startsWith("sel-"));
          return [
            ...rest,
            {
              key,
              label: activeRecountLayer?.name
                ? `${activeRecountLayer.name} — сонголт (${feats.length})`
                : `Сонголт (${feats.length})`,
              layer: "geoname:recount_view",
              cql,
              loading: false,
              cols,
              hiddenCols: new Set(
                cols.filter((c) => HIDDEN_FEATURE_COLS.includes(c)),
              ),
              rows,
              total: feats.length,
              page: 0,
              pageSize: 25,
              searchCol: "",
              searchText: "",
              orderBy: "",
              order: "asc",
              selected: new Set(rows.map((r) => r.id)),
              filteringSelected: false,
            },
          ];
        });
        setActiveTabKey(key);
      } catch (e) {
        /* алгасна */
      }
    },
    [recountProjectId, fetchWfs, activeRecountLayer],
  );

  // Тооллогын ангиллын мөрийн цэс (Удирдлага панел) — таб нээх / zoom / чанар
  const handleRecountNodeAction = useCallback(
    async (node, action) => {
      const id = node?.id;
      if (!id || !recountProjectId) return;
      const cql =
        `project_id=${recountProjectId} AND ` +
        `(type_id=${id} OR type_l2=${id} OR type_l1=${id})`;
      const layer = "geoname:recount_view";

      if (action === "features") {
        openFeatureTab({
          key: `rc-${id}`,
          label: node.name || `Ангилал ${id}`,
          layer,
          cql,
          typeId: id,
          // ЗӨВХӨН навч (нэг төрөлтэй) ангилал л «нэмэх/холбох»‑ыг зөвшөөрнө.
          // Бүлэг (олон дэд төрөлтэй) табд геометрийн төрөл тодорхойгүй.
          geomDesc: (node.children || []).length ? null : node.desc || null,
        });
        return;
      }
      if (action === "zoom") {
        try {
          const data = await fetchWfs(layer, cql, 2000);
          const map = mapObjRef.current;
          if (!map || !data.features?.length) return;
          const src = new VectorSource({
            features: new GeoJSON().readFeatures(data, {
              dataProjection: "EPSG:4326",
              featureProjection: map.getView().getProjection(),
            }),
          });
          map.getView().fit(src.getExtent(), {
            duration: 500,
            padding: [80, 80, 80, 80],
            maxZoom: 15,
          });
        } catch (e) {
          /* алгасна */
        }
        return;
      }
      if (action === "quality") {
        setQualityReport({ label: node.name, loading: true });
        try {
          const data = await fetchWfs(layer, cql, 2000);
          const feats = data.features || [];
          setQualityReport({
            label: node.name,
            loading: false,
            total: data.totalFeatures ?? feats.length,
            checked: feats.length,
            noGeom: feats.filter((f) => !f.geometry).length,
            nameField: "name",
            noName: feats.filter(
              (f) => !String(f.properties?.name || "").trim(),
            ).length,
          });
        } catch (e) {
          setQualityReport({
            label: node.name,
            loading: false,
            error: "Шалгалт хийх боломжгүй.",
          });
        }
      }
    },
    [recountProjectId, openFeatureTab, fetchWfs],
  );

  const handleStopDrawing = useCallback(() => {
    const map = mapObjRef.current;
    if (map) {
      map.getTargetElement().style.cursor = "";
    }
  }, []);

  const handleDrawCircle = useCallback(
    (coordinates, radius) => {
      const source = radiusCircleSourceRef.current;
      if (!source) return;

      source.clear();

      const [lon, lat] = coordinates;
      const centerInMapProjection = fromLonLat([lon, lat]);

      try {
        const centerLonLat = [lon, lat];
        const geodesicCircle = circular(centerLonLat, radius, 128);
        geodesicCircle.transform("EPSG:4326", "EPSG:3857");

        const circleFeature = new Feature({
          geometry: geodesicCircle,
          name: "search-radius",
        });

        circleFeature.setStyle(radiusAreaStyle);

        source.addFeature(circleFeature);
      } catch (error) {
        const circle = new Circle(centerInMapProjection, radius);
        const circleFeature = new Feature({
          geometry: circle,
          name: "search-radius-fallback",
        });

        circleFeature.setStyle(radiusAreaStyle);

        source.addFeature(circleFeature);
      }

      const centerPoint = new Feature({
        geometry: new Point(centerInMapProjection),
        name: "search-center",
      });

      centerPoint.setStyle(radiusCenterStyle);

      source.addFeature(centerPoint);
    },
    [radiusAreaStyle, radiusCenterStyle],
  );

  // Газрын зураг дээр нэг цэг сонгох (Цэг горим). Draw('Point') клик‑ийг
  // өөртөө авдаг тул feature‑select click асахгүй. callback([lon, lat]).
  const handleStartPickPoint = useCallback((callback) => {
    const map = mapObjRef.current;
    const source = radiusCircleSourceRef.current;
    if (!map || !source) return;
    source.clear();
    map.getTargetElement().style.cursor = "crosshair";

    const draw = new Draw({ source, type: "Point" });
    let done = false;
    const cleanup = () => {
      map.removeInteraction(draw);
      map.getTargetElement().style.cursor = "";
      document.removeEventListener("keydown", keyHandler);
    };
    draw.on("drawend", (event) => {
      done = true;
      const coords = event.feature.getGeometry().getCoordinates();
      const lonLat = transform(coords, "EPSG:3857", "EPSG:4326");
      source.clear(); // дугуйг радиусаар дахин зурна
      cleanup();
      if (callback) callback(lonLat);
    });
    const keyHandler = (e) => {
      if (e.key === "Escape" && !done) {
        source.clear();
        cleanup();
        if (callback) callback(null);
      }
    };
    map.addInteraction(draw);
    document.addEventListener("keydown", keyHandler);
  }, []);

  // Газрын зураг дээр дүрс (полигон) зурах (Дүрс горим). callback нь
  // [[lon, lat], ...] цагираг буцаана.
  const handleStartDrawPolygon = useCallback(
    (callback) => {
      const map = mapObjRef.current;
      const source = radiusCircleSourceRef.current;
      if (!map || !source) return;
      source.clear();
      map.getTargetElement().style.cursor = "crosshair";

      const draw = new Draw({ source, type: "Polygon" });
      let done = false;
      const cleanup = () => {
        map.removeInteraction(draw);
        map.getTargetElement().style.cursor = "";
        document.removeEventListener("keydown", keyHandler);
      };
      draw.on("drawend", (event) => {
        done = true;
        const feature = event.feature;
        feature.setStyle(radiusAreaStyle);
        const ring = feature.getGeometry().getCoordinates()[0] || [];
        const lonLatRing = ring.map((c) =>
          transform(c, "EPSG:3857", "EPSG:4326"),
        );
        cleanup();
        if (callback) callback(lonLatRing);
      });
      const keyHandler = (e) => {
        if (e.key === "Escape" && !done) {
          source.clear();
          cleanup();
          if (callback) callback(null);
        }
      };
      map.addInteraction(draw);
      document.addEventListener("keydown", keyHandler);
    },
    [radiusAreaStyle],
  );

  // Газрын зураг дээр тэгш өнцөгт зурах (Тэгш өнцөгт горим). callback нь
  // [[lon, lat], ...] цагираг буцаана.
  const handleStartDrawRectangle = useCallback(
    (callback) => {
      const map = mapObjRef.current;
      const source = radiusCircleSourceRef.current;
      if (!map || !source) return;
      source.clear();
      map.getTargetElement().style.cursor = "crosshair";

      const draw = new Draw({
        source,
        type: "Circle",
        geometryFunction: createBox(),
      });
      let done = false;
      const cleanup = () => {
        map.removeInteraction(draw);
        map.getTargetElement().style.cursor = "";
        document.removeEventListener("keydown", keyHandler);
      };
      draw.on("drawend", (event) => {
        done = true;
        const feature = event.feature;
        feature.setStyle(radiusAreaStyle);
        const ring = feature.getGeometry().getCoordinates()[0] || [];
        const lonLatRing = ring.map((c) =>
          transform(c, "EPSG:3857", "EPSG:4326"),
        );
        cleanup();
        if (callback) callback(lonLatRing);
      });
      const keyHandler = (e) => {
        if (e.key === "Escape" && !done) {
          source.clear();
          cleanup();
          if (callback) callback(null);
        }
      };
      map.addInteraction(draw);
      document.addEventListener("keydown", keyHandler);
    },
    [radiusAreaStyle],
  );

  // Хайлтын талбай (тэгш өнцөгт/дугуй/дүрс)‑г газрын зургаас цэвэрлэх
  const handleClearSearchArea = useCallback(() => {
    radiusCircleSourceRef.current?.clear();
  }, []);

  const createCqlWmsLayer = useCallback((pointIds, options = {}) => {
    const map = mapObjRef.current;
    if (!map || !pointIds || pointIds.length === 0) return;

    if (cqlWmsLayerRef.current) {
      map.removeLayer(cqlWmsLayerRef.current);
      cqlWmsLayerRef.current = null;
    }

    const uniqueIds = Array.isArray(pointIds)
      ? [...new Set(pointIds)]
      : [pointIds];

    const idsFilter =
      " " + uniqueIds.map((id) => `point_id=${id}`).join(" OR ");

    const wmsParams = buildWmsParams({
      CQL_FILTER: idsFilter,
      STYLES: options.style || "",
    });

    if (options.tiled !== false) {
      wmsParams.TILED = true;
    }

    cqlWmsSourceRef.current = new TileWMS({
      url: WMS_URL,
      params: wmsParams,
      serverType: "geoserver",
      crossOrigin: "anonymous",
    });

    // Debug: CQL WMS for multiple points
    // eslint-disable-next-line no-console
    console.log("[WMS DEBUG] createCqlWmsLayer", {
      url: WMS_URL,
      params: wmsParams,
      pointIds: uniqueIds,
    });

    cqlWmsLayerRef.current = new TileLayer({
      source: cqlWmsSourceRef.current,
      opacity: options.opacity || 0.8,
      zIndex: options.zIndex || 1000,
    });

    cqlWmsSourceRef.current.on("tileloaderror", (event) => {
      console.error("CQL WMS tile load error:", event);
      console.error("Failed URL might be:", event.tile?.src_);
    });

    map.addLayer(cqlWmsLayerRef.current);

    return cqlWmsLayerRef.current;
  }, []);

  useEffect(() => {
    if (!urlParams.point_id || !mapObjRef.current) return;

    const pointId = parseInt(urlParams.point_id);
    if (!isNaN(pointId)) {
      createCqlWmsLayer([pointId], {
        opacity: 0.9,
        zIndex: 1500,
        tiled: true,
      });

      if (typeof window !== "undefined") {
        const url = new URL(window.location);
        url.searchParams.delete("lat");
        url.searchParams.delete("lon");
        url.searchParams.delete("zoom");
        url.searchParams.delete("point_id");

        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [urlParams.point_id, createCqlWmsLayer]);

  const removeCqlWmsLayer = useCallback(() => {
    const map = mapObjRef.current;
    if (map && cqlWmsLayerRef.current) {
      map.removeLayer(cqlWmsLayerRef.current);
      cqlWmsLayerRef.current = null;
      cqlWmsSourceRef.current = null;
    }
  }, []);

  const handleShowMultiplePointsWithCql = useCallback(
    (points, options = {}) => {
      if (!points || points.length === 0) {
        console.warn("handleShowMultiplePointsWithCql: No points provided");
        return;
      }

      const pointIds = points
        .map((pointData) => {
          const point = pointData.point || pointData;
          const id = point.id || point.point_id || point.measurement_id;
          if (!id) {
            console.warn("Point missing ID:", point);
          }
          return id;
        })
        .filter((id) => id != null);

      if (pointIds.length === 0) {
        console.warn("No valid point IDs found in points array");
        return;
      }

      const uniquePointIds = [...new Set(pointIds)];

      const layer = createCqlWmsLayer(uniquePointIds, {
        opacity: 0.9,
        zIndex: 1000,
        tiled: true,
        style: "",
        ...options,
      });

      if (!layer) {
        console.error("Failed to create CQL WMS layer");
        return;
      }

      if (options.fitToExtent !== false) {
        const coordinates = points
          .map((pointData) => {
            const point = pointData.point || pointData;
            if (point.geoloc?.coordinates) {
              return point.geoloc.coordinates;
            } else if (point.final_x && point.final_y) {
              return [parseFloat(point.final_x), parseFloat(point.final_y)];
            } else if (point.longitude && point.latitude) {
              return [parseFloat(point.longitude), parseFloat(point.latitude)];
            }
            return null;
          })
          .filter((coord) => coord && !isNaN(coord[0]) && !isNaN(coord[1]));

        if (coordinates.length > 0) {
          try {
            const transformedCoords = coordinates.map((coord) =>
              fromLonLat(coord),
            );
            const extent = boundingExtent(transformedCoords);

            mapObjRef.current.getView().fit(extent, {
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 16,
            });
          } catch (error) {
            console.error("Error fitting map to extent:", error);
          }
        }
      }

      setTimeout(() => {
        layer.getSource().refresh();
        mapObjRef.current.render();
      }, 100);
    },
    [createCqlWmsLayer],
  );

  const handleSearchResults = useCallback(
    (results) => {
      const source = measurementSearchSourceRef.current;
      if (source) {
        source.clear();
      }

      if (!Array.isArray(results) || results.length === 0) {
        removeCqlWmsLayer();
        return;
      }

      const features = [];

      results.forEach((measurement, index) => {
        const coords = measurement.point?.geoloc?.coordinates;

        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
          return;
        }

        const [lon, lat] = coords;

        if (isNaN(lon) || isNaN(lat)) {
          return;
        }

        try {
          const transformedCoords = fromLonLat([lon, lat]);
          const feature = new Feature({
            geometry: new Point(transformedCoords),
            measurement,
            name: measurement.point?.name || `Measurement ${index}`,
            index,
          });

          features.push(feature);
        } catch (error) {
          console.error(`Error creating feature ${index}:`, error);
        }
      });

      if (features.length > 0) {
        source.addFeatures(features);
        measurementSearchLayerRef.current?.changed();

        /////////////////////////////////////////////////////////
        // Олдсон цэгээр zoom-лэж буй хэсэг
        const extent = source.getExtent();
        if (
          extent &&
          extent[0] !== Infinity &&
          extent[1] !== Infinity &&
          extent[2] !== -Infinity &&
          extent[3] !== -Infinity
        ) {
          const map = mapObjRef.current;
          if (map) {
            const view = map.getView();
            view.fit(extent, {
              padding: [20, 20, 20, 20],
              duration: 800,
              maxZoom: 18,
            });
          }
        }
        /////////////////////////////////////////////////////////
      }

      // removeCqlWmsLayer();
    },
    [removeCqlWmsLayer],
  );

  const handleHighlightPoint = useCallback((point) => {
    if (!point) return;

    let lon;
    let lat;

    if (Array.isArray(point.geoloc?.coordinates)) {
      [lon, lat] = point.geoloc.coordinates;
    } else if (
      typeof point.lon !== "undefined" &&
      typeof point.lat !== "undefined"
    ) {
      lon = parseFloat(point.lon);
      lat = parseFloat(point.lat);
    }

    if (typeof lon === "undefined" || typeof lat === "undefined") return;
    if (isNaN(lon) || isNaN(lat)) return;

    const map = mapObjRef.current;
    if (!map) return;

    try {
      const transformed = fromLonLat([lon, lat]);

      const existingFeatures =
        measurementSearchSourceRef.current?.getFeatures() || [];
      const nonHighlightFeatures = existingFeatures.filter(
        (f) => !f.get("isHighlight"),
      );
      console.log("nonHighlightFeatures", nonHighlightFeatures);
      measurementSearchSourceRef.current?.clear();
      measurementSearchSourceRef.current?.addFeatures(nonHighlightFeatures);

      const feat = new Feature({
        geometry: new Point(transformed),
        measurement: { point },
        isHighlight: true,
      });

      const highlightStyle = [
        new Style({
          image: new CircleStyle({
            radius: 12,
            fill: new Fill({ color: "rgba(255, 61, 0, 0.2)" }),
            stroke: new Stroke({ color: "rgba(255, 61, 0, 0.4)", width: 1 }),
          }),
        }),
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color: "#ff3d00" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
          }),
        }),
      ];

      feat.setStyle(highlightStyle);
      measurementSearchSourceRef.current?.addFeature(feat);
      measurementSearchLayerRef.current?.changed();

      // Calculate pixel position for the point with offset
      const pixel = map.getPixelFromCoordinate(transformed);
      const mapElement = map.getTargetElement();
      const rect = mapElement.getBoundingClientRect();
      setAnchorPosition({
        top: rect.top + pixel[1],
        left: rect.left + pixel[0] + 10, // Add 10px offset
      });

      if (!point.network_id) {
        point.network_id = point.network?.id || "";
      }

      setSelectedName(point);
      setSidebarOpen(true);
    } catch (error) {
      console.error("Error highlighting point on map:", error);
    }
  }, []);

  // Sidebar‑ийг чирэх үед цэгээс Popover хүртэл шугам зурна
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !anchorPosition) {
      if (linkLineSourceRef.current) {
        linkLineSourceRef.current.clear();
      }
      return;
    }

    // Click хийсэн map‑ын координат (EPSG:3857)
    const pointCoord = lastClickCoordinateRef.current;
    if (!pointCoord || !Array.isArray(pointCoord)) {
      linkLineSourceRef.current?.clear();
      return;
    }

    const mapElement = map.getTargetElement();
    if (!mapElement) {
      linkLineSourceRef.current?.clear();
      return;
    }
    const rect = mapElement.getBoundingClientRect();
    const pixel = [
      anchorPosition.left - rect.left,
      anchorPosition.top - rect.top,
    ];
    const popupCoord = map.getCoordinateFromPixel(pixel);
    if (!popupCoord) {
      linkLineSourceRef.current?.clear();
      return;
    }

    const source = linkLineSourceRef.current;
    if (!source) return;

    source.clear();
    const line = new LineString([pointCoord, popupCoord]);
    const feature = new Feature({ geometry: line });
    source.addFeature(feature);
  }, [anchorPosition]);

  // Дарсан объектын бүтэн геометрийг ТОД УЛААНААР тодруулна (цэг/шугам/талбай).
  useEffect(() => {
    const src = nameGeomSourceRef.current;
    if (!src) return;
    src.clear();
    const geom = selectedName?._geom;
    if (!geom || !geom.type || !geom.coordinates) return;
    try {
      // GetFeatureInfo GeoJSON — SRS-ийг координатын хэмжээгээр таамаглана
      // (градус ≤180/≤90 бол EPSG:4326, эс бөгөөс EPSG:3857).
      let flat = geom.coordinates;
      while (Array.isArray(flat[0])) flat = flat[0];
      const isDeg = Math.abs(flat[0]) <= 180 && Math.abs(flat[1]) <= 90;
      const feature = new GeoJSON().readFeature(
        { type: "Feature", geometry: geom, properties: {} },
        {
          dataProjection: isDeg ? "EPSG:4326" : "EPSG:3857",
          featureProjection: "EPSG:3857",
        },
      );
      src.addFeature(feature);
    } catch (e) {
      /* геометр уншиж чадсангүй — алгасна */
    }
  }, [selectedName]);

  // Төслийн ажлын талбай (ProjectArea) — polygon + голд нь label
  // (үүсгэсэн хэрэглэгч, төлөв). Алтан (gold) өнгөөр, дууссан бол ногоон.
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapReady) return;
    if (!projectAreaLayerRef.current) {
      projectAreaLayerRef.current = new VectorLayer({
        source: new VectorSource(),
        zIndex: 58,
        style: (feature) => {
          const done = !!feature.get("is_finished");
          const color = done ? "#16a34a" : "#d4a017"; // ногоон / алтан
          return new Style({
            stroke: new Stroke({ color, width: 2.5 }),
            fill: new Fill({
              color: done ? "rgba(22,163,74,0.10)" : "rgba(212,160,23,0.14)",
            }),
            text: new Text({
              text: [
                feature.get("user_name") || "—",
                done ? "Дууссан" : "Хийгдэж буй",
              ].join("\n"),
              font: "bold 12px sans-serif",
              textAlign: "center",
              overflow: true,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: "#fff", width: 3 }),
            }),
          });
        },
      });
      map.addLayer(projectAreaLayerRef.current);
    }
    const src = projectAreaLayerRef.current.getSource();
    src.clear();
    (projectAreas || []).forEach((a) => {
      if (!a?.area) return;
      try {
        const f = new GeoJSON().readFeature(
          {
            type: "Feature",
            geometry: a.area,
            properties: {
              id: a.id,
              user_name: a.user_name,
              is_finished: !!a.is_finished,
            },
          },
          { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" },
        );
        src.addFeature(f);
      } catch (e) {
        /* геометр уншиж чадсангүй — алгасна */
      }
    });
  }, [projectAreas, mapReady]);

  const handleClearHighlight = useCallback(() => {
    const existingFeatures =
      measurementSearchSourceRef.current?.getFeatures() || [];
    const nonHighlightFeatures = existingFeatures.filter(
      (f) => !f.get("isHighlight"),
    );
    measurementSearchSourceRef.current?.clear();
    measurementSearchSourceRef.current?.addFeatures(nonHighlightFeatures);
    measurementSearchLayerRef.current?.changed();
  }, []);

  const handleClearSearchResults = useCallback(() => {
    measurementSearchSourceRef.current?.clear();
    radiusCircleSourceRef.current?.clear();
    removeCqlWmsLayer();
  }, [removeCqlWmsLayer]);

  useEffect(() => {
    const handleOpenGeoserverDialog = () => {
      setForceGeoserverOpen(true);
      setForceGeoserverTab("layers");
    };

    window.addEventListener(
      "map:open-geoserver-dialog",
      handleOpenGeoserverDialog,
    );
    const handleShowMeasurementsForPoint = (event) => {
      const pointId = event?.detail?.pointId;
      if (!pointId) return;
      // ганц цэгийн хэмжилтүүдийг CQL WMS‑ээр ачаалаад FeatureSelector‑оор харуулна
      handleShowMultiplePointsWithCql([{ point_id: pointId }], {
        fitToExtent: true,
      });
    };

    window.addEventListener(
      "map:show-measurements-for-point",
      handleShowMeasurementsForPoint,
    );
    return () => {
      window.removeEventListener(
        "map:open-geoserver-dialog",
        handleOpenGeoserverDialog,
      );
      window.removeEventListener(
        "map:show-measurements-for-point",
        handleShowMeasurementsForPoint,
      );
    };
  }, [handleShowMultiplePointsWithCql]);

  // ── Хайлтын илэрц — доод attribute хүснэгтийн ТАБ ──
  const SEARCH_TABLE_HEAD = [
    { id: "", label: "Nº", width: 44 },
    { id: "name", label: "Нэр" },
    { id: "number", label: "Дугаар" },
    { id: "aimag_name", label: "Аймаг" },
    { id: "sum_name", label: "Сум" },
    { id: "geom_kind", label: "Геом", width: 70, align: "center" },
  ];
  // units нь [{id,name,level}] — аймаг эхэнд, дараа нь сум
  const unitAt = (units, key) =>
    (units || []).find((u) => (u.level || "").includes(key))?.name || "—";
  // Геометрийн төрлөөр дүрс — геомгүй бол null
  const geomIcon = (t) => {
    const g = String(t || "");
    if (g.includes("Point"))
      return { icon: "mdi:map-marker", color: "#16a34a", title: "Цэг" };
    if (g.includes("Line"))
      return { icon: "mdi:vector-polyline", color: "#2563eb", title: "Шугам" };
    if (g.includes("Polygon"))
      return { icon: "mdi:vector-square", color: "#d97706", title: "Талбай" };
    return null;
  };
  const renderSearchTab = (
    <Box
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      {/* Toolbar — нэр/дугаар/төрөл/аймаг/сум + геометрийн төрөл */}
      <Box
        sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1 }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Нэр, дугаараар хайх…"
          value={resTerm}
          onChange={(e) => {
            setResTerm(e.target.value);
            setSearchPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
        {["Төрөл", "Дэд төрөл", "Ангилал"].map((lbl, lvl) => (
          <TextField
            key={lbl}
            select
            size="small"
            label={lbl}
            value={resType[lvl]}
            disabled={lvl > 0 && !resType[lvl - 1]}
            onChange={(e) => pickResType(lvl, e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Бүгд</MenuItem>
            {(resTypeOpts[lvl] || []).map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
        ))}
        <TextField
          select
          size="small"
          label="Аймаг/Нийслэл"
          value={resAimag}
          onChange={(e) => {
            setResAimag(e.target.value);
            setResSum("");
            setSearchPage(0);
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Бүгд</MenuItem>
          {resAimagOptions.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.unit}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Сум/Дүүрэг"
          value={resSum}
          disabled={!resAimag}
          onChange={(e) => {
            setResSum(e.target.value);
            setSearchPage(0);
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="">Бүгд</MenuItem>
          {resSumOptions.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.unit}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Геометр"
          value={resGeom}
          onChange={(e) => {
            setResGeom(e.target.value);
            setSearchPage(0);
          }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">Бүгд</MenuItem>
          <MenuItem value="point">Цэг</MenuItem>
          <MenuItem value="line">Шугам</MenuItem>
          <MenuItem value="polygon">Талбай</MenuItem>
        </TextField>
      </Box>

      <TableContainer sx={{ flex: 1, position: "relative", overflow: "auto" }}>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 640 }} stickyHeader>
            <TableHeadCustom
              headLabel={SEARCH_TABLE_HEAD}
              //
              order={resOrder.desc ? "desc" : "asc"}
              orderBy={resOrder.by}
              onSort={(id) => {
                setSearchPage(0);
                setResOrder((o) =>
                  o.by === id
                    ? { by: id, desc: !o.desc }
                    : { by: id, desc: false },
                );
              }}
            />
            <TableBody>
              {nameResultsLoading &&
                Array.from({ length: Math.min(searchPageSize, 10) }).map(
                  (_, i) => (
                    <TableSkeleton
                      key={i}
                      headLength={SEARCH_TABLE_HEAD.length}
                    />
                  ),
                )}

              {!nameResultsLoading &&
                nameResults.map((it, i) => {
                  const bbox = it.lat == null ? geoJsonBbox(it.geom) : null;
                  const canFly = it.lat != null || bbox != null;
                  return (
                    <TableRow
                      key={it.id}
                      hover
                      onClick={() => {
                        if (it.lat != null) {
                          handleFlyTo({ center: [it.lon, it.lat], zoom: 14 });
                        } else if (bbox) {
                          handleFlyTo({ bbox });
                        }
                      }}
                      sx={{ cursor: canFly ? "pointer" : "default" }}
                    >
                      <TableCell>
                        {searchPage * searchPageSize + i + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {it.name || "—"}
                      </TableCell>
                      <TableCell>{it.number}</TableCell>
                      <TableCell>{unitAt(it.units, "Аймаг")}</TableCell>
                      <TableCell>{unitAt(it.units, "Сум")}</TableCell>
                      <TableCell align="center">
                        {(() => {
                          const gi = geomIcon(it.geom_type);
                          if (!gi || !canFly) return null;
                          return (
                            <Tooltip title={`${gi.title} — зураг дээр очих`}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (it.lat != null) {
                                    handleFlyTo({
                                      center: [it.lon, it.lat],
                                      zoom: 14,
                                    });
                                  } else if (bbox) {
                                    handleFlyTo({ bbox });
                                  }
                                }}
                              >
                                <Iconify
                                  icon={gi.icon}
                                  width={18}
                                  sx={{ color: gi.color }}
                                />
                              </IconButton>
                            </Tooltip>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}

              <TableNoData
                notFound={!nameResultsLoading && !nameResults.length}
              />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={searchCount || searchQuery?.count || 0}
        //
        page={searchPage}
        onPageChange={(e, p) => setSearchPage(p)}
        //
        rowsPerPage={searchPageSize}
        rowsPerPageOptions={[25, 50, 100, 200]}
        onRowsPerPageChange={(e) => {
          setSearchPageSize(parseInt(e.target.value, 10));
          setSearchPage(0);
        }}
      />
    </Box>
  );

  // ── Шийдвэрийн жагсаалт — доод attribute хүснэгтийн ТАБ болж харагдана ──
  const renderLegalTab = (
    <Box
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      {/* Toolbar — хайлт (нэр, дугаар, төрөл, огноо) + нэмэх */}
      <Box
        sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1 }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Нэр, дугаар, төрөл, огноогоор хайх…"
          value={legalDocsSearch}
          onChange={(e) => {
            setLegalDocsSearch(e.target.value);
            legalTable.onResetPage();
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          }}
        />
        {legalPerms.create && (
          <Tooltip title="Шинэ шийдвэр нэмэх">
            <IconButton
              color="primary"
              onClick={() => setLegalForm({ mode: "create", row: null })}
            >
              <Iconify icon="mingcute:add-line" width={20} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* НЭМЭХ форм — toolbar‑ын ЯГ доор (засах нь мөрийнхөө доор гарна) */}
      {legalForm?.mode === "create" && (
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            maxHeight: "70%",
            overflowY: "auto",
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.neutral",
          }}
        >
          <LegalNewEditForm
            currentItem={legalForm.row}
            onClose={() => setLegalForm(null)}
            refetch={refetchLegalDocs}
          />
        </Box>
      )}

      <TableContainer sx={{ flex: 1, position: "relative", overflow: "auto" }}>
        <Scrollbar>
          <Table
            size={legalTable.dense ? "small" : "medium"}
            sx={{ minWidth: 720 }}
            stickyHeader
          >
            <TableHeadCustom
              headLabel={LEGAL_TABLE_HEAD}
              //
              order={legalTable.order}
              onSort={legalTable.onSort}
              orderBy={legalTable.orderBy}
            />

            <TableBody>
              {legalDocsLoading &&
                Array.from({ length: legalTable.rowsPerPage }).map((_, i) => (
                  <TableSkeleton key={i} headLength={LEGAL_TABLE_HEAD.length} />
                ))}

              {!legalDocsLoading &&
                legalDocs.map((d, i) => (
                  <React.Fragment key={d.id}>
                    <TableRow hover>
                      <TableCell>
                        {legalTable.page * legalTable.rowsPerPage + i + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                      <TableCell>{d.type?.name || "—"}</TableCell>
                      <TableCell>{d.unit?.unit || "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {d.order_date || "—"}
                      </TableCell>
                      <TableCell>{d.order_number || "—"}</TableCell>
                      <TableCell align="right">{d.names_count ?? 0}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {(legalPerms.update || legalPerms.delete) && (
                          <IconButton
                            size="small"
                            color={
                              legalMenu?.row?.id === d.id
                                ? "inherit"
                                : "default"
                            }
                            onClick={(e) =>
                              setLegalMenu({ anchor: e.currentTarget, row: d })
                            }
                          >
                            <Iconify icon="eva:more-vertical-fill" width={18} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* ЗАСАХ форм — тухайн мөрийнхөө ЯГ доор задарна */}
                    {legalForm?.mode === "edit" &&
                      legalForm.row?.id === d.id && (
                        <TableRow>
                          <TableCell
                            colSpan={LEGAL_TABLE_HEAD.length}
                            sx={{ p: 0, borderBottom: "none" }}
                          >
                            <Collapse in unmountOnExit>
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 1.5,
                                  bgcolor: "background.neutral",
                                }}
                              >
                                <LegalNewEditForm
                                  currentItem={legalForm.row}
                                  onClose={() => setLegalForm(null)}
                                  refetch={refetchLegalDocs}
                                />
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                  </React.Fragment>
                ))}

              <TableNoData notFound={!legalDocsLoading && !legalDocs.length} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      {/* Мөрийн үйлдлийн цэс — төслийн нэгдсэн загвар (MenuItem) */}
      <Menu
        open={!!legalMenu}
        anchorEl={legalMenu?.anchor}
        onClose={() => setLegalMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 160 } } }}
      >
        {legalPerms.update && (
          <MenuItem
            onClick={() => {
              setLegalForm({ mode: "edit", row: legalMenu.row });
              setLegalMenu(null);
            }}
          >
            <Iconify icon="solar:pen-bold" sx={{ mr: 1 }} />
            Засах
          </MenuItem>
        )}
        {legalPerms.delete && (
          <>
            <Divider sx={{ borderStyle: "dashed" }} />
            <MenuItem
              sx={{ color: "error.main" }}
              onClick={() => {
                setLegalDelRow(legalMenu.row);
                setLegalMenu(null);
              }}
            >
              <Iconify icon="solar:trash-bin-trash-bold" sx={{ mr: 1 }} />
              Устгах
            </MenuItem>
          </>
        )}
      </Menu>

      <TablePaginationCustom
        count={legalDocsCount}
        //
        page={legalTable.page}
        onPageChange={legalTable.onChangePage}
        //
        rowsPerPage={legalTable.rowsPerPage}
        onRowsPerPageChange={legalTable.onChangeRowsPerPage}
        //
        dense={legalTable.dense}
        onChangeDense={legalTable.onChangeDense}
      />
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <MapHeader
        onMenu={() => setForceGeoserverOpen((v) => !v)}
        onAdvanced={(value) => {
          setForceGeoserverOpen(true);
          // Толгойн хайлтын утгыг дэлгэрэнгүй хайлтад дамжуулж урьдчилж дүүргэнэ.
          if (value) {
            headerSearchNonce.current += 1;
            setGeonameSearchTerm({
              term: value,
              n: headerSearchNonce.current,
            });
          }
        }}
        onSearchText={handleHeaderSearch}
      />
      <Box
        id="map-viewport"
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "hidden",
          m: 0,
          p: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Байрлал засах — газрын зураг дээрх floating toolbar (popup хаагдсан ч
            харагдана). Хадгалах/Болих нь mapDraw‑ийн commit/cancel‑г дуудна. */}
        {geomEditing && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1300,
              bgcolor: "background.paper",
              boxShadow: 4,
              borderRadius: 1.5,
              px: 1.5,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Байрлал засаж байна — цэг/vertex зөөнө үү
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => commitMapEdit()}
            >
              Хадгалах
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => cancelMapEdit()}
            >
              Болих (ESC)
            </Button>
          </Box>
        )}
        <Box
          ref={mapRef}
          sx={{
            width: "100%",
            height: "100%",
            m: 0,
            p: 0,
            "& .ol-zoom": { display: "none" },
            "& .ol-attribution": {
              bottom: "60px",
              right: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "8px",
              padding: "4px 8px",
              fontSize: "11px",
            },
            // Тойм зураг (OverviewMap) — баруун доод булан
            "& .ol-custom-overviewmap": {
              bottom: "10px",
              right: "10px",
              left: "auto",
              top: "auto",
            },
            "& .ol-custom-overviewmap:not(.ol-collapsed)": {
              border: "1px solid rgba(0,0,0,0.2)",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            },
            "& .ol-custom-overviewmap .ol-overviewmap-map": {
              border: "none",
              width: "190px",
              height: "130px",
            },
            "& .ol-custom-overviewmap .ol-overviewmap-box": {
              border: "2px solid red",
            },
            "& .ol-custom-overviewmap:not(.ol-collapsed) button": {
              position: "absolute",
              top: "2px",
              right: "2px",
              bottom: "auto",
              left: "auto",
            },
            // Хумигдсан (default) — зөвхөн цэвэрхэн icon товч (switcher)
            "& .ol-custom-overviewmap.ol-collapsed": {
              border: "none",
              background: "transparent",
            },
            "& .ol-custom-overviewmap.ol-collapsed button": {
              position: "static",
              width: "32px",
              height: "32px",
              margin: 0,
              fontSize: "16px",
              lineHeight: 1,
              borderRadius: "8px",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              cursor: "pointer",
            },
            "& .ol-custom-overviewmap.ol-collapsed button:hover": {
              background: "#f2f4f7",
            },
          }}
        />

        {/* Field Calculator — талбарыг бөөнөөр шинэчлэх */}
        <FieldCalcDialog
          open={!!fieldCalcTab}
          tab={featureTabs.find((t) => t.key === fieldCalcTab)}
          selectedIds={
            featureTabs.find((t) => t.key === fieldCalcTab)?.selected
          }
          onClose={() => setFieldCalcTab(null)}
          onApplied={() => {
            if (fieldCalcTab) reloadTab(fieldCalcTab);
            recountLoadRef.current?.(recountAppliedCqlRef.current || "", false);
          }}
        />

        {/* Тооллогын мөр засах */}
        <RecountEditDialog
          open={!!editRow}
          row={editRow?.row}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            if (editRow?.tabKey) reloadTab(editRow.tabKey);
            recountLoadRef.current?.(recountAppliedCqlRef.current || "", false);
          }}
        />

        {/* Чанарын шалгалтын үр дүн */}
        <Dialog
          open={!!qualityReport}
          onClose={() => setQualityReport(null)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Чанарын шалгалт — {qualityReport?.label}</DialogTitle>
          <DialogContent dividers>
            {qualityReport?.loading && <CircularProgress size={22} />}
            {qualityReport?.error && (
              <Typography variant="body2" color="text.secondary">
                {qualityReport.error}
              </Typography>
            )}
            {!qualityReport?.loading &&
              !qualityReport?.error &&
              qualityReport && (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Нийт объект: <b>{qualityReport.total ?? "—"}</b> (шалгасан:{" "}
                    {qualityReport.checked})
                  </Typography>
                  <Typography variant="body2">
                    Геометргүй: <b>{qualityReport.noGeom}</b>
                  </Typography>
                  <Typography variant="body2">
                    {qualityReport.nameField
                      ? `Нэр (${qualityReport.nameField}) хоосон: `
                      : "Нэрийн талбар олдсонгүй: "}
                    <b>{qualityReport.noName ?? "—"}</b>
                  </Typography>
                </Stack>
              )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setQualityReport(null)}>Хаах</Button>
          </DialogActions>
        </Dialog>

        {/* QGIS маягийн мэдэгдлийн мөр — зургийн дээд ирмэгт */}
        {mapNotice && (
          <Box
            sx={{
              // ЗӨВХӨН зургийн талбай дээр (Удирдлага панелийн ард орохгүй)
              position: "absolute",
              top: 8,
              left: `${managePanelW + 8}px`,
              right: 8,
              zIndex: 1250,
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              boxShadow: 2,
              bgcolor: "#e8f2fe",
              border: "1px solid",
              borderColor: "#b6d4f5",
            }}
          >
            <Iconify
              icon="mdi:information-outline"
              sx={{ color: "#1565c0", flexShrink: 0 }}
            />
            <Typography variant="body2" sx={{ color: "#1565c0" }}>
              <b>{mapNotice.title}</b> {mapNotice.text}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setMapNotice(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* Тооллогын газрын зургийн legend — статус бүрийн өнгө + тоо */}
        {recountProjectId && (
          <RecountLegend
            statuses={recountStatuses}
            counts={recountStatusCounts}
          />
        )}

        {/* Улсын хэмжээ (ЗЗ нэгжгүй) шийдвэрийн тоо — zoom 2‑5 дээр */}
        {overlayLegal && legalNational != null && (
          <Paper
            elevation={6}
            sx={{
              position: "absolute",
              top: 8,
              left: { xs: 8, sm: 452 },
              zIndex: 1200,
              px: 1.5,
              py: 0.75,
              borderRadius: 1.5,
              bgcolor: "#1d4ed8",
              color: "#fff",
            }}
          >
            <Typography variant="subtitle2">
              Улсын хэмжээний шийдвэр: {legalNational}
            </Typography>
          </Paper>
        )}

        {/* Устгах баталгаажуулалт */}
        <Dialog open={!!legalDelRow} onClose={() => setLegalDelRow(null)}>
          <DialogTitle>Шийдвэр устгах</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              «{legalDelRow?.name}» шийдвэрийг устгах уу?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button color="inherit" onClick={() => setLegalDelRow(null)}>
              Болих
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleLegalDelete}
            >
              Устгах
            </Button>
          </DialogActions>
        </Dialog>

        <GeoserverDialog
          onNodeAction={handleRecountNodeAction}
          onWidthChange={setManagePanelW}
          enabledFilters={enabledGeoserverFilters}
          onFilterChange={handleGeoserverFilterChange}
          onFlyTo={handleFlyTo}
          onPanelClose={() => setForceGeoserverOpen(false)}
          geonameSearchTerm={geonameSearchTerm}
          onOrderChange={handleGeoserverOrderChange}
          onSearchChange={setGeoserverSearchValue}
          searchValue={geoserverSearchValue}
          filters={filters}
          setFilters={setFilters}
          networks={networks}
          systems={systems}
          aimags={aimags}
          soums={soums}
          onMeasurementSearchResults={handleSearchResults}
          onClearMeasurementResults={handleClearSearchResults}
          onStartDrawing={() =>
            handleStartDrawing((center, radius) => {
              if (!center || !radius) return;
              // Тойргийг 64 талт полигон болгож WFS‑д илгээнэ
              const ring = [];
              for (let i = 0; i <= 64; i += 1) {
                const a = (i / 64) * 2 * Math.PI;
                const dLat = (radius / 111320) * Math.sin(a);
                const dLon =
                  (radius /
                    (111320 * Math.cos((center[1] * Math.PI) / 180) || 1)) *
                  Math.cos(a);
                ring.push([center[0] + dLon, center[1] + dLat]);
              }
              runSpatialSelect(ring);
            })
          }
          onStopDrawing={handleStopDrawing}
          onDrawCircle={handleDrawCircle}
          onStartPickPoint={handleStartPickPoint}
          onStartDrawRectangle={() =>
            handleStartDrawRectangle((ring) => runSpatialSelect(ring))
          }
          onStartDrawPolygon={() =>
            handleStartDrawPolygon((ring) => runSpatialSelect(ring))
          }
          onClearSearchArea={handleClearSearchArea}
          onResults={handleNameSearchResults}
          onHighlightPoint={handleHighlightPoint}
          forceOpen={forceGeoserverOpen}
          forceTab={forceGeoserverTab}
          searchPointState={searchPointState}
          setSearchPointState={setSearchPointState}
          scaleDenom={scaleDenom}
          onRecountCql={setRecountCql}
          onProjectAreas={setProjectAreas}
          // «Шийдвэрийн сан» таб нээхэд ЗЗ нэгжийн хил + тооны overlay асна
          onTabChange={(t) => setOverlayLegal(t === "legal")}
          // Модны хүснэгтийн дүрс → доод хүснэгтэд ТАБ болгож нээнэ
          onLegalOpenList={openLegalTab}
        />
        <Box
          sx={{
            position: "absolute",
            top: 20,
            right: 20,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            zIndex: 0,
          }}
        >
          <Tooltip title="Давхарга" placement="right">
            <Fab
              size="small"
              onClick={handleLayerControlOpen}
              sx={{
                backgroundColor: "white",
                color: "#1976d2",
                "&:hover": {
                  backgroundColor: "#f5f5f5",
                  transform: "scale(1.05)",
                },
              }}
              id="map-basemap-toolbar"
            >
              <LayersIcon />
            </Fab>
          </Tooltip>

          <Tooltip
            title={isMeasuring ? "Хэмжилт дуусгах" : "Зай хэмжих"}
            placement="right"
          >
            <Fab
              size="small"
              onClick={toggleMeasure}
              id="map-measurement-toolbar"
              sx={{
                backgroundColor: isMeasuring ? "#ff9800" : "white",
                color: isMeasuring ? "white" : "#ff9800",
                "&:hover": {
                  backgroundColor: isMeasuring ? "#f57c00" : "#fff3e0",
                  transform: "scale(1.05)",
                },
              }}
            >
              <RulerIcon />
            </Fab>
          </Tooltip>

          {measureResult && (
            <Tooltip title="Хэмжилт цэвэрлэх" placement="right">
              <Fab
                size="small"
                onClick={clearMeasurements}
                sx={{
                  backgroundColor: "#f44336",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "#d32f2f",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <CloseIcon />
              </Fab>
            </Tooltip>
          )}

          {mdUp && (
            <Tooltip title="Бүтэн дэлгэц" placement="right">
              <Fab
                size="small"
                onClick={toggleFullscreen}
                id="map-fullscreen-toolbar"
                sx={{
                  backgroundColor: "white",
                  color: "#9c27b0",
                  "&:hover": {
                    backgroundColor: "#f3e5f5",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <FullscreenIcon />
              </Fab>
            </Tooltip>
          )}
        </Box>

        {measureResult && (
          <Paper
            elevation={3}
            sx={{
              position: "absolute",
              top: 20,
              right: mdUp ? 320 : 80,
              px: 2,
              py: 1,
              backgroundColor: "rgba(255, 152, 0, 0.9)",
              color: "white",
              borderRadius: 2,
              zIndex: 1000,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              Хэмжээс: {measureResult}
            </Typography>
          </Paper>
        )}

        {tabNameForm && (
          <Paper
            elevation={8}
            sx={{
              position: "fixed",
              top: tabNameForm.top,
              left: tabNameForm.left,
              zIndex: 1400,
              width: 340,
              maxHeight: "70vh",
              overflowY: "auto",
              borderRadius: 1,
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              onMouseDown={startTabFormDrag}
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: "#0675c9",
                color: "#fff",
                cursor: "move",
                userSelect: "none",
              }}
            >
              <Typography variant="subtitle2">
                {tabNameForm.mode === "link"
                  ? "Батлагдсан нэрийн байр зүйн холболт"
                  : "Шинэ нэр нэмэх"}
              </Typography>
              <IconButton
                size="small"
                sx={{ color: "#fff" }}
                onClick={() => {
                  clearDrawnGeom();
                  setTabNameForm(null);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            <MapAddName
              projectId={recountProjectId}
              presetType={tabNameForm.type}
              presetGeom={tabNameForm.geom}
              initialApproved={tabNameForm.mode === "link"}
              onClose={() => {
                clearDrawnGeom();
                setTabNameForm(null);
              }}
            />
          </Paper>
        )}

        <NameSidebar
          open={sidebarOpen}
          onClose={() => {
            setSidebarOpen(false);
            handleClearHighlight();
            linkLineSourceRef.current?.clear();
            nameGeomSourceRef.current?.clear();
          }}
          selectedName={selectedName}
          anchorPosition={anchorPosition}
          onAnchorPositionChange={setAnchorPosition}
        />
        <LayerControl
          open={layerControlOpen}
          anchorEl={layerControlAnchor}
          onClose={handleLayerControlClose}
          onLayerToggle={handleBaseLayerToggle}
          onOrderChange={handleBaseLayerOrderChange}
          onOpacityChange={handleBaseLayerOpacityChange}
          baseMap={baseMap}
          onBaseMapChange={setBaseMap}
          onBaseMapOpacityChange={handleBaseMapOpacityChange}
          baseMapOpacity={baseMapOpacity}
          onInactiveWmsToggle={handleInactiveWmsToggle}
          onInactiveWmsOpacityChange={handleInactiveWmsOpacityChange}
          recountEnabled={!!recountProjectId}
          recountVisible={recountOn}
          onToggleRecount={() => setRecountOn((v) => !v)}
          overlayLegal={overlayLegal}
          onToggleLegal={() => setOverlayLegal((v) => !v)}
          overlayOpacity={overlayOpacity}
          onOverlayOpacity={(key, val) =>
            setOverlayOpacity((prev) => ({ ...prev, [key]: val }))
          }
          baseConfigs={baseConfigs}
          overlayConfigs={overlayConfigs}
          extraOverlays={extraOverlayConfigs}
          extraOverlayOn={extraOverlayOn}
          onToggleExtraOverlay={handleToggleExtraOverlay}
        />

        {featureSelector.show && (
          <FeatureSelector
            features={featureSelector.features}
            position={featureSelector.position}
            onSelect={handleFeatureSelect}
            onClose={handleFeatureSelectorClose}
          />
        )}
      </Box>

      {/* Cursor байрлал (DMS) + масштаб — зургийн ДООД status bar.
          Зургийн (map-viewport) ГАДНА, бие даасан мөр: ямар ч хөвөгч форм/панел
          үүний цаагуур орохгүй, зураг өөрөө 26px‑ээр богиноснo. */}
      <Box
        sx={{
          flexShrink: 0,
          zIndex: 10,
          ml: `${managePanelW}px`,
          bgcolor: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(6px)",
          borderTop: "1px solid",
          borderColor: "divider",
          px: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1,
          height: 26,
        }}
      >
        {/* Солбицол — ЗҮҮН, масштаб — БАРУУН (сонгодог GIS байрлал).
              Панел нээлттэй үед мөр нь панелийн ард биш, хажуугаас эхэлнэ. */}
        {cursorCoords.lon !== null && (
          <>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                color: "text.secondary",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {toDMS(cursorCoords.lat, true)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "divider", lineHeight: 1 }}
            >
              |
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontFamily: "monospace",
                color: "text.secondary",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {toDMS(cursorCoords.lon, false)}
            </Typography>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {mapScale !== null && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              color: "text.secondary",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            1 : {mapScale.toLocaleString()}
          </Typography>
        )}
        <Box
          component="select"
          value=""
          onChange={(e) => {
            const s = Number(e.target.value);
            const map = mapObjRef.current;
            if (!s || !map) return;
            const lat = toLonLat(map.getView().getCenter())[1];
            const cosLat = Math.cos((lat * Math.PI) / 180);
            map.getView().setResolution((s * 0.0254) / (96 * cosLat));
          }}
          sx={{
            pointerEvents: "auto",
            fontFamily: "monospace",
            fontSize: 11,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0.5,
            bgcolor: "transparent",
            color: "text.secondary",
            height: 20,
            px: 0.5,
            cursor: "pointer",
            outline: "none",
            "&:hover": { borderColor: "text.primary" },
          }}
        >
          <option value="" disabled>
            Масштаб
          </option>
          {MAP_SCALE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              1 : {s.toLocaleString("en-US").replace(/,/g, " ")}
            </option>
          ))}
        </Box>
      </Box>

      {/* ─── Доод ATTRIBUTE хүснэгт — нээсэн ангилал бүрд таб, чирж өндөр солино ─── */}
      {featureTabs.length > 0 && (
        <>
          <Box
            onMouseDown={startSplitResize}
            sx={{
              height: 6,
              flexShrink: 0,
              ml: `${managePanelW}px`,
              cursor: "row-resize",
              bgcolor: "grey.200",
              borderTop: "1px solid",
              borderBottom: "1px solid",
              borderColor: "divider",
              "&:hover": { bgcolor: "primary.light" },
            }}
          />
          <Box
            sx={{
              height: splitH,
              flexShrink: 0,
              ml: `${managePanelW}px`,
              pl: 1.5,
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.paper",
              overflow: "hidden",
              borderLeft: managePanelW ? "1px solid" : "none",
              borderColor: "divider",
            }}
          >
            <Tabs
              value={activeTabKey || false}
              onChange={(e, v) => setActiveTabKey(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 36,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {featureTabs.map((t) => (
                <Tab
                  key={t.key}
                  value={t.key}
                  sx={{ minHeight: 36, textTransform: "none", pr: 0.5 }}
                  label={
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      {t.label}
                      <Box
                        component="span"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeFeatureTab(t.key);
                        }}
                        sx={{
                          display: "inline-flex",
                          borderRadius: "50%",
                          p: 0.2,
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </Box>
                    </Box>
                  }
                />
              ))}
            </Tabs>
            {featureTabs
              .filter((t) => t.key === activeTabKey)
              .map((t) =>
                t.kind === "legal" ? (
                  <React.Fragment key={t.key}>{renderLegalTab}</React.Fragment>
                ) : t.kind === "search" ? (
                  <React.Fragment key={t.key}>{renderSearchTab}</React.Fragment>
                ) : (
                  <FeatureTabPanel
                    key={t.key}
                    tab={t}
                    onPatch={(patch) => patchTab(t.key, patch)}
                    onClose={() => closeFeatureTab(t.key)}
                    onRowAction={(row, action) =>
                      handleRowAction(t.key, row, action)
                    }
                    onFieldCalc={() => setFieldCalcTab(t.key)}
                    onAddName={
                      recountProjectId && t.typeId && t.geomDesc
                        ? () => openTabNameForm(t, "new")
                        : undefined
                    }
                    onLinkName={
                      recountProjectId && t.typeId && t.geomDesc
                        ? () => openTabNameForm(t, "link")
                        : undefined
                    }
                    onZoomTo={(geometry) => {
                      const map = mapObjRef.current;
                      if (!map || !geometry) return;
                      try {
                        const g = new GeoJSON().readGeometry(geometry, {
                          dataProjection: "EPSG:4326",
                          featureProjection: map.getView().getProjection(),
                        });
                        map.getView().fit(g.getExtent(), {
                          duration: 400,
                          padding: [80, 80, 80, 80],
                          maxZoom: 16,
                        });
                      } catch (e) {
                        /* алгасна */
                      }
                    }}
                  />
                ),
              )}
          </Box>
        </>
      )}
    </Box>
  );
}

export default Map2;
