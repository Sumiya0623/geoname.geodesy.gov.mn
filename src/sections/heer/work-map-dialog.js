"use client";

import PropTypes from "prop-types";
import { useRef, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Alert,
  Dialog,
  Button,
  TextField,
  Typography,
  DialogTitle,
  Autocomplete,
  DialogContent,
  CircularProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// Ажлын зураг (хээрийн судалгаа) — тухайн төслийн дахин тооллогын (recount)
// цэгүүдийг A0 хэвлэлийн эх болгож үүсгэнэ. Нэрийн зурагтай ижил хөдөлгүүр
// (mapprint) — зөвхөн нэрийн давхаргын оронд recount_view зурагдана.
// Сумдыг тооллогын байршлаас АВТО тодорхойлж, preview‑г шууд харуулна.
// ----------------------------------------------------------------------

export default function WorkMapDialog({ open, onClose, projectId }) {
  const { enqueueSnackbar } = useSnackbar();
  const debounceRef = useRef(null);

  const [unitOpts, setUnitOpts] = useState([]);
  const [units, setUnits] = useState([]);
  const [recountCount, setRecountCount] = useState(null);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const [previewImg, setPreviewImg] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [pageUnit, setPageUnit] = useState(null); // preview хийх сум (хуудас)

  const unitIds = units.map((u) => u.id);
  const unitKey = unitIds.join(",");
  // Хуудас бүр НЭГ сум — preview‑д аль хуудсыг харахаа сонгоно
  const previewUnit = unitIds.includes(pageUnit) ? pageUnit : unitIds[0];

  // Нээхэд — тооллогын байршлаас сумдыг авто тодорхойлж бүгдийг сонгоно
  useEffect(() => {
    if (!open || !projectId) return;
    setUnitsLoading(true);
    axiosInstance
      .get(endpoints.raster.workUnits(`project=${projectId}`))
      .then((res) => {
        const rows = res?.data?.results || [];
        setUnitOpts(rows);
        setUnits(rows);
        setRecountCount(res?.data?.recount_count ?? 0);
      })
      .catch(() => {
        setUnitOpts([]);
        setUnits([]);
        setRecountCount(0);
      })
      .finally(() => setUnitsLoading(false));
  }, [open, projectId]);

  // Preview — сонголт өөрчлөгдөх бүрд (debounce)
  useEffect(() => {
    if (!open || !projectId) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!unitKey || !previewUnit) {
      setPreviewImg(null);
      setMeta(null);
      return undefined;
    }
    setPreviewLoading(true);
    debounceRef.current = setTimeout(() => {
      const t = new Date().getTime();
      axiosInstance
        .get(
          endpoints.raster.workPreview(
            `project=${projectId}&units=${unitKey}&unit=${previewUnit}&_t=${t}`,
          ),
        )
        .then((res) => {
          setPreviewImg(res.data?.image || null);
          setMeta(res.data || null);
        })
        .catch((e) => {
          setPreviewImg(null);
          setMeta(null);
          enqueueSnackbar(
            e?.response?.data?.detail || "Зураг бэлтгэхэд алдаа гарлаа",
            { variant: "warning" },
          );
        })
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, unitKey, previewUnit]);

  const handleClose = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onClose?.();
  }, [onClose]);

  // A0 PDF үүсгэж шинэ цонхонд нээнэ (DB‑д хадгалахгүй — эхлээд харах)
  const handlePrint = async () => {
    if (!unitIds.length) {
      enqueueSnackbar("Сум сонгоно уу", { variant: "warning" });
      return;
    }
    setPrinting(true);
    try {
      const res = await axiosInstance.post(
        endpoints.raster.workPrint,
        // Арын сканердсан зураг тул 250dpi нь 35МБ/50сек болдог — 170 хангалттай
        { project: projectId, units: unitIds, dpi: 170 },
        { responseType: "blob" },
      );
      const blob = res?.data;
      if (!blob || (blob.type && !blob.type.includes("pdf"))) {
        let msg = "Зураг үүсгэхэд алдаа гарлаа";
        try {
          msg = JSON.parse(await blob.text())?.detail || msg;
        } catch (_) {
          /* JSON биш бол анхдагч мессеж */
        }
        enqueueSnackbar(msg, { variant: "warning" });
        return;
      }
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      enqueueSnackbar("Ажлын зураг үүслээ");
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Зураг үүсгэхэд алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setPrinting(false);
    }
  };

  const scaleText = meta?.scale
    ? `1 : ${Number(meta.scale).toLocaleString()}`
    : "—";

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Iconify icon="solar:map-bold" />
        Ажлын зураг үүсгэх
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: 560 }}>
          <Stack spacing={2.5} sx={{ p: 2.5, width: { md: 340 }, flexShrink: 0 }}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Тухайн төслийн дахин тооллогын цэгүүдээр зурагдана.
              {recountCount != null ? ` Тооллого: ${recountCount}` : ""}
            </Alert>

            <Autocomplete
              multiple
              size="small"
              loading={unitsLoading}
              options={unitOpts}
              value={units}
              onChange={(_e, v) => setUnits(v)}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderTags={(value, getTagProps) =>
                value.map((o, i) => (
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  <Chip
                    size="small"
                    label={o.unit}
                    {...getTagProps({ index: i })}
                    key={o.id}
                  />
                ))
              }
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Сум / Дүүрэг (авто)"
                  placeholder="Тооллогын байршлаас"
                />
              )}
            />

            {units.length > 1 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Хуудас (сум тус бүр нэг хуудас) — үзэх хуудсаа сонгоно уу
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
                  {units.map((u, i) => (
                    <Chip
                      key={u.id}
                      size="small"
                      label={`${i + 1}. ${u.unit}`}
                      color={u.id === previewUnit ? "primary" : "default"}
                      variant={u.id === previewUnit ? "filled" : "outlined"}
                      onClick={() => setPageUnit(u.id)}
                    />
                  ))}
                </Stack>
              </Box>
            )}

            <Box sx={{ p: 1.5, bgcolor: "background.neutral", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Масштаб (авто)
              </Typography>
              <Typography variant="h6">{scaleText}</Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Цаас: A0{" "}
                {meta?.orientation
                  ? meta.orientation === "landscape"
                    ? "(хэвтээ)"
                    : "(босоо)"
                  : ""}{" "}
                · Тооллого: {meta?.name_count ?? "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Тор: {meta?.gridMinutes ? `${meta.gridMinutes} мин` : "—"}
              </Typography>
            </Box>

            {!!meta?.status_legend?.length && (
              <Box sx={{ p: 1.5, bgcolor: "background.neutral", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Таних тэмдэг (тооллого)
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                  {meta.status_legend.map((s) => (
                    <Stack
                      key={s.name}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box
                        sx={{
                          width: 20,
                          height: 3,
                          borderRadius: 1,
                          bgcolor: s.color,
                        }}
                      />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {s.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={s.count}
                        sx={{ bgcolor: s.color, color: "#fff", height: 20 }}
                      />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {meta?.title && (
              <Typography variant="caption" color="text.secondary">
                {meta.title}
              </Typography>
            )}

            <LoadingButton
              variant="contained"
              loading={printing}
              disabled={!unitIds.length || previewLoading}
              startIcon={<Iconify icon="solar:printer-bold" />}
              onClick={handlePrint}
            >
              {unitIds.length > 1
                ? `Ажлын зураг үүсгэх (${unitIds.length} хуудас PDF)`
                : "Ажлын зураг үүсгэх (PDF)"}
            </LoadingButton>
            <Button color="inherit" onClick={handleClose}>
              Хаах
            </Button>
          </Stack>

          <Box
            sx={{
              position: "relative",
              flex: 1,
              minHeight: 560,
              bgcolor: "#cfd4da",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 1.5,
            }}
          >
            {previewImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImg}
                alt="preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: 540,
                  boxShadow: "0 0 10px rgba(0,0,0,0.35)",
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {unitsLoading
                  ? ""
                  : unitIds.length
                    ? ""
                    : "Байршилтай дахин тооллого алга"}
              </Typography>
            )}
            {(previewLoading || unitsLoading) && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(255,255,255,0.55)",
                }}
              >
                <CircularProgress size={28} />
                <Typography variant="caption" color="text.secondary">
                  Ажлын зураг бэлтгэж байна...
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

WorkMapDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
