"use client";

import PropTypes from "prop-types";
import { useRef, useMemo, useState, useEffect } from "react";

import {
  Box,
  Stack,
  Switch,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
} from "@mui/material";
import { Create as DrawIcon } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

import { requestMapDraw, getMapExtent, requestRecountReload } from "./mapDraw";

// Ангиллын desc (Цэг/Шугам/Талбай) → OpenLayers Draw төрөл
function olDrawType(desc) {
  if (desc === "Шугам") return "LineString";
  if (desc === "Талбай") return "Polygon";
  return "Point";
}
const DRAW_LABEL = { Point: "цэг", LineString: "шугам", Polygon: "талбай" };

// ----------------------------------------------------------------------
// Төслийн газрын зураг дээр ШИНЭ нэр нэмэх форм (зүүн панелд inline).
// Ангилал (Үндсэн→Анхдагч→Дэд, dependent) → Нэр. Дэд (навч) сонгомогц
// түүний геометр төрлөөр зурах хэрэгсэл идэвхжинэ. Хадгалахад ReCount
// (статус "шинэ", draft=нэр, loc=зурсан геометр) үүснэ.
// ----------------------------------------------------------------------

export default function MapAddName({ onClose, projectId }) {
  const [cat1, setCat1] = useState(null);
  const [cat2, setCat2] = useState(null);
  const [cat3, setCat3] = useState(null);
  const [cat1Opts, setCat1Opts] = useState([]);
  const [cat2Opts, setCat2Opts] = useState([]);
  const [cat3Opts, setCat3Opts] = useState([]);
  const [nm, setNm] = useState("");
  const [statusName, setStatusName] = useState("шинэ"); // шинэ→Маягт6, батлагдаагүй→Маягт2
  const [drawType, setDrawType] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [saving, setSaving] = useState(false);

  // Батлагдсан нэрэнд геометр оноох горим (байршил зөрүүтэй)
  const [approvedMode, setApprovedMode] = useState(false);
  const [apprName, setApprName] = useState(null); // сонгосон батлагдсан GeoName
  const [apprOpts, setApprOpts] = useState([]);
  const [apprLoading, setApprLoading] = useState(false);
  const apprTimer = useRef(null);

  const { constants: rStatuses } = useGetConstantsFordropdown("RECOUNT_STATUS");
  const { constants: rSteps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const rStep = useMemo(
    () => rSteps.find((s) => s.name === "Суурин судалгаа") || null,
    [rSteps],
  );

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
  }, []);

  // Навч (доош нь хүүхэдгүй) сонгогдвол — desc‑ээр зурах төрлийг тогтооно
  const resolveLeaf = async (node, childOpts) => {
    setDrawType(null);
    setGeojson(null);
    if (node?.id && childOpts.length === 0) {
      try {
        const res = await axiosInstance.get(
          endpoints.constant.details(node.id),
        );
        setDrawType(olDrawType(res?.data?.desc));
      } catch (e) {
        setDrawType("Point");
      }
    }
  };

  const handleCat = async (level, value) => {
    if (level === 1) {
      setCat1(value);
      setCat2(null);
      setCat3(null);
      const o2 = value?.id ? await fetchCats(value.id) : [];
      setCat2Opts(o2);
      setCat3Opts([]);
      resolveLeaf(value, o2);
    } else if (level === 2) {
      setCat2(value);
      setCat3(null);
      const o3 = value?.id ? await fetchCats(value.id) : [];
      setCat3Opts(o3);
      resolveLeaf(value, o3);
    } else {
      setCat3(value);
      resolveLeaf(value, []);
    }
  };

  // Батлагдсан нэрсийг харагдаж буй сумын нутгаас хайх (debounce)
  const searchApproved = (text) => {
    if (apprTimer.current) clearTimeout(apprTimer.current);
    apprTimer.current = setTimeout(async () => {
      setApprLoading(true);
      try {
        const ext = getMapExtent(); // [minx,miny,maxx,maxy] 4326
        const params = new URLSearchParams({
          is_approved: "true",
          page_size: "30",
          ordering: "name",
        });
        if (text && text.trim()) params.set("search", text.trim());
        if (ext) params.set("unit_bbox", ext.join(","));
        const res = await axiosInstance.get(
          endpoints.geoname.list(params.toString()),
        );
        setApprOpts(res?.data?.results || []);
      } catch (e) {
        setApprOpts([]);
      } finally {
        setApprLoading(false);
      }
    }, 350);
  };

  // Батлагдсан нэр сонгоход — төрлөөсөө зурах хэрэгслийг тогтооно
  const onSelectApproved = async (name) => {
    setApprName(name);
    setGeojson(null);
    setDrawType(null);
    const typeId = name?.type_id || name?.type?.id || name?.type;
    if (!typeId) {
      setDrawType("Point");
      return;
    }
    try {
      const res = await axiosInstance.get(endpoints.constant.details(typeId));
      setDrawType(olDrawType(res?.data?.desc));
    } catch (e) {
      setDrawType("Point");
    }
  };

  const onDraw = async () => {
    enqueueSnackbar(
      `Газрын зураг дээр ${DRAW_LABEL[drawType]} зурна уу (ESC — болих)`,
      { variant: "info" },
    );
    const gj = await requestMapDraw(drawType);
    if (gj) {
      setGeojson(gj);
      enqueueSnackbar("Геометр зурагдлаа", { variant: "success" });
    }
  };

  const reset = () => {
    setCat1(null);
    setCat2(null);
    setCat3(null);
    setCat2Opts([]);
    setCat3Opts([]);
    setNm("");
    setDrawType(null);
    setGeojson(null);
    setApprName(null);
    setApprOpts([]);
  };

  const onSave = async () => {
    if (!drawType) {
      enqueueSnackbar(
        approvedMode ? "Батлагдсан нэр сонгоно уу" : "Дэд ангилал сонгоно уу",
        { variant: "warning" },
      );
      return;
    }
    if (!approvedMode && !nm.trim()) {
      enqueueSnackbar("Нэр бичнэ үү", { variant: "warning" });
      return;
    }
    if (approvedMode && !apprName?.id) {
      enqueueSnackbar("Батлагдсан нэр сонгоно уу", { variant: "warning" });
      return;
    }
    if (!geojson) {
      enqueueSnackbar("Зураг дээр геометр зурна уу", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      if (approvedMode) {
        // Батлагдсан нэр — "байршил" (зөрүүтэй) БА "ижил" (нэр нь батлагдсантай
        // ижил тул) хоёуланг нь автоматаар онооно.
        const statusIds = ["байршил", "ижил"]
          .map((n) => rStatuses.find((s) => s.name === n)?.id)
          .filter(Boolean);
        await axiosInstance.post(endpoints.recount.create, {
          project_id: projectId,
          name_id: apprName.id,
          ...(rStep?.id ? { step_id: rStep.id } : {}),
          ...(statusIds.length ? { status_ids: statusIds } : {}),
          loc: geojson,
        });
        enqueueSnackbar(
          `"${apprName.name}" — байршил, ижил төлөвөөр геометр оногдлоо`,
        );
      } else {
        const statusId =
          rStatuses.find((s) => s.name === statusName)?.id || null;
        await axiosInstance.post(endpoints.recount.create, {
          project_id: projectId,
          draft: nm.trim(),
          ...(rStep?.id ? { step_id: rStep.id } : {}),
          ...(statusId ? { status_ids: [statusId] } : {}),
          loc: geojson,
        });
        enqueueSnackbar(`"${nm}" — ${statusName} төлөвөөр бүртгэгдлээ`);
      }
      // Хадгалсны дараа форм ХООСОРНО ч НЭЭЛТТЭЙ хэвээр (дараалан нэр нэмэхэд).
      reset();
      requestRecountReload(); // газрын зурагт шинэ recount тусна
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Бүртгэхэд алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  const ac = (value, level, options, disabled, label) => (
    <Autocomplete
      size="small"
      sx={{ flex: 1, minWidth: 0 }}
      value={value}
      onChange={(_e, v) => handleCat(level, v)}
      disabled={disabled}
      options={options}
      getOptionLabel={(o) => o?.name || ""}
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );

  return (
    <Box sx={{ p: 1.5 }}>
      {/* Горим сэлгэх: шинэ нэр ↔ батлагдсан нэрэнд геометр оноох */}
      <FormControlLabel
        sx={{ mb: 1 }}
        control={
          <Switch
            size="small"
            checked={approvedMode}
            onChange={(e) => {
              setApprovedMode(e.target.checked);
              reset();
            }}
          />
        }
        label={<Typography variant="body2">Батлагдсан нэр</Typography>}
      />
      <Divider sx={{ mb: 1.5 }} />

      {approvedMode ? (
        <>
          <Autocomplete
            size="small"
            fullWidth
            filterOptions={(x) => x}
            options={apprOpts}
            loading={apprLoading}
            value={apprName}
            onChange={(_e, v) => onSelectApproved(v)}
            onInputChange={(_e, v, reason) => {
              if (reason === "input") searchApproved(v);
            }}
            getOptionLabel={(o) =>
              o?.name ? `${o.name}${o.number ? ` (${o.number})` : ""}` : ""
            }
            isOptionEqualToValue={(o, v) => o?.id === v?.id}
            noOptionsText="Харагдаж буй хүрээнд батлагдсан нэр алга"
            renderInput={(params) => (
              <TextField
                {...params}
                label="Батлагдсан нэр хайх (харагдах сумын нутгаас)"
              />
            )}
            sx={{ mb: 1.5 }}
          />
          {apprName && (
            <Typography variant="body2" sx={{ mb: 1.5 }} color="warning.main">
              Төлөв: <b>Байршил зөрүүтэй</b> (автоматаар)
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography variant="overline" color="text.secondary">
            Ангилал
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 1.5 }}>
            {ac(cat1, 1, cat1Opts, false, "Үндсэн")}
            {ac(cat2, 2, cat2Opts, !cat1?.id, "Анхдагч")}
            {ac(cat3, 3, cat3Opts, !cat2?.id, "Дэд")}
          </Stack>

          <TextField
            size="small"
            label="Нэр"
            fullWidth
            value={nm}
            onChange={(e) => setNm(e.target.value)}
            sx={{ mb: 1.5 }}
          />

          <TextField
            select
            size="small"
            label="Төлөв"
            fullWidth
            value={statusName}
            onChange={(e) => setStatusName(e.target.value)}
            sx={{ mb: 1.5 }}
          >
            <MenuItem value="шинэ">Шинэ нэр (Маягт 6)</MenuItem>
            <MenuItem value="батлагдаагүй">
              Батлагдаагүй / уламжлалт (Маягт 2)
            </MenuItem>
          </TextField>
        </>
      )}

      {drawType && (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          <Typography variant="body2">
            Зурах төрөл: <b>{DRAW_LABEL[drawType]}</b>
          </Typography>
          <Button variant="outlined" startIcon={<DrawIcon />} onClick={onDraw}>
            Газрын зураг дээр зурах
          </Button>
          {geojson && (
            <Typography variant="caption" color="success.main">
              ✓ Геометр зурагдсан
            </Typography>
          )}
        </Stack>
      )}

      <Button
        variant="contained"
        fullWidth
        disabled={saving || !geojson}
        onClick={onSave}
      >
        Хадгалах
      </Button>
    </Box>
  );
}

MapAddName.propTypes = {
  onClose: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
