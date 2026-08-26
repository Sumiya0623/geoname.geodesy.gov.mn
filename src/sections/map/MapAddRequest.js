"use client";

import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Step,
  Chip,
  Stack,
  Alert,
  Button,
  Stepper,
  Divider,
  MenuItem,
  StepLabel,
  TextField,
  StepContent,
  Typography,
  Autocomplete,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { enqueueSnackbar } from "notistack";

import axiosInstance, { endpoints } from "src/utils/axios";
import { angleToDirection } from "src/utils/geoDirection";
import { sortMn } from "src/utils/mn-collate";
import { useGetConstantsFordropdown } from "src/api/constant";
import PhotoDirectionPicker from "src/components/photo-direction-picker";

import { requestMapDraw, requestClearDraw } from "src/components/map/mapDraw";

// ----------------------------------------------------------------------
// «Шинээр» хүсэлт илгээх форм — ЗӨВХӨН /dashboard/map дээр, «Хүсэлт» табын
// доор inline нээгдэнэ. Шинэ нэр бүртгэх (MapAddName) урсгалтай ижил
// дараалалтай:
//   1) Ангилал  — Үндсэн → Анхдагч → Дэд (dependent, navч хүртэл)
//   2) Байршил  — газрын зураг дээр цэг тавина (эсвэл солбицол гараар)
//   3) Мэдээлэл — санал болгож буй нэр, нас, шалтгаан, тайлбар, зураг
// Хадгалахад RequestName (status='Шинээр') үүснэ; зураг нь хүсэлтийн
// /upload/‑аар хавсаргагдана (маягтын «Байршлын зураг» хэсэгт орно).
// ----------------------------------------------------------------------

const STEPS = ["Ангилал", "Байршил", "Мэдээлэл"];

// Ангиллын desc → хүний ойлгох геометрийн тайлбар
const GEOM_HINT = {
  Шугам: "шугаман объект",
  Талбай: "талбайлаг объект",
  Цэг: "цэгэн объект",
};

// Ангиллын desc → OpenLayers-ийн зурах төрөл (MapAddName-тэй ижил дүрэм)
function olDrawType(desc) {
  if (desc === "Шугам") return "LineString";
  if (desc === "Талбай") return "Polygon";
  return "Point";
}
const DRAW_LABEL = {
  Point: "цэг тавих",
  LineString: "шугам зурах",
  Polygon: "талбай зурах",
};

// Зурсан геометрээс ТӨЛӨӨЛӨХ цэг. RequestName нь геометр биш зөвхөн lat/lon
// хадгалдаг тул (маягтын «солбицол» мөр ч нэг цэг шаарддаг) шугамын дунджийг,
// талбайн талбайгаар жигнэсэн төвийг авна.
function centroidOf(gj) {
  const type = gj?.type || gj?.geometry?.type;
  const c = gj?.coordinates || gj?.geometry?.coordinates;
  if (!type || !c) return null;
  if (type === "Point") return c;
  if (type === "LineString") {
    // Уртаараа дундаж цэг — оройнуудын энгийн дундажаас илүү төлөөлнө
    const segs = [];
    let total = 0;
    for (let i = 1; i < c.length; i += 1) {
      const d = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
      total += d;
      segs.push(d);
    }
    if (!total) return c[0];
    let acc = 0;
    for (let i = 0; i < segs.length; i += 1) {
      if (acc + segs[i] >= total / 2) {
        const t = (total / 2 - acc) / (segs[i] || 1);
        return [
          c[i][0] + (c[i + 1][0] - c[i][0]) * t,
          c[i][1] + (c[i + 1][1] - c[i][1]) * t,
        ];
      }
      acc += segs[i];
    }
    return c[c.length - 1];
  }
  if (type === "Polygon") {
    const ring = c[0] || [];
    let a = 0;
    let x = 0;
    let y = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      a += cross;
      x += (ring[i][0] + ring[i + 1][0]) * cross;
      y += (ring[i][1] + ring[i + 1][1]) * cross;
    }
    if (Math.abs(a) < 1e-12) return ring[0] || null;
    return [x / (3 * a), y / (3 * a)];
  }
  return null;
}

