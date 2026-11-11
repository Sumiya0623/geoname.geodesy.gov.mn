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
  Switch,
  Divider,
  Tooltip,
  TextField,
  Typography,
  ToggleButton,
  FormControlLabel,
  LinearProgress,
  ToggleButtonGroup,
} from "@mui/material";

import { RouterLink } from "src/routes/components";
import { useGetBaseLayers } from "src/api/map";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import axiosInstance, { endpoints } from "src/utils/axios";
import { buildOlBaseLayer } from "src/sections/map/layers-wmts";

import ReviewGrid from "./review-grid";
import SymGrid from "./sym-grid";
import PlaceGrid from "./place-grid";
import NameGrid, { NameSearch } from "./name-grid";

// Нэр илрүүлэх урсгал (region → locate) ажиллуулсан сумд. t* = тодруулгагүй (жинхэнэ шалгалт), lk* = тодруулгатай.
const SUMS = [
  { tag: "t56", label: "Дорнод, Булган (тодруулгагүй)", lon: 114.206, lat: 47.667 },
  { tag: "t65", label: "Дорнод, Хөлөнбуйр (тодруулгагүй)", lon: 113.039, lat: 47.872 },
  // тодруулгатай сумд (Сүхбаатар, Баянтэс …) нэр+байрлал нь тодруулгаар автоматаар шошгологдоно — гараар шалгахгүй
];

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
const geojson3857 = new GeoJSON({ dataProjection: "EPSG:3857", featureProjection: "EPSG:3857" });
// олсон нэрийн цэг — ойрын зумд чирж засах бариул (шар цагираг)
const placeRing = new Style({
  image: new CircleStyle({ radius: 10, stroke: new Stroke({ color: "#ffd600", width: 2.5 }), fill: new Fill({ color: "rgba(255,214,0,0.12)" }) }),
});
const textHandle = new Style({
  image: new RegularShape({ points: 4, radius: 8, angle: Math.PI / 4, stroke: new Stroke({ color: "#546e7a", width: 2 }), fill: new Fill({ color: "rgba(84,110,122,0.15)" }) }),
});
const placeHandle = (f) => (f.get("kind") === "text" ? textHandle : placeRing);

