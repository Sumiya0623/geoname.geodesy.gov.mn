import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import {
  Box,
  Card,
  Stack,
  Button,
  Dialog,
  MenuItem,
  TextField,
  Typography,
  CardContent,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";
import { angleToDirection } from "src/utils/geoDirection";
import { useGetConstantsFordropdown } from "src/api/constant";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

import RequestChangeForm from "src/sections/dashboard/request/request-change-form";
import PhotoDirectionPicker from "src/components/photo-direction-picker";

// ----------------------------------------------------------------------
// Дэлгэрэнгүй хуудасны "нэмэх" диалог — kind‑ээр салаалж нэг л компонент:
//   order   — Эрх зүйн баримт бичиг (LegalOrder)
//   request — Хүсэлт (RequestName)
//   attach  — Баримт материал (Attach, файл)
//   photo   — Зураг (Photo, зураг)
// ----------------------------------------------------------------------

const TITLES = {
  order: "Эрх зүйн баримт бичиг нэмэх",
  request: "Өөрчлөх хүсэлт",
  attach: "Баримт материал нэмэх",
  photo: "Зураг нэмэх",
};

export default function GeonameAddDialog({
  kind,
  geonameId,
  onClose,
  onDone,
  inline = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const open = !!kind;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [photos, setPhotos] = useState([]); // [{file, deg}] — олон зураг + зовхис
  const [photoIdx, setPhotoIdx] = useState(0);

  // Constant dropdown‑ууд (зөвхөн тухайн kind‑д шаардлагатайг л татна)
  const { constants: legalLevels } = useGetConstantsFordropdown(
    kind === "order" ? "LEGAL_LEVELS" : null,
  );
  const { constants: legalOrgs } = useGetConstantsFordropdown(
    kind === "order" ? "LEGAL_ORGS" : null,
  );
  const { constants: orderTypes } = useGetConstantsFordropdown(
    kind === "order" ? "ORDER_TYPES" : null,
  );
  // Хүсэлт (Өөрчлөх) — бүх бүртгэлийг RequestChangeForm өөрөө хийнэ.
  // Энд зөвхөн эхний "Өөрчлөх" төлвийг олж дамжуулахад л reqStatus хэрэгтэй.
  const { constants: reqStatus } = useGetConstantsFordropdown(
    kind === "request" ? "REQUEST_STATUS" : null,
  );

  useEffect(() => {
    if (open) {
      setForm({});
      setFile(null);
      setPhotos([]);
      setPhotoIdx(0);
    }
  }, [open, kind]);

  const set = (name) => (e) =>
    setForm((p) => ({ ...p, [name]: e.target.value }));

  const handleSubmit = async () => {
    // Зураг — олон файл, тус бүрд зовхис тааруулаад давталтаар POST‑лоно
    if (kind === "photo") {
      if (!photos.length) {
        enqueueSnackbar("Зураг сонгоно уу", { variant: "warning" });
        return;
      }
      setSaving(true);
      try {
        for (let k = 0; k < photos.length; k += 1) {
          const pfd = new FormData();
          pfd.append("file", photos[k].file);
          pfd.append("desc", angleToDirection(photos[k].deg));
          // eslint-disable-next-line no-await-in-loop
          await axiosInstance.post(endpoints.geoname.addPhoto(geonameId), pfd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        enqueueSnackbar("Зургууд нэмэгдлээ");
        onDone?.();
        onClose?.();
      } catch (err) {
        enqueueSnackbar(err?.response?.data?.detail || "Нэмэхэд алдаа гарлаа", {
          variant: "warning",
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      let url;

      if (kind === "attach") {
        if (!file) {
          enqueueSnackbar("Файл сонгоно уу", { variant: "warning" });
          setSaving(false);
          return;
        }
        fd.append("file", file);
        url = endpoints.geoname.addAttach(geonameId);
      } else if (kind === "order") {
        if (!form.name?.trim()) {
          enqueueSnackbar("Баримт бичгийн нэр оруулна уу", {
            variant: "warning",
          });
          setSaving(false);
          return;
        }
        [
          "name",
          "order_number",
          "order_date",
          "govlevel",
          "org",
          "type",
          "signer",
          "description",
        ].forEach((k) => form[k] && fd.append(k, form[k]));
        if (file) fd.append("document", file);
        url = endpoints.geoname.addOrder(geonameId);
      }
      // kind === "request" энд БАЙХГҮЙ — RequestChangeForm өөрөө хадгална.

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
    kind === "photo"
      ? "Зураг сонгох"
      : kind === "attach"
        ? "Файл сонгох"
        : "Баримт бичиг (файл)";

  const body = (
    <Stack spacing={2.5}>
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
              label="Дээд тогтоол"
              value={form.govlevel || ""}
              onChange={set("govlevel")}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {legalLevels.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Байгууллага"
              value={form.org || ""}
              onChange={set("org")}
              fullWidth
            >
              <MenuItem value="">—</MenuItem>
              {legalOrgs.map((c) => (
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

      {/* ----- Хүсэлт — газрын зураг дээрхтэй ИЖИЛ форм (RequestChangeForm) ----- */}
      {kind === "request" && (
        <RequestChangeForm
          geonameId={geonameId}
          selectedStatus={
            reqStatus.find((s) => (s?.name || "").includes("Өөрчл")) || null
          }
          onClose={() => {
            onDone?.();
            onClose?.();
          }}
        />
      )}

      {/* ----- Зураг — олон файл (jpg/png) + зовхис тааруулах компас ----- */}
      {kind === "photo" && (
        <PhotoDirectionPicker value={photos} onChange={setPhotos} />
      )}

      {/* ----- Файл (attach, мөн order‑ийн баримт) ----- */}
      {(kind === "attach" || kind === "order") && (
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
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Button>
          {file && (
            <Typography
              variant="caption"
              sx={{ ml: 1.5 }}
              color="text.secondary"
            >
              {file.name}
            </Typography>
          )}
        </Box>
      )}
    </Stack>
  );

  // Хүсэлт нь RequestChangeForm‑ийн өөрийн товчоор хадгална
  const actions = kind !== "request" && (
    <>
      <Button color="inherit" onClick={onClose}>
        Болих
      </Button>
      <LoadingButton
        variant="contained"
        color="primary"
        loading={saving}
        onClick={handleSubmit}
      >
        Хадгалах
      </LoadingButton>
    </>
  );

  // Inline — detail хуудасны баруун баганад (dialog биш).
  if (inline) {
    if (!open) return null;
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">{TITLES[kind] || "Нэмэх"}</Typography>
          {body}
          {actions && (
            <Stack
              direction="row"
              justifyContent="flex-end"
              spacing={1}
              sx={{ mt: 2 }}
            >
              {actions}
            </Stack>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{TITLES[kind] || "Нэмэх"}</DialogTitle>
      <DialogContent dividers>{body}</DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}

GeonameAddDialog.propTypes = {
  kind: PropTypes.oneOf(["order", "request", "attach", "photo"]),
  geonameId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClose: PropTypes.func,
  onDone: PropTypes.func,
  inline: PropTypes.bool,
};
