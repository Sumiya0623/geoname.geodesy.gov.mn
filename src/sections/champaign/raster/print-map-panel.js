"use client";

import PropTypes from "prop-types";
import { useRef, useState, useEffect, useCallback } from "react";

import {
  Box,
  Stack,
  Switch,
  Dialog,
  TextField,
  Typography,
  DialogTitle,
  Autocomplete,
  DialogContent,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";
import { fetchAdjacentUnits } from "src/api/raster";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

export default function RasterPrintPanel({ open, onClose, onDone }) {
  const { enqueueSnackbar } = useSnackbar();
  const debounceRef = useRef(null);

  const [aimags, setAimags] = useState([]);
  const [sums, setSums] = useState([]);
  const [aimagOpts, setAimagOpts] = useState([]);
  const [sumOpts, setSumOpts] = useState([]);
  const [isBorder, setIsBorder] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [previewImg, setPreviewImg] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  const selUnits = sums.length ? sums : aimags;
  const unitIds = selUnits.map((u) => u.id);
  const unitKey = unitIds.join(",");

  useEffect(() => {
    if (!open) return;
    fetchAdjacentUnits({
      level: "aimag",
      selected: aimags.map((a) => a.id),
    }).then(setAimagOpts);
  }, [open, aimags]);

  useEffect(() => {
    if (!open || !aimags.length) {
      setSumOpts([]);
      return;
    }
    fetchAdjacentUnits({
      level: "sum",
      parent: aimags.map((a) => a.id),
      selected: sums.map((s) => s.id),
    }).then(setSumOpts);
  }, [open, aimags, sums]);

  // Сервер-preview (хэвлэлийн эх композиц) — debounce
  useEffect(() => {
    if (!open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!unitKey) {
      setPreviewImg(null);
      setMeta(null);
      return undefined;
    }
    setPreviewLoading(true);
    debounceRef.current = setTimeout(() => {
      // cache-bust (_t) — browser ижил URL-ийг кэшлэхээс сэргийлнэ
      const t = new Date().getTime();
      axiosInstance
        .get(
          endpoints.raster.preview(
            `units=${unitKey}&is_border=${isBorder ? "1" : "0"}&_t=${t}`,
          ),
        )
        .then((res) => {
          setPreviewImg(res.data?.image || null);
          setMeta(res.data || null);
        })
        .catch(() => {
          setPreviewImg(null);
          setMeta(null);
        })
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitKey, isBorder]);

  const reset = useCallback(() => {
    setAimags([]);
    setSums([]);
    setSumOpts([]);
    setIsBorder(false);
    setPreviewImg(null);
    setMeta(null);
  }, []);

  const handlePrint = async () => {
    if (!unitIds.length) {
      enqueueSnackbar("Аймаг эсвэл сум сонгоно уу", { variant: "warning" });
      return;
    }
    setPrinting(true);
    try {
      const res = await axiosInstance.post(endpoints.raster.print, {
        units: unitIds,
        is_border: isBorder,
        dpi: 250,
      });
      enqueueSnackbar("Хэвлэлийн эх үүслээ");
      if (res?.data?.file_url) window.open(res.data.file_url, "_blank");
      onDone?.();
      reset();
      onClose?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Хэвлэхэд алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setPrinting(false);
    }
  };

  const scaleText = meta?.scale
    ? `1 : ${Number(meta.scale).toLocaleString()}`
    : "—";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Iconify icon="solar:printer-bold" />
        Газар зүйн нэрийн зураг хэвлэх
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ minHeight: 560 }}>
          <Stack
            spacing={2.5}
            sx={{ p: 2.5, width: { md: 320 }, flexShrink: 0 }}
          >
            <Autocomplete
              multiple
              options={aimagOpts}
              value={aimags}
              onChange={(_e, v) => {
                setAimags(v);
                setSums((prev) =>
                  prev.filter((s) => v.some((a) => a.id === s.parent_id)),
                );
              }}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => <TextField {...p} label="Аймаг / Нийслэл" />}
            />
            <Autocomplete
              multiple
              disabled={!aimags.length}
              options={sumOpts}
              value={sums}
              onChange={(_e, v) => setSums(v)}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(p) => (
                <TextField
                  {...p}
                  label="Сум / Дүүрэг"
                  placeholder={
                    aimags.length ? "Хил залгаагаар..." : "Эхлээд аймаг"
                  }
                />
              )}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isBorder}
                  onChange={(e) => setIsBorder(e.target.checked)}
                />
              }
              label="Хилийн цэс (зөвхөн хилийн нэрс)"
            />
            <Box
              sx={{ p: 1.5, bgcolor: "background.neutral", borderRadius: 1 }}
            >
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
                · Нэр: {meta?.name_count ?? "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Тор: {meta?.gridMinutes ? `${meta.gridMinutes} мин` : "—"}
              </Typography>
            </Box>
            <LoadingButton
              variant="contained"
              loading={printing}
              disabled={!unitIds.length || previewLoading}
              startIcon={<Iconify icon="solar:printer-bold" />}
              onClick={handlePrint}
            >
              Хэвлэх (PDF)
            </LoadingButton>
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
                {unitIds.length ? "" : "Аймаг/сум сонгоно уу"}
              </Typography>
            )}
            {previewLoading && (
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
                  Хэвлэлийн эх бэлтгэж байна...
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

RasterPrintPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};
