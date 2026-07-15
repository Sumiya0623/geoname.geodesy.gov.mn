import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Stack,
  Alert,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  Typography,
  FormControl,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// OSM маягийн ХИЛ ДАГУУ нэр — polygon layer‑ийн захын шугам дагуулж, дотогш
// шилжүүлж нэрийг байрлуулна (followLine + PerpendicularOffset). Одоогийн
// төлөвийг `initial`‑ээр урьдчилан дүүргэнэ (edit).
// ----------------------------------------------------------------------

const FONTS = [
  "Arial",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Georgia",
  "Courier New",
];

export default function WorkspaceBoundaryLabelForm({
  workspaceId,
  layer,
  initial,
  baseSldRef,
  onApplied,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState([]);
  const [labelField, setLabelField] = useState(initial?.label_field || "name");
  const [offset, setOffset] = useState(initial?.offset ?? 9);
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 12);
  const [fontFamily, setFontFamily] = useState(initial?.font_family || "Arial");
  const [fill, setFill] = useState(initial?.fill || "#333333");
  const [stroke, setStroke] = useState(initial?.stroke || "#888888");
  const [repeat, setRepeat] = useState(initial?.repeat ?? 400);
  const [scaleMin, setScaleMin] = useState(initial?.scale_min ?? "");
  const [scaleMax, setScaleMax] = useState(initial?.scale_max ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // initial ирвэл (edit) урьдчилан дүүргэнэ
  useEffect(() => {
    if (!initial) return;
    setLabelField(initial.label_field || "name");
    setOffset(initial.offset ?? 9);
    setFontSize(initial.font_size ?? 12);
    setFontFamily(initial.font_family || "Arial");
    setFill(initial.fill || "#333333");
    setStroke(initial.stroke || "#888888");
    setRepeat(initial.repeat ?? 400);
    setScaleMin(initial.scale_min ?? "");
    setScaleMax(initial.scale_max ?? "");
  }, [initial]);

  useEffect(() => {
    if (!workspaceId || !layer) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await axiosInstance.get(
          endpoints.workspace.gsLayerFields(workspaceId, layer)
        );
        if (!active) return;
        const fs = res?.data?.results || [];
        setFields(fs);
      } catch (e) {
        if (active) setError(e?.response?.data?.detail || e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId, layer]);

  const handleApply = useCallback(async () => {
    if (!labelField) {
      setError("Нэрийн талбар сонгоно уу");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // GeoStyler‑ийн одоогийн rule‑ийг base болгон авна — хил дагуу нэрийг түүн
      // дээр нэмж, rule засвар алдагдахгүйгээр ХАМТ хадгална.
      let baseSld = null;
      if (baseSldRef?.current) {
        try {
          baseSld = await baseSldRef.current();
        } catch {
          baseSld = null;
        }
      }
      await axiosInstance.post(
        endpoints.workspace.gsBoundaryLabel(workspaceId),
        {
          layer,
          label_field: labelField,
          offset: Number(offset) || 0,
          font_size: Number(fontSize) || 12,
          font_family: fontFamily,
          fill,
          stroke,
          repeat: Number(repeat) || 400,
          ...(scaleMin ? { scale_min: Number(scaleMin) } : {}),
          ...(scaleMax ? { scale_max: Number(scaleMax) } : {}),
          ...(baseSld ? { base_sld: baseSld } : {}),
        }
      );
      enqueueSnackbar("Хадгалагдлаа", { variant: "success" });
      onApplied && onApplied();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    labelField,
    workspaceId,
    layer,
    offset,
    fontSize,
    fontFamily,
    fill,
    stroke,
    repeat,
    scaleMin,
    scaleMax,
    baseSldRef,
    enqueueSnackbar,
    onApplied,
  ]);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Нэр захын (boundary) шугам дагуулж, дотогш шилжинэ. GeoServer‑ийн
        followLine ашигладаг тул эндээс тохируулна.
      </Typography>

      {loading ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {error && <Alert severity="error">{String(error)}</Alert>}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <FormControl size="small" fullWidth>
              <InputLabel>Нэрийн талбар</InputLabel>
              <Select
                label="Нэрийн талбар"
                value={labelField}
                onChange={(e) => setLabelField(e.target.value)}
              >
                {fields.map((f) => (
                  <MenuItem key={f.name} value={f.name}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              type="number"
              label="Шилжилт (offset)"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              helperText="+ дотогш, − гадагш"
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Фонт</InputLabel>
              <Select
                label="Фонт"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
              >
                {FONTS.map((f) => (
                  <MenuItem key={f} value={f} sx={{ fontFamily: f }}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              type="number"
              label="Үсгийн хэмжээ"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
            />

            <TextField
              size="small"
              type="color"
              label="Текстийн өнгө"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              type="color"
              label="Шугамын (stroke) өнгө"
              value={stroke}
              onChange={(e) => setStroke(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              type="number"
              label="Том масштаб (их зумд алга)"
              value={scaleMin}
              onChange={(e) => setScaleMin(e.target.value)}
              placeholder="жишээ: 200000"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">1:</InputAdornment>
                ),
              }}
            />

            <TextField
              size="small"
              type="number"
              label="Жижиг масштаб (жижиг зумд алга)"
              value={scaleMax}
              onChange={(e) => setScaleMax(e.target.value)}
              placeholder="жишээ: 5000000"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">1:</InputAdornment>
                ),
              }}
            />
          </Box>

          <LoadingButton
            variant="contained"
            color="primary"
            loading={submitting}
            disabled={loading || !labelField}
            onClick={handleApply}
            sx={{ alignSelf: "flex-end" }}
          >
            Хадгалах
          </LoadingButton>
        </Stack>
      )}
    </Box>
  );
}

WorkspaceBoundaryLabelForm.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  layer: PropTypes.string,
  initial: PropTypes.object,
  baseSldRef: PropTypes.object,
  onApplied: PropTypes.func,
};
