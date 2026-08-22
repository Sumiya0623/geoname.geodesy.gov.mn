import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Card,
  Stack,
  Switch,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  FormControlLabel,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------

const LAYER_TYPES = [
  { value: "base", label: "Суурь (base)" },
  { value: "overlay", label: "Нэмэлт (overlay)" },
];
const SOURCE_TYPES = [
  { value: "blank", label: "Хоосон (blank)" },
  { value: "xyz", label: "XYZ (гадаад тайл)" },
  { value: "osm", label: "OpenStreetMap" },
  { value: "wms", label: "WMS (GeoServer/GWC)" },
  { value: "wmts", label: "WMTS (GeoServer/GWC кэш)" },
];

const toForm = (row) => ({
  key: row?.key || "",
  label: row?.label || "",
  layer_type: row?.layer_type || "base",
  source_type: row?.source_type || "wms",
  workspace: row?.workspace || "",
  gs_layer: row?.gs_layer || "",
  url: row?.url || "",
  params: row?.params ? JSON.stringify(row.params) : "",
  color: row?.color || "",
  is_enabled: row?.is_enabled ?? true,
  sort_order: row?.sort_order ?? "",
  role_ids: (row?.roles || []).map((x) => x.id),
});

// ----------------------------------------------------------------------

export default function BaseMapNewEditForm({
  currentItem,
  onCloseForm,
  refetch,
  roles = [],
  available = [],
  layers = [],
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(() => toForm(currentItem));
  const [saving, setSaving] = useState(false);

  const setF = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const isGs = form.source_type === "wms" || form.source_type === "wmts";
  const isEdit = !!currentItem?.id;

  const handleSubmit = async () => {
    if (!form.key.trim() || !form.label.trim()) {
      enqueueSnackbar("Түлхүүр ба нэрийг бөглөнө", { variant: "warning" });
      return;
    }
    // Эрэмбэ = газрын зурагт давхарлах дараалал (1 нь хамгийн ДЭЭР). 1‑ээс эхэлнэ,
    // төрөл дотроо давхардахгүй — backend ч мөн шалгана.
    const order = Number(form.sort_order);
    if (!order || order < 1) {
      enqueueSnackbar("Эрэмбэ 1‑ээс эхэлнэ (0 байж болохгүй)", {
        variant: "warning",
      });
      return;
    }
    const taken = (layers || []).find(
      (l) =>
        l.id !== currentItem?.id &&
        l.layer_type === form.layer_type &&
        Number(l.sort_order) === order,
    );
    if (taken) {
      enqueueSnackbar(`«${taken.label}» энэ эрэмбийг эзэлсэн байна`, {
        variant: "warning",
      });
      return;
    }
    let paramsObj = {};
    if (form.params && form.params.trim()) {
      try {
        paramsObj = JSON.parse(form.params);
      } catch (e) {
        enqueueSnackbar("Нэмэлт параметр буруу JSON байна", {
          variant: "error",
        });
        return;
      }
    }
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      layer_type: form.layer_type,
      source_type: form.source_type,
      workspace: form.workspace || "",
      gs_layer: form.gs_layer || "",
      url: form.url || "",
      params: paramsObj,
      color: form.color || "",
      is_enabled: form.is_enabled,
      sort_order: order,
      role_ids: form.role_ids,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await axiosInstance.put(
          endpoints.basemap.edit(currentItem.id),
          payload,
        );
        enqueueSnackbar("Хадгалагдлаа");
      } else {
        await axiosInstance.post(endpoints.basemap.create, payload);
        enqueueSnackbar("Нэмэгдлээ");
      }
      refetch?.();
      onCloseForm?.();
    } catch (error) {
      const d = error?.response?.data;
      const detail =
        d?.sort_order?.[0] ||
        d?.key?.[0] ||
        d?.detail ||
        "Хадгалахад алдаа гарлаа";
      enqueueSnackbar(detail, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ p: 2.5, boxShadow: (t) => t.customShadows?.z8 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="Түлхүүр (key)"
            value={form.key}
            onChange={(e) => setF("key", e.target.value)}
            disabled={isEdit}
            helperText={isEdit ? "Түлхүүр өөрчлөгдөхгүй" : "Давхтардахгүй"}
          />
          <TextField
            fullWidth
            label="Харагдах нэр"
            value={form.label}
            onChange={(e) => setF("label", e.target.value)}
          />
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            select
            fullWidth
            label="Төрөл"
            value={form.layer_type}
            onChange={(e) => setF("layer_type", e.target.value)}
          >
            {LAYER_TYPES.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Эх сурвалж"
            value={form.source_type}
            onChange={(e) => setF("source_type", e.target.value)}
          >
            {SOURCE_TYPES.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        {isGs ? (
          <Autocomplete
            freeSolo
            options={available.map((a) => a.gs_layer)}
            value={form.gs_layer}
            onInputChange={(_e, v) => {
              setF("gs_layer", v || "");
              const found = available.find((a) => a.gs_layer === v);
              if (found) setF("workspace", found.workspace);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="GeoServer давхарга (raster:m100k г.м.)"
              />
            )}
          />
        ) : (
          <TextField
            fullWidth
            label="URL (XYZ загвар: {z}/{x}/{y})"
            value={form.url}
            onChange={(e) => setF("url", e.target.value)}
          />
        )}

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems="center"
        >
          <TextField
            sx={{ width: { xs: "100%", md: 120 } }}
            label="Эрэмбэ"
            type="number"
            required
            helperText="1 нь хамгийн дээр"
            value={form.sort_order}
            onChange={(e) => setF("sort_order", e.target.value)}
          />
          <TextField
            sx={{ width: { xs: "100%", md: 160 } }}
            label="Өнгө (overlay)"
            value={form.color}
            onChange={(e) => setF("color", e.target.value)}
            placeholder="#1d4ed8"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_enabled}
                onChange={(e) => setF("is_enabled", e.target.checked)}
              />
            }
            label="Идэвхтэй"
          />
        </Stack>

        <TextField
          fullWidth
          label="Нэмэлт параметр (JSON)"
          value={form.params}
          onChange={(e) => setF("params", e.target.value)}
          placeholder='{"cached": true, "maxZoom": 12}'
          multiline
          minRows={2}
        />

        <Autocomplete
          multiple
          options={roles}
          getOptionLabel={(o) => o?.name || ""}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          value={roles.filter((r) => form.role_ids.includes(r.id))}
          onChange={(_e, v) =>
            setF(
              "role_ids",
              v.map((x) => x.id),
            )
          }
          renderInput={(params) => (
            <TextField {...params} label="Харах эрх (role) — хоосон бол бүгд" />
          )}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <LoadingButton color="inherit" onClick={onCloseForm}>
            Болих
          </LoadingButton>
          <LoadingButton
            variant="contained"
            color="primary"
            loading={saving}
            onClick={handleSubmit}
          >
            Хадгалах
          </LoadingButton>
        </Box>
      </Stack>

      {!currentItem && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 1, display: "block" }}
        >
          Суурь давхарга — нэг нэгээр (radio), нэмэлт — давхарлана (checkbox).
        </Typography>
      )}
    </Card>
  );
}

BaseMapNewEditForm.propTypes = {
  currentItem: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  roles: PropTypes.array,
  available: PropTypes.array,
  layers: PropTypes.array,
};
