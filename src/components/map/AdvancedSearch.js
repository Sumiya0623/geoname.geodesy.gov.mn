import PropTypes from "prop-types";
import React, { useRef, useState, useEffect } from "react";

import {
  Box,
  Tab,
  Tabs,
  Stack,
  Switch,
  Button,
  Divider,
  Tooltip,
  TextField,
  Typography,
  ToggleButton,
  Autocomplete,
  FormControlLabel,
  ToggleButtonGroup,
  ListItemButton,
} from "@mui/material";
import {
  Clear as ClearIcon,
  Search as SearchIcon,
  CropSquare as RectIcon,
  PanoramaFishEye as CircleIcon,
  PentagonOutlined as PolygonIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useGetLegalUnits } from "src/api/legal";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн дэлгэрэнгүй хайлт — 2 таб:
//  • Мэдээлэл: нэр, дугаар, засаг захиргаа, нэрлэвэр
//  • Байршил: тэгш өнцөгт / тойрог / дүрс зурж талбайгаар хайх. Горим
//    сонгомогц шууд зурж эхэлж, зурж дуусмагц автоматаар хайна.
// Текст ба байршлын утгуудыг хослуулж CQL (geoname_view) болон backend
// (geoname.list) хоёуланд илгээнэ.
// ----------------------------------------------------------------------

const EMPTY = {
  name: "",
  number: "",
  cat1: null,
  cat2: null,
  cat3: null,
  aimag: null,
  sum: null,
  bag: null,
  nomek: "",
  approved: false,
  border: false,
};
const EMPTY_GEO = {
  mode: null,
  lat: null,
  lon: null,
  radius: null,
  ring: null,
};

