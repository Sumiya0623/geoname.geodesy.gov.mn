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
  Table,
  Paper,
  Tooltip,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  TableContainer,
  InputAdornment,
  TablePagination,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  Layers as LayersIcon,
  Straighten as RulerIcon,
  PlaceOutlined as PlaceIcon,
  Search as SearchIcon,
} from "@mui/icons-material";

import "ol/ol.css";
import "ol-layerswitcher/dist/ol-layerswitcher.css";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import LayerGroup from "ol/layer/Group";
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
import { fromLonLat, transform, transformExtent } from "ol/proj";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import CircleStyle from "ol/style/Circle";
import Text from "ol/style/Text";
import { getDistance, getLength } from "ol/sphere";
import Draw, { createBox } from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import GeoJSON from "ol/format/GeoJSON";
import { boundingExtent } from "ol/extent";
import {
  registerMapDraw,
  registerMapExtent,
} from "../../components/map/mapDraw";
import NameSidebar from "../../components/map/NameSidebar";
import LayerControl from "../../components/map/LayerControl";

import FeatureSelector from "../../components/map/FeatureSelector";

import {
  buildLayersByName,
  makeViewWmtsLayer,
  makeGwcWmtsLayer,
} from "./layers-wmts";
import { createLegalOverlay } from "./legal-overlay";
import { useGetGeoserver, useGetBaseLayers } from "src/api/map";
import GeoserverDialog from "src/components/map/geoserverDialog";
import MapHeader from "src/components/map/MapHeader";
import axiosInstance, { endpoints } from "src/utils/axios";
import { usePathname } from "next/navigation";
import "./style.css";
import ScaleBadge from "src/components/map/ScaleBadge";
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
const RADIUS_FILL_COLOR = "rgba(33, 150, 243, 0.1)";
const RADIUS_STROKE_COLOR = "#2196f3";
const RADIUS_CENTER_STROKE_COLOR = "white";
const CHATBOT_OUTER_FILL_COLOR = "rgba(255,215,0,0.3)";

const buildWmsParams = (overrides = {}) => ({ ...WMS_PARAMS, ...overrides });
const buildAdminWmsParams = (overrides = {}) => ({
  ...ADMIN_WMS_PARAMS,
  ...overrides,
});

