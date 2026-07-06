import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import {
  Box,
  Stack,
  Button,
  Dialog,
  MenuItem,
  TextField,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// Дэлгэрэнгүй хуудасны "нэмэх" диалог — kind‑ээр салаалж нэг л компонент:
//   order   — Эрх зүйн баримт бичиг (LegalOrder)
//   request — Хүсэлт (RequestName)
//   attach  — Баримт материал (Attach, файл)
//   photo   — Зураг (Photo, зураг)
// ----------------------------------------------------------------------

const TITLES = {
  order: "Эрх зүйн баримт бичиг нэмэх",
  request: "Хүсэлт нэмэх",
  attach: "Баримт материал нэмэх",
  photo: "Зураг нэмэх",
};

export default function GeonameAddDialog({ kind, geonameId, onClose, onDone }) {
  const { enqueueSnackbar } = useSnackbar();
  const open = !!kind;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);

  // Constant dropdown‑ууд (зөвхөн тухайн kind‑д шаардлагатайг л татна)
  const { constants: legalTypes } = useGetConstantsFordropdown(
    kind === "order" ? "LEGAL_TYPES" : null,
  );
  const { constants: orderTypes } = useGetConstantsFordropdown(
    kind === "order" ? "ORDER_TYPES" : null,
  );
  const { constants: reqStatus } = useGetConstantsFordropdown(
    kind === "request" ? "REQUEST_STATUS" : null,
  );
  const { constants: reqPurpose } = useGetConstantsFordropdown(
    kind === "request" ? "REQUEST_PURPOSES" : null,
  );
  const { constants: ages } = useGetConstantsFordropdown(
    kind === "request" ? "GEONAME_AGES" : null,
  );

  useEffect(() => {
    if (open) {
      setForm({});
      setFile(null);
    }
  }, [open, kind]);

  const set = (name) => (e) =>
    setForm((p) => ({ ...p, [name]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      let url;

      if (kind === "photo") {
        if (!file) {
          enqueueSnackbar("Зураг сонгоно уу", { variant: "warning" });
          setSaving(false);
          return;
        }
        fd.append("file", file);
        url = endpoints.geoname.addPhoto(geonameId);
      } else if (kind === "attach") {
        if (!file) {
          enqueueSnackbar("Файл сонгоно уу", { variant: "warning" });
          setSaving(false);
          return;
        }
        fd.append("file", file);
        url = endpoints.geoname.addAttach(geonameId);
      } else if (kind === "order") {
        if (!form.name?.trim()) {
          enqueueSnackbar("Баримт бичгийн нэр оруулна уу", { variant: "warning" });
          setSaving(false);
          return;
        }
        ["name", "order_number", "order_date", "org", "type", "signer", "description"].forEach(
          (k) => form[k] && fd.append(k, form[k]),
        );
        if (file) fd.append("document", file);
        url = endpoints.geoname.addOrder(geonameId);
      } else if (kind === "request") {
        if (!form.status) {
          enqueueSnackbar("Төлөв сонгоно уу", { variant: "warning" });
          setSaving(false);
          return;
        }
        ["status", "type", "age", "description", "lat", "lon"].forEach(
          (k) => form[k] && fd.append(k, form[k]),
        );
        (form.purpose || []).forEach((p) => fd.append("purpose", p));
        url = endpoints.geoname.addRequest(geonameId);
      }

      await axiosInstance.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      enqueueSnackbar("Амжилттай нэмэгдлээ");
      onDone?.();
      onClose?.();
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.detail || "Нэмэхэд алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  const fileLabel =
    kind === "photo" ? "Зураг сонгох" : kind === "attach" ? "Файл сонгох" : "Баримт бичиг (файл)";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{TITLES[kind] || "Нэмэх"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {/* ----- Эрх зүйн баримт бичиг ----- */}
          {kind === "order" && (
            <>
              <TextField
                label="Нэр *"
                value={form.name || ""}
                onChange={set("name")}
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Дугаар"
                  value={form.order_number || ""}
                  onChange={set("order_number")}
                  fullWidth
                />
                <TextField
                  label="Гарсан огноо"
                  type="date"
                  value={form.order_date || ""}
                  onChange={set("order_date")}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Байгууллага"
                  value={form.org || ""}
                  onChange={set("org")}
                  fullWidth
                >
                  <MenuItem value="">—</MenuItem>
                  {legalTypes.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Төрөл"
                  value={form.type || ""}
                  onChange={set("type")}
                  fullWidth
                >
                  <MenuItem value="">—</MenuItem>
                  {orderTypes.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="Гарын үсэг зурсан"
                value={form.signer || ""}
                onChange={set("signer")}
                fullWidth
              />
              <TextField
                label="Тайлбар"
                value={form.description || ""}
                onChange={set("description")}
                multiline
                minRows={2}
                fullWidth
              />
            </>
          )}

          {/* ----- Хүсэлт ----- */}
          {kind === "request" && (
            <>
              <TextField
                select
                label="Төлөв *"
                value={form.status || ""}
                onChange={set("status")}
                fullWidth
              >
                <MenuItem value="">—</MenuItem>
                {reqStatus.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  label="Нас"
                  value={form.age || ""}
                  onChange={set("age")}
                  fullWidth
                >
                  <MenuItem value="">—</MenuItem>
                  {ages.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Зорилго"
                  value={form.purpose || []}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, purpose: e.target.value }))
                  }
                  SelectProps={{
                    multiple: true,
                    renderValue: (sel) =>
                      reqPurpose
                        .filter((c) => sel.includes(c.id))
                        .map((c) => c.name)
                        .join(", "),
                  }}
                  fullWidth
                >
                  {reqPurpose.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="Тайлбар"
                value={form.description || ""}
                onChange={set("description")}
                multiline
                minRows={2}
                fullWidth
              />
            </>
          )}

          {/* ----- Файл/Зураг (attach, photo, мөн order‑ийн баримт) ----- */}
          {(kind === "photo" || kind === "attach" || kind === "order") && (
            <Box>
              <Button
                component="label"
                variant="outlined"
                startIcon={<Iconify icon="solar:upload-bold" />}
              >
                {fileLabel}
                <input
                  hidden
                  type="file"
                  accept={kind === "photo" ? "image/*" : undefined}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </Button>
              {file && (
                <Typography variant="caption" sx={{ ml: 1.5 }} color="text.secondary">
                  {file.name}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Болих
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSubmit}>
          Хадгалах
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

GeonameAddDialog.propTypes = {
  kind: PropTypes.oneOf(["order", "request", "attach", "photo"]),
  geonameId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClose: PropTypes.func,
  onDone: PropTypes.func,
};
