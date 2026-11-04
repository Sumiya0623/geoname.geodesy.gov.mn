"use client";

// Скан топо зургаас нэр таних (nameqc) — таамаглалыг харах, засах, шошголох.
// Таамаглал/шошго нь nameqc_detection хүснэгтэд (backend /api/n/ml-detection/),
// бага зумд GeoServer-ийн geoname:nameqc_detection WMS-ээр, ойртоход засах
// боломжтой вектор давхаргаар харагдана. Даалгавар = газар дээр хэмжсэн
// тодруулалтын цэг (nameqc_task): эргэн тойрных нь БҮХ бичвэрийг шошгоно.

import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";
import Polygon from "ol/geom/Polygon";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import GeoJSON from "ol/format/GeoJSON";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Draw from "ol/interaction/Draw";
import Select from "ol/interaction/Select";
import Modify from "ol/interaction/Modify";
import Translate from "ol/interaction/Translate";
import { click } from "ol/events/condition";
import { fromLonLat, transformExtent } from "ol/proj";
import { Fill, Style, Stroke, Text, Circle as CircleStyle, RegularShape } from "ol/style";
import { useRef, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Paper,
  Button,
  Divider,
  Tooltip,
  TextField,
  Typography,
  ToggleButton,
  LinearProgress,
  ToggleButtonGroup,
} from "@mui/material";

import { RouterLink } from "src/routes/components";
import { useGetBaseLayers } from "src/api/map";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";
import { buildOlBaseLayer } from "src/sections/map/layers-wmts";

const GEOSERVER = process.env.NEXT_PUBLIC_GEOSERVER_URL;
const BATCH = 1;
const EDIT_ZOOM = 14; // үүнээс ойрт вектор (засах), холд WMS
const TASK_ZOOM = 15.5;
const DEFAULT_BASE = "1970_100k";

// geoname:nameqc_detection SLD-тэй ижил өнгө
export const CLASSES = [
  { key: "name", label: "Нэр", color: "#00c853", hot: "1" },
  { key: "number", label: "Тоо", color: "#2962ff", hot: "2" },
  { key: "other", label: "Бусад бичвэр", color: "#ff9100", hot: "3" },
  { key: "struck", label: "Хүчингүй (дарсан)", color: "#757575", hot: "4" },
  { key: "unknown", label: "Ангилаагүй", color: "#d500f9", hot: "" },
];
const COLOR = Object.fromEntries(CLASSES.map((c) => [c.key, c.color]));