// Backend‑ийн BaseMapLayer тохиргооноос OpenLayers давхарга байгуулна.
// source_type: osm | xyz | wms | wmts. params: {maxZoom, cached, styles, cql}.
function buildOlBaseLayer(cfg) {
  const p = cfg?.params || {};
  const st = cfg?.source_type;
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
    // params.wmts_max өгвөл: z≤wmts_max GWC кэш, z>wmts_max АМЬД WMS (чанар
    // унахгүй — WMS эх өгөгдлөөс бүрэн нягтралаар рендерлэнэ). Group‑оор нэгтгэнэ.
    const wmtsMax = Number(p.wmts_max ?? p.wmtsMax);
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
  let LayerSwitcher;
  if (typeof window !== "undefined") {
    const mod = require("ol-layerswitcher");
    LayerSwitcher = mod?.default || mod;
  }
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
  const recountLayerRef = useRef(null);
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
  const [legalDocsPage, setLegalDocsPage] = useState(1); // 1‑based
  const [legalDocsSearch, setLegalDocsSearch] = useState("");
  const [legalDocsLoading, setLegalDocsLoading] = useState(false);
  const [legalNational, setLegalNational] = useState(null);
  const LEGAL_PAGE_SIZE = 10;
  // Overlay давхаргуудын ил тод байдал (key→0..1)
  const [overlayOpacity, setOverlayOpacity] = useState({
    BASEMAP: 1,
    NOMENCLATURE: 1,
    DEM: 0.85,
  });
  const [selectedName, setSelectedName] = useState(null);
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
  const NAME_PAGE_SIZE = 50;
  // Илэрцийн хүснэгтийг чирж хэмжээ өөрчлөх (resizable)
  const [resTableSize, setResTableSize] = useState(null); // {w,h} px | null=default
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
  const [systemUiItems, setSystemUiItems] = useState([]);

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

  const legendLayers = useMemo(
    () =>
      systemUiItems.map((it) => {
        const layerName = `point:${it.layer}`;
        const legendUrl = `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms?SERVICE=WMS&REQUEST=GetLegendGraphic&FORMAT=image/png&LAYER=${layerName}`;
        return {
          url: legendUrl,
          title: it.name,
        };
      }),
    [systemUiItems],
  );

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
  const chatbotHighlightStyles = useMemo(
    () => [
      new Style({
        image: new CircleStyle({
          radius: 15,
          fill: new Fill({ color: CHATBOT_OUTER_FILL_COLOR }),
        }),
      }),
      new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: "#FFD700" }),
          stroke: new Stroke({ color: "#ffffff", width: 3 }),
        }),
      }),
    ],
    [],
  );

  const getSinglePointStyle = (color = "#1976d2") => [
    new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: "rgba(0,0,0,0.15)" }),
      }),
    }),
    new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    }),
  ];

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

  const buildPointCqlFilter = useCallback(() => {
    const conditions = [];
    if (filters.network) conditions.push(`network_id=${filters.network}`);
    if (filters.system) conditions.push(`system_id=${filters.system}`);
    if (filters.number) conditions.push(`number ILIKE '%${filters.number}%'`);

    if (filters.soum) {
      const soum = soums.find((s) => String(s.id) === String(filters.soum));
      if (soum && soum.id) {
        conditions.push(
          `INTERSECTS(geoloc, querySingle('point:core_adminunit', 'geom', 'fid=''adminUnit.${soum.id}'''))`,
        );
      }
    } else if (filters.aimag) {
      const aimag = aimags.find((a) => String(a.id) === String(filters.aimag));
      if (aimag && aimag.id) {
        conditions.push(
          `INTERSECTS(geoloc, querySingle('point:core_adminunit', 'geom', 'fid=''adminUnit.${aimag.id}'''))`,
        );
      }
    }
    return conditions.length > 0 ? conditions.join(" AND ") : null;
  }, [
    filters.network,
    filters.system,
    filters.number,
    filters.soum,
    filters.aimag,
    soums,
    aimags,
  ]);

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
        // Нэрийн ангилал — ГАНЦ geoname_view.
        // zoom <11: default style geoname_types — ерөнхийлсөн, давхцах label
        //           нуугдана, цэвэрхэн.
        // zoom ≥11: geoname_types_full style — ЕРӨНХИЙЛӨЛГҮЙ (бүх нэр, давхцал
        //           арилгахгүй: conflictResolution=false).
        // CQL‑ээр төрөл (+ сонгосон нэгж) шүүнэ.
        // ЧУХАЛ: geoname_view‑ийн GWC давхаргад parameterFilters ХООСОН тул
        // gwc/service/wms нь CQL_FILTER‑ийг ҮЛ ТООМСОРЛОН кэшлэсэн (шүүлтгүй)
        // тайлыг буцаадаг → ямар ч ангилал сонгосон БҮХ нэр харагдана. Иймд
        // амьд /geoname/wms‑ээр дуудна: GeoServer‑ийн direct WMS integration
        // CQL байвал кэшийг алгасаж, зөв шүүсэн тайл рендерлэнэ.
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
          // zoom ≥11 — ЕРӨНХИЙЛӨЛГҮЙ style (бүх нэр)
          const liveLayer = new ImageLayer({
            source: new ImageWMS({
              url: `${gsBase}/geoname/wms`,
              params: { ...wmsParams, STYLES: "geoname_types_full" },
              serverType: "geoserver",
              crossOrigin: "anonymous",
              ratio: 1,
            }),
            opacity: 0.9,
            visible: true,
            minZoom: 11, // z≥11 — ерөнхийлөлгүй
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
          // Зөвхөн state тавина — доорх effect нь хайлт/хуудаслалтаар татна
          setLegalDocsSearch("");
          setLegalDocsPage(1);
          setLegalDocsUnit({
            id: props.id,
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
        const qs = new URLSearchParams({
          map_unit: String(legalDocsUnit.id),
          page: String(legalDocsPage),
          page_size: String(LEGAL_PAGE_SIZE),
          ordering: "-order_date",
        });
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
  }, [legalDocsUnit, legalDocsPage, legalDocsSearch]);

  // Дэлгэрэнгүй хайлтаас илэрц ирэхэд ({params, count}) — хуудаслалттай хүснэгт
  const handleNameSearchResults = useCallback((meta) => {
    if (!meta || !meta.count) {
      setSearchQuery(null);
      setSearchPage(0);
      setNameResults([]);
      return;
    }
    setSearchQuery(meta);
    setSearchPage(0);
  }, []);

  // Идэвхтэй хайлтын одоогийн хуудсыг серверээс татна
  useEffect(() => {
    if (!searchQuery) return undefined;
    let active = true;
    setNameResultsLoading(true);
    (async () => {
      try {
        const q = new URLSearchParams({
          ...searchQuery.params,
          page: searchPage + 1,
          page_size: NAME_PAGE_SIZE,
        }).toString();
        const res = await axiosInstance.get(endpoints.geoname.list(q));
        if (active) setNameResults(res?.data?.results || []);
      } catch (e) {
        if (active) setNameResults([]);
      } finally {
        if (active) setNameResultsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchPage]);

  // Илэрцийн хүснэгтийн баруун‑доод булангаас чирж хэмжээ өөрчлөх
  const startResTableResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const paper = e.currentTarget.parentElement;
    const rect = paper.getBoundingClientRect();
    resDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      w: rect.width,
      h: rect.height,
    };
    const onMove = (ev) => {
      const d = resDragRef.current;
      if (!d) return;
      setResTableSize({
        w: Math.max(320, d.w + (ev.clientX - d.startX)),
        h: Math.max(160, d.h + (ev.clientY - d.startY)),
      });
    };
    const onUp = () => {
      resDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

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

  const zoomIn = () => {
    const view = mapObjRef.current && mapObjRef.current.getView();
    if (view) view.animate({ zoom: view.getZoom() + 1, duration: 300 });
  };

  const zoomOut = () => {
    const view = mapObjRef.current && mapObjRef.current.getView();
    if (view) view.animate({ zoom: view.getZoom() - 1, duration: 300 });
  };

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
      const cleanup = () => {
        map.removeInteraction(draw);
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

  // Map2 ↔ popup гүүр — зурах функцийг бүртгэнэ
  useEffect(() => {
    registerMapDraw(startTypedDraw);
    return () => registerMapDraw(null);
  }, [startTypedDraw]);

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

  // Тодруулалт — тухайн төслийн recount (ReCount.loc) WMS давхарга
  useEffect(() => {
    if (!recountProjectId) return undefined;
    let layer = null;
    let cancelled = false;
    const attach = () => {
      const map = mapObjRef.current;
      if (cancelled) return;
      if (!map) {
        setTimeout(attach, 300);
        return;
      }
      // GeoServer‑т recount view (recount_view)‑ийг нийтлүүлэх (байхгүй бол)
      axiosInstance
        .get(
          endpoints.recount.wms(
            new URLSearchParams({ project: recountProjectId }).toString(),
          ),
        )
        .catch(() => {});
      // WMS — GeoServer‑ийн type symbol style‑аар, төслийн id‑р CQL шүүлттэй.
      // ImageWMS (тайл БИШ, харагдах хэсгийг НЭГ зураг) — recount цөөн тул тайлын
      // де‑confliction/захын таслалтгүйгээр БҮХ label харагдана (geoname_types_full).
      const GS = process.env.NEXT_PUBLIC_GEOSERVER_URL;
      layer = new ImageLayer({
        source: new ImageWMS({
          url: `${GS}/geoname/wms`,
          params: {
            LAYERS: "geoname:recount_view",
            STYLES: "geoname_types_full",
            FORMAT: "image/png",
            TRANSPARENT: true,
            CQL_FILTER: `project_id=${recountProjectId}`,
          },
          serverType: "geoserver",
          crossOrigin: "anonymous",
        }),
        zIndex: 60,
      });
      recountLayerRef.current = layer;
      layer.setVisible(recountOn);
      map.addLayer(layer);
    };
    attach();
    return () => {
      cancelled = true;
      const map = mapObjRef.current;
      if (layer && map) map.removeLayer(layer);
      recountLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recountProjectId]);

  // Тодруулалт checkbox‑ийн харагдах байдал
  useEffect(() => {
    if (recountLayerRef.current) recountLayerRef.current.setVisible(recountOn);
  }, [recountOn]);

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
      const layer = createCqlWmsLayer([pointId], {
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

  const handleShowOnMap = useCallback(
    (pointData) => {
      const map = mapObjRef.current;
      if (!map || !pointData) return;

      let coords;
      if (pointData.coordinates) {
        coords = pointData.coordinates;
      } else if (pointData.longitude && pointData.latitude) {
        coords = [
          parseFloat(pointData.longitude),
          parseFloat(pointData.latitude),
        ];
      } else {
        return;
      }

      const [lon, lat] = coords;

      if (isNaN(lon) || isNaN(lat)) return;

      const view = map.getView();
      const pointCoords = fromLonLat([lon, lat]);

      view.animate({
        center: pointCoords,
        duration: 1000,
      });

      const source = measurementSearchSourceRef.current;
      if (source) {
        source.clear();

        const highlightFeature = new Feature({
          geometry: new Point(pointCoords),
          name: "chatbot-highlight",
          measurement: pointData.pointData,
          point: pointData.point,
        });

        highlightFeature.setStyle(chatbotHighlightStyles);

        source.addFeature(highlightFeature);
      }
    },
    [chatbotHighlightStyles],
  );

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

  const showPointsWithCurrentFilters = useCallback(
    (additionalCql = "") => {
      const currentCql = buildPointCqlFilter();
      let finalCql = currentCql || "";

      if (additionalCql) {
        finalCql = finalCql
          ? `${finalCql} AND ${additionalCql}`
          : additionalCql;
      }

      if (!finalCql) {
        console.warn("No CQL filter available");
        return;
      }

      if (cqlWmsLayerRef.current) {
        mapObjRef.current.removeLayer(cqlWmsLayerRef.current);
        cqlWmsLayerRef.current = null;
      }

      cqlWmsSourceRef.current = new TileWMS({
        url: WMS_URL,
        params: buildWmsParams({
          TILED: true,
          CQL_FILTER: finalCql,
          STYLES: "filtered_points",
        }),
        serverType: "geoserver",
      });

      // Debug: WMS for filter‑based showPointsWithCurrentFilters
      // eslint-disable-next-line no-console
      console.log("[WMS DEBUG] showPointsWithCurrentFilters", {
        url: WMS_URL,
        cql: finalCql,
      });

      cqlWmsLayerRef.current = new TileLayer({
        source: cqlWmsSourceRef.current,
        opacity: 0.8,
        zIndex: 1000,
      });

      mapObjRef.current.addLayer(cqlWmsLayerRef.current);

      return cqlWmsLayerRef.current;
    },
    [buildPointCqlFilter],
  );

  function findPointRadius() {
    setForceGeoserverOpen(true);
    setForceGeoserverTab("layers");
  }

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
          }}
        />

        {/* Их хэмжээний хайлтын илэрц — газрын зургийн дээд талд тусдаа хүснэгт,
            формын ард (z-index формоос бага) */}
        {searchQuery && searchQuery.count > 0 && (
          <Paper
            elevation={6}
            sx={{
              position: "absolute",
              top: 8,
              left: { xs: 8, sm: 452 }, // формын (440) ард талаас эхлэх
              right: resTableSize?.w ? "auto" : 8,
              width: resTableSize?.w ?? undefined,
              height: resTableSize?.h ?? undefined,
              zIndex: 1200, // формоос (1201) бага
              maxHeight: resTableSize?.h ? "none" : "45%",
              minWidth: 320,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                py: 0.75,
                bgcolor: "#0675c9",
                color: "#fff",
              }}
            >
              <Typography variant="subtitle2">
                Хайлтын илэрц — {searchQuery.count}
              </Typography>
              <IconButton
                size="small"
                onClick={() => {
                  setSearchQuery(null);
                  setNameResults([]);
                }}
                sx={{ color: "#fff" }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
            <TableContainer sx={{ flex: 1, overflowY: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>№</TableCell>
                    <TableCell>Нэр</TableCell>
                    <TableCell>Дугаар</TableCell>
                    <TableCell>Солбицол</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {nameResults.map((it, i) => {
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
                          {searchPage * NAME_PAGE_SIZE + i + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {it.name || "—"}
                        </TableCell>
                        <TableCell>{it.number}</TableCell>
                        <TableCell>
                          {it.lat != null
                            ? `${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!nameResultsLoading && nameResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Ачаалж байна…
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {searchQuery.count > NAME_PAGE_SIZE && (
              <TablePagination
                component="div"
                count={searchQuery.count}
                page={searchPage}
                onPageChange={(e, p) => setSearchPage(p)}
                rowsPerPage={NAME_PAGE_SIZE}
                rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} / ${count}`
                }
                sx={{
                  borderTop: (t) => `1px solid ${t.palette.divider}`,
                  "& .MuiTablePagination-toolbar": { minHeight: 40 },
                }}
              />
            )}
            {/* Хэмжээ өөрчлөх бариул (баруун‑доод булан) */}
            <Box
              onMouseDown={startResTableResize}
              sx={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: 18,
                height: 18,
                cursor: "nwse-resize",
                zIndex: 3,
                "&::after": {
                  content: '""',
                  position: "absolute",
                  right: 3,
                  bottom: 3,
                  width: 8,
                  height: 8,
                  borderRight: "2px solid #94a3b8",
                  borderBottom: "2px solid #94a3b8",
                },
              }}
            />
          </Paper>
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

        {/* Badge дээр дарахад — тухайн нэгжийн шийдвэрүүд */}
        {legalDocsUnit && (
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bottom: 8,
              width: { xs: "calc(100% - 16px)", sm: 460 },
              maxHeight: "calc(100% - 16px)",
              zIndex: 1300,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                py: 0.75,
                bgcolor: "#1d4ed8",
                color: "#fff",
              }}
            >
              <Typography variant="subtitle2" noWrap>
                {legalDocsUnit.name} — {legalDocsUnit.count} шийдвэр
              </Typography>
              <IconButton
                size="small"
                onClick={() => {
                  setLegalDocsUnit(null);
                  setLegalDocs([]);
                  setLegalDocsSearch("");
                  setLegalDocsPage(1);
                }}
                sx={{ color: "#fff" }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Хайлт */}
            <Box sx={{ px: 1.5, py: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Нэр, дугаараар хайх…"
                value={legalDocsSearch}
                onChange={(e) => {
                  setLegalDocsSearch(e.target.value);
                  setLegalDocsPage(1);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: "text.disabled" }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TableContainer sx={{ flex: 1, overflowY: "auto" }}>
              {legalDocsLoading ? (
                <Box
                  sx={{ py: 3, textAlign: "center", color: "text.secondary" }}
                >
                  <Typography variant="body2">Ачаалж байна…</Typography>
                </Box>
              ) : (
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={32}>Nº</TableCell>
                      <TableCell>Нэр</TableCell>
                      <TableCell width={96}>Огноо</TableCell>
                      <TableCell width={64}>Дугаар</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {legalDocs.map((d, i) => (
                      <TableRow key={d.id} hover>
                        <TableCell>
                          {(legalDocsPage - 1) * LEGAL_PAGE_SIZE + i + 1}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                        <TableCell>{d.order_date || "—"}</TableCell>
                        <TableCell>{d.order_number || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {!legalDocs.length && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          Шийдвэр алга
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </TableContainer>

            {/* Хуудаслалт */}
            {legalDocsCount > LEGAL_PAGE_SIZE && (
              <TablePagination
                component="div"
                count={legalDocsCount}
                page={legalDocsPage - 1}
                onPageChange={(e, p) => setLegalDocsPage(p + 1)}
                rowsPerPage={LEGAL_PAGE_SIZE}
                rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} / ${count}`
                }
                sx={{
                  borderTop: (t) => `1px solid ${t.palette.divider}`,
                  "& .MuiTablePagination-toolbar": { minHeight: 44 },
                }}
              />
            )}
          </Paper>
        )}

        <GeoserverDialog
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
          baseMap={baseMap}
          setBaseMap={setBaseMap}
          onMeasurementSearchResults={handleSearchResults}
          onClearMeasurementResults={handleClearSearchResults}
          onStartDrawing={handleStartDrawing}
          onStopDrawing={handleStopDrawing}
          onDrawCircle={handleDrawCircle}
          onStartPickPoint={handleStartPickPoint}
          onStartDrawRectangle={handleStartDrawRectangle}
          onStartDrawPolygon={handleStartDrawPolygon}
          onClearSearchArea={handleClearSearchArea}
          onResults={handleNameSearchResults}
          onHighlightPoint={handleHighlightPoint}
          forceOpen={forceGeoserverOpen}
          forceTab={forceGeoserverTab}
          searchPointState={searchPointState}
          setSearchPointState={setSearchPointState}
          scaleDenom={scaleDenom}
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

          <Tooltip title="Цэг хайх" placement="right">
            <Fab
              size="small"
              onClick={findPointRadius}
              id="map-search-toolbar"
              sx={{
                backgroundColor: "white",
                color: "#27b02eff",
                "&:hover": {
                  backgroundColor: "#f3e5f5",
                  transform: "scale(1.05)",
                },
              }}
            >
              <PlaceIcon />
            </Fab>
          </Tooltip>
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
        <ScaleBadge scaleDenom={scaleDenom} mdUp={mdUp} />

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
    </Box>
  );
}

export default Map2;
