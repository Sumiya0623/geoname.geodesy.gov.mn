"use client";

import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";

import {
  Box,
  Stack,
  Button,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import { Create as DrawIcon } from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

import { requestMapDraw } from "./mapDraw";

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
        const res = await axiosInstance.get(endpoints.constant.details(node.id));
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
  };

  const onSave = async () => {
    if (!drawType) {
      enqueueSnackbar("Дэд ангилал сонгоно уу", { variant: "warning" });
      return;
    }
    if (!nm.trim()) {
      enqueueSnackbar("Нэр бичнэ үү", { variant: "warning" });
      return;
    }
    if (!geojson) {
      enqueueSnackbar("Зураг дээр геометр зурна уу", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const statusId = rStatuses.find((s) => s.name === statusName)?.id || null;
      await axiosInstance.post(endpoints.recount.create, {
        project_id: projectId,
        draft: nm.trim(),
        ...(rStep?.id ? { step_id: rStep.id } : {}),
        ...(statusId ? { status_id: statusId } : {}),
        loc: geojson,
      });
      enqueueSnackbar(`"${nm}" — ${statusName} төлөвөөр бүртгэгдлээ`);
      reset();
      onClose?.();
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
        <MenuItem value="батлагдаагүй">Батлагдаагүй / уламжлалт (Маягт 2)</MenuItem>
      </TextField>

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