function detStyle(feature, selected, curId) {
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
  const mine = curId != null && p.recount_id === curId; // одоогийн даалгаврын нэрд холбогдсон
  const styles = [
    new Style({
      stroke: new Stroke({
        color: selected ? "#ffd600" : color,
        width: selected ? 4 : confirmed ? 3 : 2,
        lineDash: confirmed || selected ? undefined : [8, 4],
      }),
      fill: new Fill({ color: confirmed ? `${color}22` : "rgba(0,0,0,0)" }),
      text:
        p.text && (confirmed || selected || mine)
          ? new Text({
              text: mine ? `✓ ${p.text}` : p.text,
              font: "bold 13px sans-serif",
              fill: new Fill({ color: "#000" }),
              stroke: new Stroke({ color: "#fff", width: 3 }),
              overflow: true,
            })
          : undefined,
    }),
  ];
  // Одоогийн даалгаврын нэр — тод улаан зузаан хүрээ; өөр даалгаврынх — нимгэн улаан
  if (mine) {
    styles.push(
      new Style({
        stroke: new Stroke({ color: "#d50000", width: 5 }),
        fill: new Fill({ color: "rgba(213,0,0,0.15)" }),
      }),
    );
  } else if (p.recount_id) {
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

function NameEditPanel({ item, tag, onClose, onSaved, onSkip }) {
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const isText = item.kind === "text";
  const save = async (verdict, name, gid) => {
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.ml.nameRevBatch, {
        items: [{ kind: item.kind, id: item.id, verdict, name, geoname_id: gid ?? null, pos: item.pos || null }],
      });
      onSaved(verdict === "notname" ? "«Нэр биш» гэж тэмдэглэлээ" : verdict === "later" ? "Шугам/талбай — дараа шалгана" : `Хадгаллаа: ${name}`);
    } catch (e) {
      setBusy(false);
    }
  };
  const chips = [item.name, item.alt && !item.alt.startsWith("…") ? item.alt : null].filter(Boolean);
  return (
    <Paper elevation={6} sx={{ position: "absolute", top: 12, right: 12, zIndex: 20, width: 340, p: 1.5 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">
          {isText ? `Бичвэр: «${item.ocr || ""}»` : `Олсон нэр: ${item.name}`}
        </Typography>
        {isText && (
          <Typography variant="caption" color={item.pos ? "success.main" : "text.secondary"}>
            {item.pos ? "✓ Байрлал заасан — нэрийг сонгоод хадгал" : "Байрлал: саарал ◇-г тэмдгийн төв рүү чирж заана"}
          </Typography>
        )}
        {chips.length > 0 && (
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {chips.map((c) => (
              <Chip key={c} size="small" label={c} variant={pick?.name === c ? "filled" : "outlined"} color={pick?.name === c ? "success" : "default"} onClick={() => setPick({ name: c, id: null })} />
            ))}
          </Stack>
        )}
        <NameSearch tag={tag} initial={isText ? item.ocr || "" : ""} onPick={(c) => setPick(c)} />
        {pick && (
          <Typography variant="caption" color="success.main">
            Сонгосон: {pick.name}
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
          <Button size="small" color="inherit" onClick={onClose} disabled={busy}>
            Хаах
          </Button>
          {tag && (
            <Button size="small" color="inherit" onClick={onSkip} disabled={busy}>
              Алгасах →
            </Button>
          )}
          <Button size="small" color="inherit" onClick={() => save("notname", null)} disabled={busy}>
            Нэр биш
          </Button>
          <Button
            size="small"
            color="secondary"
            title="Гуу, жалга, ам гэх мэт шугам/талбайн нэр — одоохондоо алгасна (устахгүй)"
            onClick={() => save("later", item.name || null)}
            disabled={busy}
          >
            Шугам/талбай
          </Button>
          {!isText && (
            <Button size="small" variant="outlined" color="success" onClick={() => save("ok", item.name)} disabled={busy}>
              Энэ нэр зөв
            </Button>
          )}
          <Button size="small" variant="contained" color="success" disabled={busy || !pick} onClick={() => save("fixed", pick.name, pick.id)}>
            Хадгалах
          </Button>
        </Stack>
        {item.todo != null && (
          <Typography variant="caption" color="text.secondary">
            Энэ суманд шалгаагүй үлдсэн: {item.todo}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          Нэрийг хайх талбарт бичээд жагсаалтаас сонго (жагсаалтад байхгүй бол бүтэн бичээд Enter). Байрлалыг шар
          цагирагийг чирж засна.
        </Typography>
      </Stack>
    </Paper>
  );
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
  const detLayerRef = useRef(null);
  const modeRef = useRef("select");
  const linkRef = useRef(null); // хүрээн дээр дарахад холбох/салгах (газрын зургийн хаалтаас дуудна)
  const [linkTick, setLinkTick] = useState(0);
  const [showAdv, setShowAdv] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true); // илрүүлэгчийн хүрээ (тасархай) харуулах
  const [namesOnly, setNamesOnly] = useState(true); // зөвхөн «нэр» ангиллын хүрээ (өндрийн тоо, бусдыг нуух)
  const namesOnlyRef = useRef(true);
  const placeLayerRef = useRef(null);
  const [showPlaces, setShowPlaces] = useState(true); // загварын олсон цэгэн нэр
  const symLayerRef = useRef(null);
  const [showSyms, setShowSyms] = useState(true); // тэмдэг илрүүлэгчийн олсон тэмдэг
  const textLayerRef = useRef(null);
  const [showTexts, setShowTexts] = useState(true); // нэр болоогүй бичвэрийн уншилт (nameqc_text)
  const [sumTag, setSumTag] = useState("");
  const sumTagRef = useRef("");
  const placeVecSrcRef = useRef(null);
  const placeVecRef = useRef(null);
  const [nameEdit, setNameEdit] = useState(null); // газрын зураг дээр нэр засах цонх
  const skippedRef = useRef(new Set());
  // сонгосон сумын дараагийн шалгаагүй нэр/бичвэр рүү очиж засах цонхыг нээнэ
  const goNext = useCallback(
    async (from) => {
      const map = mapRef.current;
      if (!sumTagRef.current || !map) return;
      const c = from || map.getView().getCenter();
      const ex = [...skippedRef.current].join(",");
      try {
        const { data } = await axiosInstance.get(
          `${endpoints.ml.nameRevNext}?tag=${encodeURIComponent(sumTagRef.current)}&x=${c[0]}&y=${c[1]}&exclude=${ex}`
        );
        if (!data.kind) {
          setNameEdit(null);
          enqueueSnackbar("Энэ сумын бүх нэрийг шалгаж дууслаа", { variant: "success" });
          return;
        }
        map.getView().animate({ center: data.loc, zoom: Math.max(map.getView().getZoom(), 16), duration: 350 });
        setNameEdit({ kind: data.kind, id: data.ref, name: data.name, ocr: data.ocr, alt: data.alt, pos: null, loc: data.loc, todo: data.todo });
      } catch (e) {
        enqueueSnackbar("Дараагийнхыг ачаалж чадсангүй", { variant: "error" });
      }
    },
    [enqueueSnackbar]
  ); // нэр илрүүлсэн сум — зөвхөн түүний нэр/тэмдгийг харуулна

  const [mode, setMode] = useState("select"); // select | box | symbol
  modeRef.current = mode;
  const [task, setTask] = useState(null);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null); // ol Feature
  const [selProps, setSelProps] = useState(null);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState(0);
  // review = автомат шошгыг зөв/буруу гэж шалгах (үндсэн), edit = гараар засах
  // ?view=edit&lon=..&lat=..&z=.. — шууд газрын зураг дээр (жишээ: тодруулгагүй сумын туршилтын үр дүн)
  const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [view, setView] = useState("names"); // names = нэрийн хүснэгт (цорын ганц хэсэг)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "edit" || v === "review" || v === "grid" || v === "sym" || v === "pos" || v === "names") setView(v);
  }, []);
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
      if (view.getZoom() >= EDIT_ZOOM && placeVecSrcRef.current) {
        const tq = sumTagRef.current ? `&tag=${encodeURIComponent(sumTagRef.current)}` : "";
        axiosInstance
          .get(`${endpoints.ml.nameRevInbox}?bbox=${bbox}${tq}`)
          .then(({ data }) => {
            placeVecSrcRef.current.clear();
            placeVecSrcRef.current.addFeatures(geojson3857.readFeatures(data));
          })
          .catch(() => {});
      }
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
        setLinkTick((t) => t + 1);
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
        setLinkTick((t) => t + 1);
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

  // Нэг товшилт = холбох/салгах. Өөр даалгаварт холбогдсон байсан ч одоогийнх руу шилжүүлнэ.
  const linkFeature = useCallback(
    (f) => {
      const cur = currentRef.current;
      if (!f || !cur || f.get("kind") !== "text") return;
      if (f.get("recount_id") === cur.id) saveFeature(f, { recount_id: null });
      else saveFeature(f, { recount_id: cur.id, cls: "name" });
    },
    [saveFeature],
  );
  linkRef.current = linkFeature;

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
          ...(namesOnlyRef.current ? { CQL_FILTER: "cls='name'" } : {}),
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

    // Тодруулгагүй нутагт загварын олсон цэгэн нэр (nameqc_place): улаан = сумынх/хөршийнх,
    // ягаан = өөр нэгжид бүртгэлтэй, улбар шар = эргэлзээтэй (2 нэр)
    const placeLayer = new TileLayer({
      zIndex: 90,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        // BUFFER: хөрш тайлын захад байгаа цэгийн нэрийг ч зурна (томруулахад нэр алга болохоос сэргийлнэ)
        params: { LAYERS: "geoname:nameqc_place", FORMAT: "image/png", TRANSPARENT: "true", TILED: "true", VERSION: "1.1.1", BUFFER: 256 },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
    });

    placeLayerRef.current = placeLayer;
    // Нэр болоогүй бичвэр (nameqc_text): «чөлөөт уншилт» → жагсаалтаас хамгийн ойр нэр? — саарал налуу
    const textLayer = new TileLayer({
      zIndex: 88,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        params: { LAYERS: "geoname:nameqc_text", FORMAT: "image/png", TRANSPARENT: "true", TILED: "true", VERSION: "1.1.1", BUFFER: 256 },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
    });
    textLayerRef.current = textLayer;
    // Тэмдэг илрүүлэгчийн олсон тэмдэг (nameqc_symbol): хөх □ = худаг, бор □ = толгой/уул/овоо, тоо = итгэл
    const symLayer = new TileLayer({
      zIndex: 85,
      source: new TileWMS({
        url: `${GEOSERVER}/geoname/wms`,
        params: { LAYERS: "geoname:nameqc_symbol", FORMAT: "image/png", TRANSPARENT: "true", TILED: "true", VERSION: "1.1.1" },
        serverType: "geoserver",
        crossOrigin: "anonymous",
      }),
    });
    symLayerRef.current = symLayer;
    const detSrc = new VectorSource();
    detSrcRef.current = detSrc;
    const detLayer = new VectorLayer({
      source: detSrc,
      zIndex: 60,
      minZoom: EDIT_ZOOM,
      style: (f) =>
        namesOnlyRef.current && f.get("cls") !== "name" ? null : detStyle(f, false, currentRef.current?.id),
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
      layers: [...baseLayers, wms, detLayer, taskLayer, reviewLayer, symLayer, textLayer, placeLayer],
      view: new View({
        center: fromLonLat([Number(qp?.get("lon")) || 113.5, Number(qp?.get("lat")) || 46.3]),
        zoom: Number(qp?.get("z")) || 8,
        maxZoom: 19,
      }),
    });
    mapRef.current = map;

    const select = new Select({
      layers: [detLayer],
      condition: click,
      style: (f) => detStyle(f, true, currentRef.current?.id),
      hitTolerance: 4,
    });
    selectRef.current = select;
    detLayerRef.current = detLayer;
    // Засах горимд хүрээн дээр нэг дарах = даалгаврын нэрд холбох/салгах (Shift+дарах = зөвхөн сонгох)
    map.on("singleclick", (e) => {
      if (viewRef.current !== "edit" || modeRef.current !== "select" || e.originalEvent.shiftKey) return;
      const f = map.forEachFeatureAtPixel(e.pixel, (x) => x, { layerFilter: (l) => l === detLayer, hitTolerance: 4 });
      if (f) linkRef.current?.(f);
    });
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

    // Олсон нэрийн байрлалыг чирж засах (зум ≥ EDIT_ZOOM): шар цагираг → зөв тэмдгийн төв рүү чирнэ
    const placeVecSrc = new VectorSource();
    placeVecSrcRef.current = placeVecSrc;
    const placeVec = new VectorLayer({ source: placeVecSrc, zIndex: 95, minZoom: EDIT_ZOOM, style: placeHandle });
    placeVecRef.current = placeVec;
    map.addLayer(placeVec);
    const ptranslate = new Translate({ layers: [placeVec], hitTolerance: 6 });
    ptranslate.on("translateend", (e) => {
      const f = e.features.item(0);
      if (!f) return;
      const [x, y] = f.getGeometry().getCoordinates();
      if (f.get("kind") === "text") {
        // нэр болоогүй бичвэр: байрлал заасан → нэрийг нь сонгуулна (хадгалахад шинэ нэр энэ цэг дээр үүснэ)
        f.set("moved", true);
        setNameEdit({ kind: "text", id: f.get("ref"), name: f.get("name"), ocr: f.get("ocr"), alt: null, pos: [x, y], loc: [x, y] });
        return;
      }
      axiosInstance
        .post(endpoints.ml.nameRevBatch, { items: [{ kind: "place", id: f.get("ref"), verdict: "pos", pos: [x, y] }] })
        .then(() => {
          enqueueSnackbar(`Байрлал хадгалсан: ${f.get("name")}`, { variant: "success" });
          placeLayerRef.current?.getSource().updateParams({ _t: Date.now() });
        })
        .catch(() => enqueueSnackbar("Байрлал хадгалж чадсангүй", { variant: "error" }));
    });
    map.addInteraction(ptranslate);
    // нэр засах: шар цагираг / саарал бичвэр дээр дарахад засах цонх
    map.on("singleclick", (e) => {
      const f = map.forEachFeatureAtPixel(e.pixel, (x) => x, { layerFilter: (l) => l === placeVec, hitTolerance: 6 });
      if (f) {
        setNameEdit({
          kind: f.get("kind"),
          id: f.get("ref"),
          name: f.get("name"),
          ocr: f.get("ocr"),
          alt: f.get("alt"),
          pos: f.get("moved") ? f.getGeometry().getCoordinates() : null,
          loc: f.getGeometry().getCoordinates(),
        });
      }
    });

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
        // Зурсан хүрээ = ихэвчлэн дутуу нэрийн үг → шууд даалгаварт холбоно (буруу бол дахин дарж салгана)
        cls: mode === "box" ? (cur ? "name" : "unknown") : "other",
        ...(cur ? { recount_id: cur.id } : {}),
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
    detLayerRef.current?.changed();
  }, [task]);

  useEffect(() => {
    wmsRef.current?.setVisible(showBoxes);
    detLayerRef.current?.setVisible(showBoxes);
  }, [showBoxes]);
  useEffect(() => {
    namesOnlyRef.current = namesOnly;
    detLayerRef.current?.changed();
    wmsRef.current?.getSource().updateParams({ CQL_FILTER: namesOnly ? "cls='name'" : undefined });
  }, [namesOnly]);
  useEffect(() => {
    placeLayerRef.current?.setVisible(showPlaces);
    placeVecRef.current?.setVisible(showPlaces);
  }, [showPlaces]);
  useEffect(() => {
    textLayerRef.current?.setVisible(showTexts);
  }, [showTexts]);
  useEffect(() => {
    sumTagRef.current = sumTag;
    const cql = sumTag ? `tag='${sumTag}'` : undefined;
    [placeLayerRef.current, symLayerRef.current, textLayerRef.current].forEach((l) => l?.getSource().updateParams({ CQL_FILTER: cql }));
    const s = SUMS.find((x) => x.tag === sumTag);
    if (s && mapRef.current) {
      mapRef.current.getView().animate({ center: fromLonLat([s.lon, s.lat]), zoom: 10, duration: 400 });
    }
  }, [sumTag]);
  useEffect(() => {
    symLayerRef.current?.setVisible(showSyms);
  }, [showSyms]);

  // Даалгаврын нэрийн үг бүр холбогдсон хүрээнд байгаа эсэх (✓/✗) + илүү/давхар холболтын анхааруулга.
  // linkTick нь хүрээ хадгалах/ачаалах бүрт дахин тооцоолуулна.
  const check = (() => {
    if (!task || linkTick < 0) return { words: [], extra: [], dup: [] };
    const norm = (t) => (t || "").toLowerCase().replace(/[^\p{L}\d]+/gu, " ").trim();
    const pre = (x, y) => {
      let i = 0;
      while (i < x.length && i < y.length && x[i] === y[i]) i += 1;
      return i;
    };
    const ws = norm(task.properties.name).split(" ").filter(Boolean);
    const hit = ws.map(() => 0);
    const extra = [];
    let blank = 0;
    (detSrcRef.current?.getFeatures() || [])
      .filter((f) => f.get("recount_id") === task.id && f.get("kind") === "text")
      .forEach((f) => {
        const toks = norm(f.get("text")).split(" ").filter(Boolean);
        if (!toks.length) {
          blank += 1; // гараар зурсан, бичвэргүй хүрээ
          return;
        }
        let any = false;
        toks.forEach((t) => {
          ws.forEach((w, i) => {
            if (t.length >= 2 && pre(w, t) >= Math.min(3, w.length, t.length)) {
              hit[i] += 1;
              any = true;
            }
          });
        });
        if (!any) extra.push(f.get("text"));
      });
    // Гараар зурсан (бичвэргүй) хүрээ = нэг мөр, хэдэн ч үг багтана → үлдсэн үгсийг хамарсан гэж үзнэ
    const words = ws.map((w, i) => ({ w, ok: hit[i] > 0 || blank > 0 }));
    return { words, extra, dup: ws.filter((w, i) => hit[i] > 1) };
  })();

  // Гарын товч
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (view === "grid" || view === "sym" || view === "pos" || view === "names") return; // ReviewGrid / SymGrid өөрөө Enter-ийг барина
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
    } else if (view === "grid" || view === "sym" || view === "pos" || view === "names") {
      setMode("select");
      loadRstats();
      reviewSrcRef.current?.clear();
      setReview(null);
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
        {nameEdit && (
          <NameEditPanel
            key={`${nameEdit.kind}:${nameEdit.id}`}
            item={nameEdit}
            tag={sumTag}
            onClose={() => setNameEdit(null)}
            onSkip={() => {
              skippedRef.current.add(`${nameEdit.kind}:${nameEdit.id}`);
              goNext(nameEdit.loc);
            }}
            onSaved={(msg) => {
              const from = nameEdit.loc;
              setNameEdit(null);
              enqueueSnackbar(msg, { variant: "success" });
              placeLayerRef.current?.getSource().updateParams({ _t: Date.now() });
              textLayerRef.current?.getSource().updateParams({ _t: Date.now() });
              if (sumTagRef.current) goNext(from); // засмагц дараагийнх руу
              else reloadVectors();
            }}
          />
        )}
        {view === "grid" && <ReviewGrid onSaved={loadRstats} />}
        {view === "sym" && <SymGrid />}
        {view === "pos" && <PlaceGrid />}
        {view === "names" && <NameGrid tag={sumTag} />}
        {view !== "grid" && view !== "sym" && view !== "pos" && view !== "names" && zoom < EDIT_ZOOM && (
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

        {/* Ганц хэсэг (хэрэглэгч 2026-11-11): «Нэг нэгээр», «Гараар засах», хуучин «Хүснэгтээр» хаагдсан —
            бүх ажил нэрийн хүснэгтэд. Хуучин горимууд ?view=grid|review|edit хаягаар нээгдсэн хэвээр. */}

        {view === "grid" && rstats && (
          <Typography variant="caption" color="text.secondary" component="div">
            Шалгасан: {rstats.ok} зөв · {rstats.bad} буруу · {rstats.todo} үлдсэн · машин өөрөө баталсан{" "}
            {rstats.self || 0}
            {rstats.ok + rstats.bad > 0 &&
              ` · нарийвчлал ${Math.round((100 * rstats.ok) / (rstats.ok + rstats.bad))}%`}
          </Typography>
        )}

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
                {task.properties.type || "—"} · #{task.id}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                {check.words.map((x, i) => (
                  <Chip
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    size="small"
                    label={`${x.ok ? "✓" : "✗"} ${x.w}`}
                    color={x.ok ? "success" : "default"}
                    variant={x.ok ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
              {check.dup.length > 0 && (
                <Typography variant="caption" color="error.main" component="div">
                  «{check.dup.join(", ")}» хоёр удаа холбогдсон — хажуудах өөр нэрийнхийг дарж салга.
                </Typography>
              )}
              {check.extra.length > 0 && (
                <Typography variant="caption" color="warning.main" component="div">
                  Нэрэнд үл хамаарах байж магадгүй: {check.extra.join(", ")} — нэрийн хэсэг биш бол дарж салга.
                </Typography>
              )}
              {task.properties.shape && (
                <Typography variant="caption" color="error.main" component="div">
                  {task.properties.shape.type.includes("Line") ? "Шугаман" : "Талбайн"} нэр — улаан шугам/хүрээний дагуу,
                  ихэвчлэн тэмдэггүй. Хэлбэрийн дагуух нэрийн мөр бүрийг хүрээлээд T. Цэг (S) тэмдэглэх шаардлагагүй.
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Tooltip title="Нэрийн үгс бүгд ✓ бол (N)">
                  <Button variant="contained" size="small" onClick={() => finishTask("done")}>
                    ✓ Зөв, дараах (N)
                  </Button>
                </Tooltip>
                <Tooltip title="Нэр харагдахгүй, эргэлзээтэй, хэцүү бол — дараа нь гараар">
                  <Button size="small" onClick={() => finishTask("skip")}>
                    Алгасах
                  </Button>
                </Tooltip>
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

        <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.25 }}>
          <Typography variant="body2" component="div">
            <b>1.</b> Нэрийн үг бүр дээр <b>дар</b> → тод улаан ✓ болно. Буруу бол дахин дарж салга.
            <br />
            <b>2.</b> Үг хүрээгүй бол <b>B</b> дараад хүрээл (өөрөө холбогдоно).
            <br />
            <b>3.</b> Дээрх үгс бүгд ✓ бол <b>N</b>. Эргэлзвэл «Алгасах».
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            Бичвэрийн алдаа, хүрээ бага зэрэг өргөн, тойрог тэмдгээс зөрсөн — эдгээрийг тоохгүй.
          </Typography>
        </Box>

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

        <Button size="small" color="inherit" onClick={() => setShowAdv((v) => !v)} sx={{ alignSelf: "flex-start" }}>
          {showAdv ? "▾ Нарийвчилсан засвар нуух" : "▸ Нарийвчилсан засвар (ангилал, бичвэр, устгах)"}
        </Button>

        {showAdv && selected && selProps && (
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
            Давхарга
          </Typography>
          <TextField
            select
            size="small"
            fullWidth
            label="Нэр илрүүлсэн сум"
            value={sumTag}
            onChange={(e) => setSumTag(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ my: 1 }}
          >
            <option value="">Бүх сум</option>
            {SUMS.map((x) => (
              <option key={x.tag} value={x.tag}>
                {x.label}
              </option>
            ))}
          </TextField>
          {sumTag && (
            <Button size="small" variant="outlined" fullWidth sx={{ mb: 1 }} onClick={() => goNext()}>
              ▶ Нэрийг дараалан шалгах (ойрын шалгаагүйгээс)
            </Button>
          )}
          <FormControlLabel
            control={<Switch size="small" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />}
            label={<Typography variant="body2">Бичвэрийн хүрээ (тасархай)</Typography>}
          />
          <FormControlLabel
            sx={{ pl: 3 }}
            disabled={!showBoxes}
            control={<Switch size="small" checked={namesOnly} onChange={(e) => setNamesOnly(e.target.checked)} />}
            label={<Typography variant="body2">Зөвхөн нэрийн хүрээ (тоо, бусдыг нуух)</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} />}
            label={<Typography variant="body2">Загварын олсон нэр (цэг)</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={showTexts} onChange={(e) => setShowTexts(e.target.checked)} />}
            label={<Typography variant="body2">Нэр болоогүй бичвэр («уншилт» → таамаг?)</Typography>}
          />
          <FormControlLabel
            control={<Switch size="small" checked={showSyms} onChange={(e) => setShowSyms(e.target.checked)} />}
            label={<Typography variant="body2">Загварын олсон тэмдэг (□)</Typography>}
          />
          <Typography variant="caption" color="text.secondary" component="div">
            Цэг: ● дүүрэн — тэмдэг (⊙) дээр буусан · ○ хөндий — тэмдэг олдоогүй, бичвэрийн эхэнд. Өнгө: улаан —
            сумын/хөршийн бүртгэлтэй · ягаан — өөр нэгжийнх · улбар шар — эргэлзээтэй («нэр ? нөгөө нэр»).
            Тэмдэг: хөх □ — худаг, бор □ — толгой/уул/овоо; доорх тоо — загварын итгэл (0–1).
          </Typography>
        </Box>

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
            Нарийвчилсан: Shift+дарах = зөвхөн сонгох · 1–4 ангилал · ⌫ устгах · S тэмдэг тавих.
            N дарахад дэлгэцэн дээрх үлдсэн хүрээ баталгаажна.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