const geojson = new GeoJSON({ dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" });

function detStyle(feature, selected) {
  const p = feature.getProperties();
  if (p.kind === "symbol") {
    return new Style({
      image: new RegularShape({
        points: 4,
        radius: selected ? 12 : 9,
        radius2: 0,
        angle: Math.PI / 4,
        stroke: new Stroke({ color: selected ? "#ffd600" : "#e53935", width: 3 }),
      }),
    });
  }
  const color = COLOR[p.cls] || COLOR.unknown;
  const confirmed = p.status === "confirmed";
  const styles = [
    new Style({
      stroke: new Stroke({
        color: selected ? "#ffd600" : color,
        width: selected ? 4 : confirmed ? 3 : 2,
        lineDash: confirmed || selected ? undefined : [8, 4],
      }),
      fill: new Fill({ color: confirmed ? `${color}22` : "rgba(0,0,0,0)" }),
      text:
        p.text && (confirmed || selected)
          ? new Text({
              text: p.text,
              font: "bold 13px sans-serif",
              fill: new Fill({ color: "#000" }),
              stroke: new Stroke({ color: "#fff", width: 3 }),
              overflow: true,
            })
          : undefined,
    }),
  ];
  // Даалгаврын нэртэй холбоотой хүрээ — булангийн тэмдэг
  if (p.recount_id) {
    styles.push(
      new Style({
        stroke: new Stroke({ color: "#e53935", width: 1.5 }),
      }),
    );
  }
  return styles;
}

function taskStyle(feature, currentId) {
  const p = feature.getProperties();
  const current = p.id === currentId;
  const color = current ? "#e53935" : p.status === "done" ? "#00c853" : p.status === "skip" ? "#9e9e9e" : "#ff6d00";
  // Шугаман (ам, гол) / талбайн (нуур) нэрийн жинхэнэ хэлбэр
  if (p.isShape) {
    return new Style({
      stroke: new Stroke({ color, width: current ? 3 : 1.5, lineDash: current ? undefined : [6, 4] }),
      fill: new Fill({ color: current ? "rgba(229,57,53,0.08)" : "rgba(0,0,0,0)" }),
    });
  }
  return new Style({
    image: new CircleStyle({
      radius: current ? 11 : 7,
      fill: new Fill({ color: current ? "rgba(229,57,53,0.15)" : "rgba(0,0,0,0)" }),
      stroke: new Stroke({ color, width: current ? 4 : 2.5 }),
    }),
  });
}

// 3 товшилт: суурь шугамын 2 үзүүр + өндөр → налуу тэгш өнцөгт
function rotatedBox(coords, geom) {
  const pts = coords.slice(0, 3);
  const [a, b] = pts;
  let ring;
  if (!b) {
    ring = [a, a, a, a, a];
  } else {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const c = pts[2];
    const h = c ? (c[0] - a[0]) * nx + (c[1] - a[1]) * ny : 0;
    ring = [a, b, [b[0] + nx * h, b[1] + ny * h], [a[0] + nx * h, a[1] + ny * h], a];
  }
  const g = geom || new Polygon([ring]);
  g.setCoordinates([ring]);
  return g;
}

export default function MapMlView() {
  const { enqueueSnackbar } = useSnackbar();
  const { baseLayers: baseCfgs } = useGetBaseLayers();

  const elRef = useRef(null);
  const mapRef = useRef(null);
  const detSrcRef = useRef(null);
  const taskSrcRef = useRef(null);
  const taskLayerRef = useRef(null);
  const wmsRef = useRef(null);
  const selectRef = useRef(null);
  const drawRef = useRef(null);
  const currentRef = useRef(null);

  const [mode, setMode] = useState("select"); // select | box | symbol
  const [task, setTask] = useState(null);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null); // ol Feature
  const [selProps, setSelProps] = useState(null);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState(0);
  // review = автомат шошгыг зөв/буруу гэж шалгах (үндсэн), edit = гараар засах
  const [view, setView] = useState("review");
  const [review, setReview] = useState(null);
  const [rstats, setRstats] = useState(null);
  const reviewSrcRef = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  currentRef.current = task;

  // ---------------------------------------------------------------- өгөгдөл

  const loadStats = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(endpoints.ml.taskStats(`batch=${BATCH}`));
      setStats(data);
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Статистик ачаалж чадсангүй", { variant: "error" });
    }
  }, [enqueueSnackbar]);

  const reloadVectors = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const view = map.getView();
    const ext = transformExtent(view.calculateExtent(map.getSize()), "EPSG:3857", "EPSG:4326");
    const bbox = ext.map((v) => v.toFixed(6)).join(",");
    try {
      const [tasks, dets] = await Promise.all([
        axiosInstance.get(endpoints.ml.task(`batch=${BATCH}&bbox=${bbox}`)),
        view.getZoom() >= EDIT_ZOOM
          ? axiosInstance.get(endpoints.ml.detection(`bbox=${bbox}`))
          : Promise.resolve(null),
      ]);
      taskSrcRef.current.clear();
      const taskFeats = geojson.readFeatures(tasks.data);
      const shapes = tasks.data.features
        .filter((t) => t.properties.shape)
        .map((t) => {
          const f = geojson.readFeature({ type: "Feature", geometry: t.properties.shape, properties: {} });
          f.setProperties({ id: t.id, status: t.properties.status, isShape: true, shape: null });
          return f;
        });
      taskSrcRef.current.addFeatures([...shapes, ...taskFeats]);
      const keepId = selectRef.current?.getFeatures().item(0)?.getId();
      detSrcRef.current.clear();
      if (dets) {
        detSrcRef.current.addFeatures(geojson.readFeatures(dets.data));
        if (keepId != null) {
          const f = detSrcRef.current.getFeatureById(keepId);
          selectRef.current.getFeatures().clear();
          if (f) selectRef.current.getFeatures().push(f);
          else setSelected(null);
        }
      }
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Давхарга ачаалж чадсангүй", { variant: "error" });
    }
  }, [enqueueSnackbar]);

  const refreshWms = useCallback(() => {
    wmsRef.current?.getSource().updateParams({ _t: Date.now() });
  }, []);

  const goTo = useCallback((feature) => {
    if (!feature || !mapRef.current) return;
    const [lon, lat] = feature.geometry.coordinates;
    mapRef.current.getView().animate({ center: fromLonLat([lon, lat]), zoom: TASK_ZOOM, duration: 400 });
  }, []);

  const nextTask = useCallback(
    async (after) => {
      try {
        const q = `batch=${BATCH}${after ? `&after=${after}` : ""}`;
        const { data } = await axiosInstance.get(endpoints.ml.taskNext(q));
        setTask(data);
        if (data && viewRef.current === "edit") goTo(data);
        else enqueueSnackbar("Шошголох даалгавар дууссан", { variant: "success" });
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.detail || "Даалгавар ачаалж чадсангүй", { variant: "error" });
      }
    },
    [enqueueSnackbar, goTo],
  );

  const viewBbox = () => {
    const map = mapRef.current;
    const ext = transformExtent(map.getView().calculateExtent(map.getSize()), "EPSG:3857", "EPSG:4326");
    return ext.map((v) => v.toFixed(6)).join(",");
  };

  const finishTask = useCallback(
    async (status) => {
      if (!task) return;
      try {
        // «Дууссан» = дэлгэцэн дээрх бүх бичвэрийг шалгасан → үлдсэн загварын хүрээг баталгаажуулна
        if (status === "done" && mapRef.current && mapRef.current.getView().getZoom() >= EDIT_ZOOM) {
          const { data } = await axiosInstance.post(endpoints.ml.confirmArea, { bbox: viewBbox() });
          if (data?.confirmed) enqueueSnackbar(`${data.confirmed} хүрээ баталгаажлаа`, { variant: "success" });
          refreshWms();
        }
        await axiosInstance.patch(endpoints.ml.taskItem(task.id), { status });
        await loadStats();
        nextTask(task.id);
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.detail || "Хадгалж чадсангүй", { variant: "error" });
      }
    },
    [task, loadStats, nextTask, enqueueSnackbar, refreshWms],
  );

  // ---------------------------------------------------------------- засвар

  const saveFeature = useCallback(
    async (feature, patch) => {
      try {
        const { data } = await axiosInstance.patch(endpoints.ml.detectionItem(feature.getId()), patch);
        feature.setProperties(data.properties);
        feature.changed();
        setSelProps({ ...data.properties });
        refreshWms();
        loadStats();
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.detail || "Хадгалж чадсангүй", { variant: "error" });
      }
    },
    [enqueueSnackbar, refreshWms, loadStats],
  );

  const geomOf = (feature) =>
    geojson.writeGeometryObject(feature.getGeometry(), {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
      decimals: 7,
    });

  const setCls = useCallback(
    (cls) => {
      if (!selected) return;
      // Ангилал өгөх = баталгаажуулах (PATCH нь status=confirmed болгоно).
      // Даалгаврын нэртэй холбох нь зөвхөн T — цонхонд өөр газрын нэр ч байдаг.
      saveFeature(selected, { cls });
    },
    [selected, saveFeature],
  );

  const toggleLink = useCallback(() => {
    if (!selected) return;
    const cur = currentRef.current;
    if (selected.get("recount_id")) saveFeature(selected, { recount_id: null });
    // Бичвэр бөглөхгүй: экспортод хуулийн нэрийг холбосон мөрүүдэд нь хуваана
    else if (cur) saveFeature(selected, { recount_id: cur.id, cls: "name" });
  }, [selected, saveFeature]);

  const clearSelection = useCallback(() => {
    selectRef.current?.getFeatures().clear();
    setSelected(null);
    setSelProps(null);
  }, []);

  const confirmSelected = useCallback(async () => {
    if (!selected) return;
    await saveFeature(selected, { status: "confirmed" });
    enqueueSnackbar("Баталгаажлаа", { variant: "success", autoHideDuration: 1200 });
    clearSelection();
  }, [selected, saveFeature, enqueueSnackbar, clearSelection]);

  const rejectSelected = useCallback(async () => {
    if (!selected) return;
    try {
      await axiosInstance.delete(endpoints.ml.detectionItem(selected.getId()));
      detSrcRef.current.removeFeature(selected);
      selectRef.current.getFeatures().clear();
      setSelected(null);
      refreshWms();
      loadStats();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Устгаж чадсангүй", { variant: "error" });
    }
  }, [selected, refreshWms, loadStats, enqueueSnackbar]);

  // ---------------------------------------------------------------- автомат шошгоны шалгалт

  const loadRstats = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(endpoints.ml.reviewStats);
      setRstats(data);
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Статистик ачаалж чадсангүй", { variant: "error" });
    }
  }, [enqueueSnackbar]);

  const loadReview = useCallback(
    async (skip) => {
      try {
        const { data } = await axiosInstance.get(endpoints.ml.reviewNext(skip ? `skip=${skip}` : ""));
        setReview(data);
        const src = reviewSrcRef.current;
        src?.clear();
        if (!data) {
          enqueueSnackbar("Шалгах автомат шошго дууссан", { variant: "success" });
          return;
        }
        src.addFeatures(geojson.readFeatures(data.boxes));
        mapRef.current?.getView().fit(src.getExtent(), { padding: [160, 160, 160, 160], maxZoom: 17, duration: 300 });
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.detail || "Ачаалж чадсангүй", { variant: "error" });
      }
    },
    [enqueueSnackbar],
  );

  const answerReview = useCallback(
    async (ok) => {
      if (!review) return;
      try {
        await axiosInstance.put(endpoints.ml.reviewItem(review.recount_id), { ok });
        loadRstats();
        refreshWms();
        loadReview();
      } catch (e) {
        enqueueSnackbar(e?.response?.data?.detail || "Хадгалж чадсангүй", { variant: "error" });
      }
    },
    [review, loadRstats, refreshWms, loadReview, enqueueSnackbar],
  );

  // ---------------------------------------------------------------- газрын зураг

  useEffect(() => {
    if (!elRef.current || mapRef.current || !baseCfgs.length) return undefined;

    const bases = baseCfgs.filter((c) => (c.layer_type || "base") === "base");
    const def = bases.find((c) => c.key === DEFAULT_BASE) || bases[0];
    const baseLayers = bases.map((cfg) => {
      const L = buildOlBaseLayer(cfg);
      L.set("key", cfg.key);
      L.setVisible(cfg === def);
      return L;
    });

    const wms = new TileLayer({
      zIndex: 40,
      maxZoom: EDIT_ZOOM,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        params: {
          LAYERS: "geoname:nameqc_detection",
          FORMAT: "image/png",
          TRANSPARENT: "true",
          TILED: "true",
          VERSION: "1.1.1",
        },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
    });
    wmsRef.current = wms;

    const detSrc = new VectorSource();
    detSrcRef.current = detSrc;
    const detLayer = new VectorLayer({
      source: detSrc,
      zIndex: 60,
      minZoom: EDIT_ZOOM,
      style: (f) => detStyle(f, false),
    });

    const taskSrc = new VectorSource();
    taskSrcRef.current = taskSrc;
    const reviewSrc = new VectorSource();
    reviewSrcRef.current = reviewSrc;
    const reviewLayer = new VectorLayer({
      source: reviewSrc,
      zIndex: 80,
      style: (f) =>
        new Style({
          stroke: new Stroke({ color: "#ffd600", width: 4 }),
          fill: new Fill({ color: "rgba(255,214,0,0.12)" }),
          text: new Text({
            text: f.get("text") || "",
            font: "bold 15px sans-serif",
            offsetY: -22,
            fill: new Fill({ color: "#000" }),
            stroke: new Stroke({ color: "#ffd600", width: 4 }),
            overflow: true,
          }),
        }),
    });

    const taskLayer = new VectorLayer({
      source: taskSrc,
      zIndex: 70,
      style: (f) => taskStyle(f, currentRef.current?.id),
    });
    taskLayerRef.current = taskLayer;

    const map = new Map({
      target: elRef.current,
      layers: [...baseLayers, wms, detLayer, taskLayer, reviewLayer],
      view: new View({ center: fromLonLat([113.5, 46.3]), zoom: 8, maxZoom: 19 }),
    });
    mapRef.current = map;

    const select = new Select({
      layers: [detLayer],
      condition: click,
      style: (f) => detStyle(f, true),
      hitTolerance: 4,
    });
    selectRef.current = select;
    select.on("select", () => {
      const f = select.getFeatures().item(0) || null;
      setSelected(f);
      setSelProps(f ? { ...f.getProperties() } : null);
      setText(f?.get("text") || "");
    });
    const modify = new Modify({ features: select.getFeatures() });
    const translate = new Translate({ features: select.getFeatures() });
    const onGeomEdit = (e) => {
      const f = e.features.item(0);
      if (!f) return;
      axiosInstance
        .patch(endpoints.ml.detectionItem(f.getId()), { geometry: geomOf(f) })
        .then(({ data }) => {
          f.setProperties(data.properties);
          setSelProps({ ...data.properties });
          wms.getSource().updateParams({ _t: Date.now() });
        })
        .catch(() => enqueueSnackbar("Геометр хадгалж чадсангүй", { variant: "error" }));
    };
    modify.on("modifyend", onGeomEdit);
    translate.on("translateend", onGeomEdit);
    map.addInteraction(select);
    map.addInteraction(modify);
    map.addInteraction(translate);

    let timer;
    map.on("moveend", () => {
      setZoom(map.getView().getZoom());
      clearTimeout(timer);
      timer = setTimeout(reloadVectors, 150);
    });

    return () => {
      clearTimeout(timer);
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCfgs]);

  // Зурах горим
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    selectRef.current?.setActive(mode === "select");
    if (mode === "select") return undefined;

    const draw =
      mode === "box"
        ? new Draw({ source: new VectorSource(), type: "LineString", maxPoints: 3, geometryFunction: rotatedBox })
        : new Draw({ source: new VectorSource(), type: "Point" });
    draw.on("drawend", async (e) => {
      const cur = currentRef.current;
      const body = {
        geometry: geomOf(e.feature),
        kind: mode === "box" ? "text" : "symbol",
        cls: mode === "box" ? "unknown" : "other",
        ...(mode === "symbol" && cur ? { recount_id: cur.id } : {}),
      };
      try {
        const { data } = await axiosInstance.post(endpoints.ml.detection(""), body);
        const f = geojson.readFeature(data);
        detSrcRef.current.addFeature(f);
        refreshWms();
        setMode("select");
        setTimeout(() => {
          selectRef.current.getFeatures().clear();
          selectRef.current.getFeatures().push(f);
          setSelected(f);
          setSelProps({ ...f.getProperties() });
          setText("");
        }, 0);
      } catch (err) {
        enqueueSnackbar(err?.response?.data?.detail || "Хадгалж чадсангүй", { variant: "error" });
      }
    });
    map.addInteraction(draw);
    drawRef.current = draw;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Эхлэх
  useEffect(() => {
    loadStats();
    nextTask();
  }, [loadStats, nextTask]);

  useEffect(() => {
    taskLayerRef.current?.changed();
  }, [task]);

  // Гарын товч
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (view === "review") {
        if (e.key === "y" || e.key === "Y" || e.key === "Enter" || e.key === "ArrowRight") answerReview(true);
        else if (e.key === "x" || e.key === "X" || e.key === "Backspace" || e.key === "Delete") answerReview(false);
        else if (e.key === " ") {
          e.preventDefault();
          loadReview(review?.recount_id);
        }
        return;
      }
      const c = CLASSES.find((x) => x.hot && x.hot === e.key);
      if (c) setCls(c.key);
      else if (e.key === "Delete" || e.key === "Backspace") rejectSelected();
      else if (e.key === "b" || e.key === "B") setMode("box");
      else if (e.key === "s" || e.key === "S") setMode("symbol");
      else if (e.key === "Escape") {
        drawRef.current?.abortDrawing();
        setMode("select");
        clearSelection();
      } else if (e.key === "t" || e.key === "T") toggleLink();
      else if (e.key === "Enter" && selected) confirmSelected();
      else if (e.key === "n" || e.key === "N") finishTask("done");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCls, rejectSelected, toggleLink, confirmSelected, clearSelection, selected, finishTask, view, answerReview, loadReview, review]);

  // Шалгах горимд орох/гарах
  useEffect(() => {
    if (view === "review") {
      setMode("select");
      loadRstats();
      if (mapRef.current) loadReview();
    } else {
      reviewSrcRef.current?.clear();
      setReview(null);
      if (task) goTo(task);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, baseCfgs]);

  // ---------------------------------------------------------------- UI

  const pct = stats?.total ? Math.round(((stats.done + stats.skip) / stats.total) * 100) : 0;

  return (
    <Box sx={{ display: "flex", height: "100dvh", width: "100%", overflow: "hidden" }}>
      <Box sx={{ flex: 1, position: "relative" }}>
        <Box ref={elRef} sx={{ position: "absolute", inset: 0 }} />
        {zoom < EDIT_ZOOM && (
          <Chip
            size="small"
            color="info"
            label={`Засахын тулд ойртуулна уу (зум ${EDIT_ZOOM}+)`}
            sx={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)" }}
          />
        )}
      </Box>

      <Paper square elevation={3} sx={{ width: 340, p: 2, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Button component={RouterLink} href="/dashboard/map" size="small" startIcon={<Iconify icon="eva:arrow-back-fill" />}>
            Газрын зураг
          </Button>
          <Typography variant="subtitle1" sx={{ flex: 1, textAlign: "right" }}>
            Нэр таних (ML)
          </Typography>
        </Stack>

        <ToggleButtonGroup size="small" exclusive fullWidth value={view} onChange={(e, v) => v && setView(v)}>
          <ToggleButton value="review">Шалгах (зөв/буруу)</ToggleButton>
          <ToggleButton value="edit">Гараар засах</ToggleButton>
        </ToggleButtonGroup>

        {view === "review" && (
          <Box>
            {rstats && (
              <Typography variant="caption" color="text.secondary" component="div">
                Шалгасан: {rstats.ok} зөв · {rstats.bad} буруу · {rstats.todo} үлдсэн · машин өөрөө баталсан{" "}
                {rstats.self || 0}
                {rstats.ok + rstats.bad > 0 &&
                  ` · нарийвчлал ${Math.round((100 * rstats.ok) / (rstats.ok + rstats.bad))}%`}
              </Typography>
            )}
            {review ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Батлагдсан нэр · {review.type || "—"} · #{review.recount_id}
                </Typography>
                <Typography variant="h5" sx={{ mb: 1 }}>
                  {review.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Шар хүрээнд энэ нэр бичигдсэн үү? (машины олсон: {review.boxes.features.map((f) => f.properties.text).join(" / ")})
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button fullWidth size="large" variant="contained" color="success" onClick={() => answerReview(true)}>
                    ✓ Зөв
                  </Button>
                  <Button fullWidth size="large" variant="contained" color="error" onClick={() => answerReview(false)}>
                    ✗ Буруу
                  </Button>
                </Stack>
                <Button fullWidth size="small" sx={{ mt: 1 }} onClick={() => loadReview(review.recount_id)}>
                  Мэдэхгүй, алгасах
                </Button>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 2 }}>
                  Товч: Y / Enter / → зөв · X / ⌫ буруу · Зай алгасах. Хүрээ нэрийн зарим хэсгийг л хамарсан ч нэр
                  нь зөв бол «Зөв».
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ mt: 2 }}>
                Шалгах автомат шошго алга.
              </Typography>
            )}
          </Box>
        )}

        {view === "edit" && (
        <>
        {stats && (
          <Box>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption">
                Даалгавар: {stats.done} дууссан · {stats.skip} алгассан · {stats.todo} үлдсэн
              </Typography>
              <Typography variant="caption">{pct}%</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5 }} />
            <Typography variant="caption" color="text.secondary">
              Хүрээ: {stats.detections?.confirmed || 0} баталгаажсан · {stats.detections?.pending || 0} хүлээгдэж буй ·{" "}
              {stats.detections?.rejected || 0} татгалзсан
            </Typography>
          </Box>
        )}

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            Одоогийн даалгавар
          </Typography>
          {task ? (
            <>
              <Typography variant="h6">{task.properties.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {task.properties.type || "—"} · #{task.id} · холбосон хүрээ {task.properties.linked}
              </Typography>
              {task.properties.shape && (
                <Typography variant="caption" color="error.main" component="div">
                  {task.properties.shape.type.includes("Line") ? "Шугаман" : "Талбайн"} нэр — улаан шугам/хүрээний дагуу,
                  ихэвчлэн тэмдэггүй. Хэлбэрийн дагуух нэрийн мөр бүрийг хүрээлээд T. Цэг (S) тэмдэглэх шаардлагагүй.
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Tooltip title="Энэ цэгийн эргэн тойрны бүх бичвэрийг шошгосны дараа (N)">
                  <Button variant="contained" size="small" onClick={() => finishTask("done")}>
                    Дууссан, дараах
                  </Button>
                </Tooltip>
                <Button size="small" onClick={() => finishTask("skip")}>
                  Алгасах
                </Button>
                <Tooltip title="Цэг рүү буцах">
                  <Button size="small" onClick={() => goTo(task)}>
                    <Iconify icon="mdi:crosshairs-gps" />
                  </Button>
                </Tooltip>
              </Stack>
            </>
          ) : (
            <Typography variant="body2">Даалгавар алга</Typography>
          )}
        </Box>

        <Divider />

        <ToggleButtonGroup size="small" exclusive fullWidth value={mode} onChange={(e, v) => v && setMode(v)}>
          <ToggleButton value="select">Сонгох</ToggleButton>
          <ToggleButton value="box">Хүрээ (B)</ToggleButton>
          <ToggleButton value="symbol">Тэмдэг (S)</ToggleButton>
        </ToggleButtonGroup>
        {mode === "box" && (
          <Typography variant="caption" color="text.secondary">
            Бичвэрийн доод шугамын эхэнд, төгсгөлд нь товшоод, 3 дахь товшилтоор өндрийг заана. Нэг мөр = нэг хүрээ (сийрэг үсэгтэй ч). Олон мөртэй нэрийн мөр бүрийг тусад нь.
          </Typography>
        )}

        {selected && selProps && (
          <Box>
            <Typography variant="overline" color="text.secondary">
              Сонгосон {selProps.kind === "symbol" ? "тэмдэг" : "хүрээ"} #{selProps.id} · {selProps.status} · {selProps.source}
            </Typography>
            {selProps.kind === "text" && (
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ my: 1 }}>
                {CLASSES.filter((c) => c.key !== "unknown").map((c) => (
                  <Chip
                    key={c.key}
                    label={`${c.hot} ${c.label}`}
                    onClick={() => setCls(c.key)}
                    variant={selProps.cls === c.key ? "filled" : "outlined"}
                    sx={{
                      borderColor: c.color,
                      color: selProps.cls === c.key ? "#fff" : c.color,
                      bgcolor: selProps.cls === c.key ? c.color : "transparent",
                    }}
                  />
                ))}
              </Stack>
            )}
            <TextField
              fullWidth
              size="small"
              label="Бичвэр (заавал биш — зөвхөн өөр бичигдсэн бол)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text !== (selProps.text || "") && saveFeature(selected, { text })}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Tooltip title="Энэ бичвэр нь одоогийн даалгаврын нэр (T)">
                <Button size="small" variant={selProps.recount_id ? "contained" : "outlined"} color="error" onClick={toggleLink}>
                  {selProps.recount_id ? "Даалгаврын нэр ✓" : "Даалгаврын нэр"}
                </Button>
              </Tooltip>
              <Button size="small" onClick={confirmSelected}>
                Батлах ↵
              </Button>
              <Button size="small" color="inherit" onClick={rejectSelected}>
                Устгах ⌫
              </Button>
            </Stack>
          </Box>
        )}

        </>
        )}

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            Тайлбар
          </Typography>
          {CLASSES.map((c) => (
            <Stack key={c.key} direction="row" alignItems="center" spacing={1}>
              <Box sx={{ width: 18, height: 10, border: `2px solid ${c.color}` }} />
              <Typography variant="caption">{c.label}</Typography>
            </Stack>
          ))}
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Тасархай — урьдчилсан (машин), бүтэн — баталгаажсан. Тойрог: улаан — одоогийн даалгавар, улбар шар —
            шошгоогүй, ногоон — дууссан. Нэр нь цэгийн аль ч талд, ямар ч зайд байж болно.
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            Ажлын дараалал: буруу хүрээг ⌫ устгах · ангилал буруу бол 1–4 · даалгаврын нэрийн мөр бүрийг T ·
            дутууг B-ээр зурах · N — дэлгэцэн дээрх үлдсэн хүрээ бүгд баталгаажиж дараагийнх руу.
            Нэг мөр = нэг хүрээ. Бичвэр бичих шаардлагагүй.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