export default function MapAddRequest({ status, onClose, onCreated }) {
  const [step, setStep] = useState(0);

  // ── 1) ангилал ──
  const [cat1, setCat1] = useState(null);
  const [cat2, setCat2] = useState(null);
  const [cat3, setCat3] = useState(null);
  const [cat1Opts, setCat1Opts] = useState([]);
  const [cat2Opts, setCat2Opts] = useState([]);
  const [cat3Opts, setCat3Opts] = useState([]);
  const leaf = [cat3, cat2, cat1].find((c) => c && !c.child_count) || null;

  // ── 2) байршил ──
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [geom, setGeom] = useState(null); // зурсан дүрс (GeoJSON, 4326)
  const [locChain, setLocChain] = useState(null); // аймаг → сум → баг
  const [locLoading, setLocLoading] = useState(false);
  const [locNotFound, setLocNotFound] = useState(false);

  // ── 3) мэдээлэл ──
  const [name1, setName1] = useState("");
  const [name2, setName2] = useState("");
  const [source, setSource] = useState("");
  const [age, setAge] = useState("");
  const [purpose, setPurpose] = useState([]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const { constants: ages } = useGetConstantsFordropdown("GEONAME_AGES");
  const { constants: purposes } =
    useGetConstantsFordropdown("REQUEST_PURPOSES");

  // Ангиллын алдааг ДУУГҮЙ залгивал «хоосон жагсаалт»‑аас ялгагдахгүй тул
  // алдааны мессежийг хадгалж, талбарын доор шууд харуулна.
  const [catError, setCatError] = useState("");
  const [catLoading, setCatLoading] = useState(false);

  const fetchCats = useCallback(async (parent) => {
    const q = parent ? new URLSearchParams({ parent }).toString() : "";
    const res = await axiosInstance.get(endpoints.nameCategory.list(q));
    // Backend нь албан ёсны ангиллын код (code, id)-оор эрэмбэлдэг. Сонгоход
    // хайхад хүндрэлтэй тул ЭНД цагаан толгойн дарааллаар (А→Я) эрэмбэлнэ.
    return sortMn(res?.data?.results || res?.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    setCatLoading(true);
    setCatError("");
    fetchCats(null)
      .then((v) => {
        if (!alive) return;
        setCat1Opts(v);
        if (!v.length) setCatError("Ангилал олдсонгүй (жагсаалт хоосон).");
      })
      .catch((e) => {
        if (!alive) return;
        setCat1Opts([]);
        setCatError(
          e?.response?.data?.error?.message ||
            e?.response?.data?.detail ||
            e?.message ||
            "Ангилал татахад алдаа гарлаа",
        );
      })
      .finally(() => {
        if (alive) setCatLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchCats]);

  const loadKids = async (node) => {
    if (!node?.id || !node.child_count) return [];
    try {
      return await fetchCats(node.id);
    } catch (e) {
      setCatError(e?.response?.data?.detail || "Дэд ангилал татаж чадсангүй");
      return [];
    }
  };

  const handleCat = async (level, value) => {
    if (level === 1) {
      setCat1(value);
      setCat2(null);
      setCat3(null);
      setCat3Opts([]);
      setCat2Opts(await loadKids(value));
    } else if (level === 2) {
      setCat2(value);
      setCat3(null);
      setCat3Opts(await loadKids(value));
    } else {
      setCat3(value);
    }
  };

  // Солбицол → харьяалах ЗЗ нэгжийн шатлал (аймаг/сум/баг)
  useEffect(() => {
    const la = parseFloat(lat);
    const lo = parseFloat(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) {
      setLocChain(null);
      setLocNotFound(false);
      return undefined;
    }
    let alive = true;
    setLocLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await axiosInstance.get(
          endpoints.request.locate(`lat=${la}&lon=${lo}`),
        );
        if (!alive) return;
        setLocChain(res.data?.found ? res.data.chain || [] : null);
        setLocNotFound(!res.data?.found);
      } catch (e) {
        if (alive) {
          setLocChain(null);
          setLocNotFound(true);
        }
      } finally {
        if (alive) setLocLoading(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [lat, lon]);

  // Зурах хэрэгсэл нь сонгосон АНГИЛЛЫН геометрийн төрлөөр тодорхойлогдоно
  const drawType = olDrawType(leaf?.desc);

  const onPick = async () => {
    enqueueSnackbar(
      `Газрын зураг дээр ${DRAW_LABEL[drawType]} уу (ESC — болих)`,
      { variant: "info" },
    );
    const gj = await requestMapDraw(drawType);
    const c = centroidOf(gj);
    if (c?.length >= 2) {
      setGeom(gj);
      setLon(String(Number(c[0]).toFixed(6)));
      setLat(String(Number(c[1]).toFixed(6)));
      enqueueSnackbar(
        drawType === "Point"
          ? "Байршил тэмдэглэгдлээ"
          : "Зурсан дүрсийн төв цэгээр байршил тэмдэглэгдлээ",
        { variant: "success" },
      );
    }
  };

  const onSave = async () => {
    if (!status?.id) {
      enqueueSnackbar("«Шинээр» төлөв олдсонгүй", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const res = await axiosInstance.post(endpoints.request.create, {
        status_id: status.id,
        type_id: leaf?.id || null,
        age_id: age || null,
        purpose_ids: purpose.map((p) => p.id),
        description: description || "",
        lat: lat === "" ? null : Number(lat),
        lon: lon === "" ? null : Number(lon),
        // Зурсан дүрс — шугам/талбайг цэг болгож хураангуйлахгүй
        geoloc: geom,
        options: [{ name: name1.trim(), name2: name2.trim(), desc: source }],
        contacts: [],
      });
      const id = res?.data?.id;
      // Зураг + ЗОВХИС (зураг дарсан зүг) — desc нь `descs`-ээр зэрэгцээ явна.
      // Зовхистой зураг нь маягтын «Гэрэл зураг /зураг дарсан зүг, чиг/»
      // хэсэгт ордог.
      if (id && files.length) {
        const fd = new FormData();
        files.forEach((p) => {
          fd.append("photos", p.file);
          fd.append("descs", angleToDirection(p.deg));
        });
        try {
          await axiosInstance.post(endpoints.request.upload(id), fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (e) {
          enqueueSnackbar("Зураг хавсаргахад алдаа гарлаа", {
            variant: "warning",
          });
        }
      }
      enqueueSnackbar(`«${name1.trim()}» хүсэлт илгээгдлээ`, {
        variant: "success",
      });
      requestClearDraw();
      onCreated?.();
      onClose?.();
    } catch (error) {
      const d = error?.response?.data;
      enqueueSnackbar(
        d?.detail || (d && JSON.stringify(d)) || "Илгээхэд алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setSaving(false);
    }
  };

  const catField = (value, level, options, disabled, label) => (
    <Autocomplete
      size="small"
      fullWidth
      value={value}
      options={options}
      disabled={disabled}
      loading={level === 1 && catLoading}
      // Форм нь газрын зураг дээр zIndex:1400 Paper дотор хөвдөг тул popup‑ийг
      // (анхдагч 1300) дээш өргөхгүй бол ЖАГСААЛТ ЦОНХНЫ АРД НУУГДАНА.
      slotProps={{ popper: { sx: { zIndex: 1600 } } }}
      onChange={(_e, v) => handleCat(level, v)}
      getOptionLabel={(o) => o?.name || ""}
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      noOptionsText={catError || "Сонголт алга"}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {level === 1 && catLoading ? (
                  <CircularProgress size={16} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );

  const hasLoc = lat !== "" && lon !== "";

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Stepper activeStep={step} orientation="vertical" nonLinear>
        {/* ── 1) Ангилал ── */}
        <Step completed={!!leaf}>
          <StepLabel
            onClick={() => setStep(0)}
            sx={{ cursor: "pointer", py: 0.5 }}
            optional={
              leaf ? (
                <Typography variant="caption" color="text.secondary">
                  {leaf.name}
                </Typography>
              ) : null
            }
          >
            {STEPS[0]}
          </StepLabel>
          <StepContent>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              {catField(cat1, 1, cat1Opts, false, "Үндсэн")}
              {!!catError && (
                <Alert severity="warning" sx={{ py: 0 }}>
                  {catError}
                </Alert>
              )}
              {!!cat2Opts.length &&
                catField(cat2, 2, cat2Opts, !cat1?.id, "Анхдагч")}
              {!!cat3Opts.length &&
                catField(cat3, 3, cat3Opts, !cat2?.id, "Дэд")}

              {leaf?.desc && (
                <Typography variant="caption" color="text.secondary">
                  {leaf.name} — {GEOM_HINT[leaf.desc] || leaf.desc}
                </Typography>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!leaf}
                  onClick={() => setStep(1)}
                >
                  Үргэлжлүүлэх
                </Button>
                <Button size="small" color="inherit" onClick={onClose}>
                  Болих
                </Button>
              </Stack>
              {!leaf && (
                <Typography variant="caption" color="text.disabled">
                  Хамгийн дэд (задрахгүй) ангилал хүртэл сонгоно уу.
                </Typography>
              )}
            </Stack>
          </StepContent>
        </Step>

        {/* ── 2) Байршил ── */}
        <Step completed={hasLoc}>
          <StepLabel
            onClick={() => leaf && setStep(1)}
            sx={{ cursor: leaf ? "pointer" : "default", py: 0.5 }}
            optional={
              hasLoc ? (
                <Typography variant="caption" color="text.secondary">
                  {lat}, {lon}
                </Typography>
              ) : null
            }
          >
            {STEPS[1]}
          </StepLabel>
          <StepContent>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Icon icon="solar:map-point-add-bold" />}
                onClick={onPick}
              >
                Газрын зураг дээр {DRAW_LABEL[drawType]}
              </Button>

              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="Өргөрөг (lat)"
                  value={lat}
                  onChange={(e) => {
                    setLat(e.target.value);
                    setGeom(null); // гараар засвал зурсан дүрс хүчингүй
                  }}
                />
                <TextField
                  size="small"
                  label="Уртраг (lon)"
                  value={lon}
                  onChange={(e) => {
                    setLon(e.target.value);
                    setGeom(null);
                  }}
                />
              </Stack>

              {locLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Солбицлыг шалгаж байна...
                  </Typography>
                </Stack>
              )}
              {locNotFound && (
                <Alert severity="warning" sx={{ py: 0 }}>
                  Энэ солбицолд харьяалагдах нэгж олдсонгүй.
                </Alert>
              )}
              {!!locChain?.length && (
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {locChain.map((c, i) => (
                    <Chip
                      key={c.id}
                      variant="soft"
                      color={i === locChain.length - 1 ? "primary" : "default"}
                      label={c.unit}
                    />
                  ))}
                </Stack>
              )}

              <Stack direction="row" spacing={1}>
                <Button size="small" color="inherit" onClick={() => setStep(0)}>
                  Буцах
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!hasLoc}
                  onClick={() => setStep(2)}
                >
                  Үргэлжлүүлэх
                </Button>
              </Stack>
            </Stack>
          </StepContent>
        </Step>

        {/* ── 3) Мэдээлэл ── */}
        <Step>
          <StepLabel
            onClick={() => leaf && hasLoc && setStep(2)}
            sx={{ cursor: leaf && hasLoc ? "pointer" : "default", py: 0.5 }}
          >
            {STEPS[2]}
          </StepLabel>
          <StepContent>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <TextField
                size="small"
                required
                label="Санал болгож буй нэр"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
              />
              <TextField
                size="small"
                label="Хоёр дахь санал"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
              />
              <TextField
                size="small"
                label="Эх сурвалж"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <TextField
                size="small"
                select
                label="Нэрийн нас"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                SelectProps={{ MenuProps: { sx: { zIndex: 1600 } } }}
              >
                <MenuItem value="">—</MenuItem>
                {ages.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </TextField>
              <Autocomplete
                multiple
                size="small"
                options={purposes}
                value={purpose}
                slotProps={{ popper: { sx: { zIndex: 1600 } } }}
                onChange={(_e, v) => setPurpose(v)}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => (
                  <TextField {...params} label="Шалтгаан" />
                )}
              />
              <TextField
                size="small"
                multiline
                minRows={2}
                label="Тайлбар"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Зураг + зовхис — компас дээр чирж зүгийг тохируулна
                  (нэр нэмэх формуудтай нэгдсэн UI). */}
              <Box>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Гэрэл зураг + зовхис (зураг дарсан зүг)
                </Typography>
                <PhotoDirectionPicker value={files} onChange={setFiles} />
              </Box>

              <Divider />
              <Stack direction="row" spacing={1}>
                <Button size="small" color="inherit" onClick={() => setStep(1)}>
                  Буцах
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  disabled={!name1.trim() || saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <Icon icon="solar:plain-bold" />
                    )
                  }
                  onClick={onSave}
                >
                  Хүсэлт илгээх
                </Button>
              </Stack>
            </Stack>
          </StepContent>
        </Step>
      </Stepper>
    </Box>
  );
}

MapAddRequest.propTypes = {
  status: PropTypes.object,
  onClose: PropTypes.func,
  onCreated: PropTypes.func,
};