const esc = (s) => String(s).replace(/'/g, "''");

// Сонгосон утгуудаас id‑уудыг гаргах
const catIdOf = (f) => f.cat3?.id || f.cat2?.id || f.cat1?.id || null;
const unitIdOf = (f) => f.bag?.id || f.sum?.id || f.aimag?.id || null;

// Текст шүүлтүүрээс CQL хэсгүүд
function textCqlParts(f) {
  const parts = [];
  if (f.name) parts.push(`name ILIKE '%${esc(f.name)}%'`);
  if (f.number) parts.push(`number ILIKE '%${esc(f.number)}%'`);
  const catId = catIdOf(f);
  if (catId)
    parts.push(`(type_l1=${catId} OR type_l2=${catId} OR type_id=${catId})`);
  const unitId = unitIdOf(f);
  if (unitId) parts.push(`unit_ids LIKE '% ${unitId} %'`);
  if (f.nomek) parts.push(`nomek_codes ILIKE '%${esc(f.nomek)}%'`);
  if (f.approved) parts.push("is_approved = true");
  if (f.border) parts.push("is_border = true");
  return parts;
}

function closeRing(ring) {
  if (!ring.length) return ring;
  const [a, b] = [ring[0], ring[ring.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a];
}

function ringToGeoJson(ring) {
  return JSON.stringify({ type: "Polygon", coordinates: [closeRing(ring)] });
}

// Байршлын CQL (geoloc) — тэгш өнцөгт/дүрс → INTERSECTS, тойрог → DWITHIN
function geoCqlPart(geo) {
  if (
    (geo.mode === "rect" || geo.mode === "polygon") &&
    geo.ring?.length >= 3
  ) {
    const ring = closeRing(geo.ring)
      .map(([lon, lat]) => `${lon} ${lat}`)
      .join(", ");
    return `INTERSECTS(geoloc, POLYGON((${ring})))`;
  }
  if (geo.mode === "circle" && geo.lat != null) {
    return `DWITHIN(geoloc, POINT(${geo.lon} ${geo.lat}), ${geo.radius}, meters)`;
  }
  return null;
}

const MODES = [
  {
    value: "rect",
    label: "Тэгш өнцөгт",
    Icon: RectIcon,
    tip: "Тэгш өнцөгт — газрын зураг дээр нэг булангаас нөгөө булан хүртэл чирж талбай үүсгэнэ",
  },
  {
    value: "circle",
    label: "Тойрог",
    Icon: CircleIcon,
    tip: "Тойрог — төв цэг дээрээ дараад гадагш чирж радиусыг тогтооно",
  },
  {
    value: "polygon",
    label: "Дүрс",
    Icon: PolygonIcon,
    tip: "Дүрс — булан бүр дээр товшиж, эхний цэг дээрээ дарж дуусгана",
  },
];

// Хүснэгтээр харуулах босго (10‑с дээш) ба автоматаар татах дээд хязгаар
const TABLE_THRESHOLD = 0;
const AUTO_LIMIT = 100;
const MAX_FETCH = 500;

export default function AdvancedSearch({
  onSearch,
  onClear,
  onFlyTo,
  seed,
  onStartDrawRectangle,
  onStartDrawCircle,
  onStartDrawPolygon,
  onClearSearchArea,
  onResults,
}) {
  const [tab, setTab] = useState(0);
  const [f, setF] = useState(EMPTY);
  const [geo, setGeo] = useState(EMPTY_GEO);
  const [result, setResult] = useState(null); // {count, items, big}
  const [searching, setSearching] = useState(false);

  // f / geo‑ийн хамгийн сүүлийн утгыг callback / effect дотор ашиглах ref
  const fRef = useRef(f);
  fRef.current = f;
  const geoRef = useRef(geo);
  geoRef.current = geo;

  // Толгойн хайлтаас ирсэн утгыг "Нэр" талбарт сетлэнэ
  useEffect(() => {
    if (seed?.term) setF((p) => ({ ...p, name: seed.term }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.n]);

  // Засаг захиргаа — аймаг → сум → баг (dependent)
  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, true);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    f.aimag?.id,
    !!f.aimag?.id,
  );
  const { units: bagOptions } = useGetLegalUnits(
    "Баг/Хороо",
    f.sum?.id,
    !!f.sum?.id,
  );

  // Ангилал — level1 → level2 → level3 (dependent, GEONAME_TYPES)
  const [cat1Opts, setCat1Opts] = useState([]);
  const [cat2Opts, setCat2Opts] = useState([]);
  const [cat3Opts, setCat3Opts] = useState([]);

  const fetchCats = async (parent) => {
    try {
      const q = parent ? new URLSearchParams({ parent }).toString() : "";
      const res = await axiosInstance.get(endpoints.nameCategory.list(q));
      return res?.data?.results || res?.data || [];
    } catch (e) {
      return [];
    }
  };

  useEffect(() => {
    fetchCats(null).then(setCat1Opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (name, val) => setF((p) => ({ ...p, [name]: val }));

  // Ангилал сонгох — дараагийн түвшний сонголтыг татаж, доош нь цэвэрлэнэ
  const handleCat = async (level, value) => {
    if (level === 1) {
      setF((p) => ({ ...p, cat1: value, cat2: null, cat3: null }));
      setCat2Opts(value?.id ? await fetchCats(value.id) : []);
      setCat3Opts([]);
    } else if (level === 2) {
      setF((p) => ({ ...p, cat2: value, cat3: null }));
      setCat3Opts(value?.id ? await fetchCats(value.id) : []);
    } else {
      set("cat3", value);
    }
  };

  const flyToLocate = async (params) => {
    if (!onFlyTo) return;
    try {
      const q = new URLSearchParams(params).toString();
      const res = await axiosInstance.get(endpoints.nameCategory.locate(q));
      if (res?.data?.found) onFlyTo(res.data);
    } catch (e) {
      /* ignore */
    }
  };

  const handleUnit = (key, value) => {
    if (key === "aimag")
      setF((p) => ({ ...p, aimag: value, sum: null, bag: null }));
    else if (key === "sum") setF((p) => ({ ...p, sum: value, bag: null }));
    else set("bag", value);
    if (value?.id) flyToLocate({ unit: value.id });
  };

  // Нэрлэвэр бичихэд (debounce) тэр нэрлэвэр рүү нисэх
  const nomekTimer = useRef(null);
  useEffect(() => {
    if (nomekTimer.current) clearTimeout(nomekTimer.current);
    const code = (f.nomek || "").trim();
    if (!code || code.length < 3) return undefined;
    nomekTimer.current = setTimeout(() => flyToLocate({ nomek: code }), 500);
    return () => clearTimeout(nomekTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.nomek]);

  // Хайлтын query params бэлдэх
  const buildParams = (g, ff, pageSize) => {
    const params = { page_size: pageSize };
    if (ff.name) params.name = ff.name;
    if (ff.number) params.number = ff.number;
    if (ff.nomek) params.nomek = ff.nomek;
    const catId = catIdOf(ff);
    if (catId) params.type = catId;
    const unitId = unitIdOf(ff);
    if (unitId) params.unit_tree = unitId;
    if (ff.approved) params.is_approved = true;
    if (ff.border) params.is_border = true;
    if ((g.mode === "rect" || g.mode === "polygon") && g.ring?.length >= 3) {
      params.geom = ringToGeoJson(g.ring);
    } else if (g.mode === "circle" && g.lat != null) {
      params.lat = g.lat;
      params.lon = g.lon;
      params.radius_meter = g.radius;
    }
    return params;
  };

  const lastQueryRef = useRef({ g: EMPTY_GEO, ff: EMPTY });

  // ----- Хайлт гүйцэтгэх (текст + байршил) -----
  const runSearch = async (g, ff) => {
    lastQueryRef.current = { g, ff };
    const parts = textCqlParts(ff);
    const gp = geoCqlPart(g);
    if (gp) parts.push(gp);
    onSearch && onSearch(parts.length ? parts.join(" AND ") : "INCLUDE");

    setSearching(true);
    try {
      const q = new URLSearchParams(buildParams(g, ff, AUTO_LIMIT)).toString();
      const res = await axiosInstance.get(endpoints.geoname.list(q));
      const count = res?.data?.count ?? 0;
      const items = res?.data?.results || [];
      const big = count > AUTO_LIMIT;
      setResult({ count, items, big });
      // 10‑с дээш → тусдаа хүснэгтээр (газрын зургийн дээд талд).
      // 100‑с дээш бол эхлээд "Хайх" товч дарж ачаална.
      if (onResults) {
        if (count > TABLE_THRESHOLD && !big) onResults(items);
        else onResults([]);
      }
    } catch (e) {
      setResult({ count: 0, items: [], big: false });
      onResults && onResults([]);
    } finally {
      setSearching(false);
    }
  };

  // 100‑с дээш үед "Хайх" дарахад бүх илэрцийг (дээд хязгаартай) хүснэгтэд ачаална
  const showAll = async () => {
    const { g, ff } = lastQueryRef.current;
    setSearching(true);
    try {
      const q = new URLSearchParams(buildParams(g, ff, MAX_FETCH)).toString();
      const res = await axiosInstance.get(endpoints.geoname.list(q));
      onResults && onResults(res?.data?.results || []);
    } catch (e) {
      /* ignore */
    } finally {
      setSearching(false);
    }
  };

  // ----- Байршил: горим сонгомогц шууд зурж эхлэх -----
  const handleMode = (_e, mode) => {
    if (!mode) return;
    onClearSearchArea && onClearSearchArea();
    setGeo({ ...EMPTY_GEO, mode });

    const onDone = (g) => {
      setGeo(g);
      runSearch(g, fRef.current); // зурж дуусмагц автоматаар хайна
    };

    if (mode === "rect") {
      onStartDrawRectangle &&
        onStartDrawRectangle((ring) => {
          if (ring && ring.length >= 3)
            onDone({ ...EMPTY_GEO, mode: "rect", ring });
        });
    } else if (mode === "circle") {
      onStartDrawCircle &&
        onStartDrawCircle((center, radius) => {
          if (center)
            onDone({
              ...EMPTY_GEO,
              mode: "circle",
              lon: center[0],
              lat: center[1],
              radius,
            });
        });
    } else if (mode === "polygon") {
      onStartDrawPolygon &&
        onStartDrawPolygon((ring) => {
          if (ring && ring.length >= 3)
            onDone({ ...EMPTY_GEO, mode: "polygon", ring });
        });
    }
  };

  // Мэдээлэл таб — текст шүүлтүүр өөрчлөгдөхөд автоматаар хайна (debounce)
  const autoTimer = useRef(null);
  useEffect(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const hasFilter =
      f.name ||
      f.number ||
      catIdOf(f) ||
      unitIdOf(f) ||
      f.nomek ||
      f.approved ||
      f.border;
    if (!hasFilter) return undefined;
    autoTimer.current = setTimeout(
      () => runSearch(geoRef.current, fRef.current),
      600,
    );
    return () => clearTimeout(autoTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    f.name,
    f.number,
    f.cat1?.id,
    f.cat2?.id,
    f.cat3?.id,
    f.aimag?.id,
    f.sum?.id,
    f.bag?.id,
    f.nomek,
    f.approved,
    f.border,
  ]);

  const handleClear = () => {
    setF(EMPTY);
    setGeo(EMPTY_GEO);
    setResult(null);
    onClearSearchArea && onClearSearchArea();
    onResults && onResults([]);
    onClear && onClear();
  };

  const areaLabel = () => {
    if (geo.mode === "circle" && geo.lat != null)
      return `Тойрог · төв ${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} · радиус ${(
        geo.radius / 1000
      ).toFixed(2)} км`;
    if (geo.mode === "rect" && geo.ring?.length >= 3)
      return "Тэгш өнцөгт талбай сонгогдсон";
    if (geo.mode === "polygon" && geo.ring?.length >= 3)
      return `${geo.ring.length} цэгтэй дүрс сонгогдсон`;
    return null;
  };

  return (
    <Box sx={{ bgcolor: "#0675c908", borderBottom: "1px solid #e2e8f0" }}>
      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0 } }}
      >
        <Tab label="Мэдээлэл" />
        <Tab label="Байршил" />
      </Tabs>

      <Box sx={{ p: 1.5, maxHeight: 420, overflowY: "auto" }}>
        {/* --- Мэдээлэл --- */}
        {tab === 0 && (
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label="Нэр"
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <TextField
              size="small"
              label="Дугаар"
              value={f.number}
              onChange={(e) => set("number", e.target.value)}
            />

            <Box>
              <Typography variant="overline" color="text.secondary">
                Ангилал
              </Typography>
              <Stack sx={{ mt: 0.5 }} direction="row" spacing={1}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.cat1}
                  onChange={(_e, v) => handleCat(1, v)}
                  options={cat1Opts}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Үндсэн" />
                  )}
                />
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.cat2}
                  onChange={(_e, v) => handleCat(2, v)}
                  disabled={!f.cat1?.id}
                  options={cat2Opts}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Анхдагч" />
                  )}
                />
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.cat3}
                  onChange={(_e, v) => handleCat(3, v)}
                  disabled={!f.cat2?.id}
                  options={cat3Opts}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Дэд" />
                  )}
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">
                Засаг захиргааны нэгж
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.aimag}
                  onChange={(_e, v) => handleUnit("aimag", v)}
                  options={aimagOptions}
                  getOptionLabel={(o) => o?.unit || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Аймаг / Нийслэл" />
                  )}
                />
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.sum}
                  onChange={(_e, v) => handleUnit("sum", v)}
                  disabled={!f.aimag?.id}
                  options={sumOptions}
                  getOptionLabel={(o) => o?.unit || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Сум / Дүүрэг" />
                  )}
                />
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={f.bag}
                  onChange={(_e, v) => handleUnit("bag", v)}
                  disabled={!f.sum?.id}
                  options={bagOptions}
                  getOptionLabel={(o) => o?.unit || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Баг / Хороо" />
                  )}
                />
              </Stack>
            </Box>

            <TextField
              size="small"
              label="Нэрлэвэр"
              value={f.nomek}
              onChange={(e) => set("nomek", e.target.value)}
              placeholder="M-46-22"
            />

            <Box direction="row">
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={f.approved}
                    onChange={(e) => set("approved", e.target.checked)}
                  />
                }
                label="Батлагдсан"
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={f.border}
                    onChange={(e) => set("border", e.target.checked)}
                  />
                }
                label="Хилийн цэс"
              />
            </Box>
          </Stack>
        )}

        {/* --- Байршил --- */}
        {tab === 1 && (
          <Stack spacing={1.5}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={geo.mode}
              onChange={handleMode}
              sx={{ alignSelf: "center" }}
            >
              {MODES.map(({ value, label, Icon, tip }) => (
                <Tooltip key={value} title={`${tip}. (ESC — цуцлах)`} arrow>
                  <ToggleButton
                    value={value}
                    aria-label={label}
                    sx={{ px: 1.5 }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </ToggleButton>
                </Tooltip>
              ))}
            </ToggleButtonGroup>
            {areaLabel() && (
              <Typography
                variant="caption"
                sx={{ color: "#0675c9", fontWeight: 600 }}
              >
                {areaLabel()}
              </Typography>
            )}
          </Stack>
        )}

        {/* --- Үйлдлүүд (шууд хайдаг тул зөвхөн Цэвэрлэх) --- */}
        <Stack direction="row" sx={{ pt: 1.5 }}>
          <Button
            fullWidth
            size="small"
            color="inherit"
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={handleClear}
          >
            Цэвэрлэх
          </Button>
        </Stack>

        {/* --- Илэрц --- */}
        {result && (
          <Box sx={{ mt: 1.5 }}>
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                textAlign: "center",
                bgcolor: result.count ? "#16a34a14" : "#64748b14",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: result.count ? "#16a34a" : "text.secondary",
                }}
              >
                {result.count
                  ? `Нийт: ${result.count} илэрц олдлоо`
                  : "Илэрц олдсонгүй"}
              </Typography>
            </Box>

            {/* 100‑с дээш — "Хайх" дарж хүснэгтэд ачаална */}
            {result.big && (
              <Button
                fullWidth
                size="small"
                variant="contained"
                startIcon={<SearchIcon />}
                disabled={searching}
                onClick={showAll}
                sx={{ mt: 1 }}
              >
                Хүснэгтээр харах
              </Button>
            )}

            {/* 10‑с дээш (≤100) — газрын зургийн дээд талд хүснэгтээр харагдана */}
            {!result.big && result.count > TABLE_THRESHOLD && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1, textAlign: "center" }}
              >
                Илэрцийг газрын зургийн дээд талд хүснэгтээр харууллаа
              </Typography>
            )}

            {/* ≤10 — энд жагсаалтаар */}
            {!result.big &&
              result.count > 0 &&
              result.count <= TABLE_THRESHOLD &&
              result.items?.length > 0 && (
                <Stack
                  sx={{
                    mt: 1,
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 1,
                    bgcolor: "#fff",
                  }}
                  divider={<Divider />}
                >
                  {result.items.map((it) => (
                    <ListItemButton
                      key={it.id}
                      dense
                      onClick={() =>
                        it.lat != null &&
                        onFlyTo &&
                        onFlyTo({ center: [it.lon, it.lat], zoom: 14 })
                      }
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontWeight: 600 }}
                        >
                          {it.name || "—"}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                        >
                          {it.number}
                          {it.lat != null
                            ? ` · ${it.lat.toFixed(4)}, ${it.lon.toFixed(4)}`
                            : ""}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  ))}
                </Stack>
              )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

AdvancedSearch.propTypes = {
  onSearch: PropTypes.func,
  onClear: PropTypes.func,
  onFlyTo: PropTypes.func,
  seed: PropTypes.object,
  onStartDrawRectangle: PropTypes.func,
  onStartDrawCircle: PropTypes.func,
  onStartDrawPolygon: PropTypes.func,
  onClearSearchArea: PropTypes.func,
  onResults: PropTypes.func,
};
