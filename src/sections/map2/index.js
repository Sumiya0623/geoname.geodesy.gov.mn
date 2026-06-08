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
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  TableContainer,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  Layers as LayersIcon,
  Straighten as RulerIcon,
  PlaceOutlined as PlaceIcon,
} from "@mui/icons-material";

import "ol/ol.css";
import "ol-layerswitcher/dist/ol-layerswitcher.css";
import TileLayer from "ol/layer/Tile";
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
import { boundingExtent } from "ol/extent";
import NameSidebar from "../../components/map/NameSidebar";
import LayerControl from "../../components/map/LayerControl";

import FeatureSelector from "../../components/map/FeatureSelector";

import { buildLayersByName } from "./layers-wmts";
import { useGetGeoserver } from "src/api/map";
import GeoserverDialog from "src/components/map/geoserverDialog";
import MapHeader from "src/components/map/MapHeader";
import axiosInstance, { endpoints } from "src/utils/axios";
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
  // Их хэмжээний (100+) хайлтын илэрцийг газрын зургийн дээд талд жагсаах
  const [nameResults, setNameResults] = useState([]);
  const [featureSelector, setFeatureSelector] = useState({
    show: false,
    features: [],
    position: { x: 0, y: 0 },
  });

  const { geoserver } = useGetGeoserver();

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
  const aimags = [];
  const soums = [];
  const networks = [];
  const systems = [];

  // ----- Basemap choices as LAYERS (so we can include LayerGroup too)
  const baseMapLayers = useMemo(
    () => ({
      CRV: new TileLayer({
        source: new XYZ({
          url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        }),
      }),
      OSM: new TileLayer({ source: new OSM() }),
      GMS: new TileLayer({
        source: new XYZ({
          url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        }),
      }),
      ESRI: new TileLayer({
        source: new XYZ({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maxZoom: 19,
        }),
      }),
      TOPO: new TileLayer({
        source: new XYZ({
          url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
          maxZoom: 17,
        }),
      }),
      M100k: new TileLayer({
        source: new TileWMS({
          url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/gwc/service/wms`,
          params: {
            LAYERS: "point:raster",
            STYLES: "",
            FORMAT: "image/png",
            TRANSPARENT: "true",
            TILED: "true",
            VERSION: "1.1.1",
          },
          crossOrigin: "anonymous",
          serverType: "geoserver",
        }),
      }),
      BASEMAP: new TileLayer({
        source: new TileWMS({
          url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms`,
          params: {
            LAYERS: "point:basemap",
            FORMAT: "image/png",
            TRANSPARENT: true,
            VERSION: "1.1.1",
          },
          serverType: "geoserver",
          crossOrigin: "anonymous",
        }),
      }),
      NOMENCLATURE: new TileLayer({
        source: new TileWMS({
          url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/point/wms`,
          params: {
            LAYERS: "point:nomeklatur",
            FORMAT: "image/png",
            TRANSPARENT: true,
            VERSION: "1.1.1",
          },
          serverType: "geoserver",
          crossOrigin: "anonymous",
        }),
      }),
    }),
    [],
  );

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

    return () => {
      if (cleanup && typeof cleanup === "function") {
        cleanup();
      }
      if (mapObjRef.current) {
        mapObjRef.current.setTarget(null);
        mapObjRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        onAdvanced={() => setForceGeoserverOpen(true)}
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
        {nameResults.length > 0 && (
          <Paper
            elevation={6}
            sx={{
              position: "absolute",
              top: 8,
              left: { xs: 8, sm: 452 }, // формын (440) ард талаас эхлэх
              right: 8,
              zIndex: 1200, // формоос (1201) бага
              maxHeight: "45%",
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
                Хайлтын илэрц — {nameResults.length}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setNameResults([])}
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
                        <TableCell>{i + 1}</TableCell>
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
                </TableBody>
              </Table>
            </TableContainer>
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
          onResults={setNameResults}
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
