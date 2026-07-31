import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";

import {
  Stack,
  Alert,
  Dialog,
  Button,
  Divider,
  Checkbox,
  MenuItem,
  TextField,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  FormControlLabel,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Field Calculator — олон мөрийн НЭГ ТАЛБАРыг бөөнөөр шинэчилнэ.
// Нөхцөл (WHERE) заавал биш: <талбар> = <хуучин утга> тохирсон мөрүүдэд л
// шинэ утгыг онооно. Хамрах хүрээ: давхаргын бүх мөр эсвэл зөвхөн сонгосон.
// ----------------------------------------------------------------------

// Засах боломжтой талбарууд — аль API руу бичихийг зааж өгнө
const EDITABLE = [
  { key: "draft", label: "draft (тайлбар)", target: "recount" },
  { key: "name", label: "name (нэр)", target: "geoname" },
  { key: "is_border", label: "is_border (хилийн цэс)", target: "geoname" },
  { key: "type_id", label: "type_id (ангилал)", target: "geoname" },
];

export default function FieldCalcDialog({
  open,
  tab,
  selectedIds,
  onClose,
  onApplied,
}) {
  // Зөвхөн ХАРАГДАЖ буй багана (нуусан техникийн түлхүүрүүд орохгүй)
  const cols = useMemo(
    () => (tab?.cols || []).filter((c) => !tab?.hiddenCols?.has(c)),
    [tab],
  );
  const rows = useMemo(() => tab?.rows || [], [tab]);
  const [allFeatures, setAllFeatures] = useState(true);
  const [whereField, setWhereField] = useState("");
  const [whereValue, setWhereValue] = useState("");
  const [setField, setSetField] = useState("");
  const [setValue, setSetValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setAllFeatures(true);
    setWhereField("");
    setWhereValue("");
    setSetField("");
    setSetValue("");
    setErr("");
    setDone(0);
  }, [open]);

  // Хамрах мөрүүд — хүрээ + нөхцөл
  const targetRows = useMemo(() => {
    let out = rows;
    if (!allFeatures && selectedIds?.size) {
      out = out.filter((r) => selectedIds.has(r.id));
    }
    if (whereField && whereValue !== "") {
      out = out.filter(
        (r) => String(r.props?.[whereField] ?? "").trim() === whereValue.trim(),
      );
    }
    return out;
  }, [rows, allFeatures, selectedIds, whereField, whereValue]);

  const def = EDITABLE.find((f) => f.key === setField);
  const canSave = !!def && setValue !== "" && targetRows.length > 0 && !busy;

  const handleSave = async () => {
    if (!def) return;
    setBusy(true);
    setErr("");
    setDone(0);
    let ok = 0;
    try {
      for (let i = 0; i < targetRows.length; i += 1) {
        const r = targetRows[i];
        try {
          if (def.target === "recount") {
            // eslint-disable-next-line no-await-in-loop
            await axiosInstance.patch(endpoints.recount.edit(r.props.id), {
              [def.key]: setValue,
            });
          } else if (r.props.name_id) {
            const val =
              def.key === "is_border"
                ? ["true", "1", "тийм"].includes(setValue.toLowerCase())
                : def.key === "type_id"
                  ? Number(setValue)
                  : setValue;
            // eslint-disable-next-line no-await-in-loop
            await axiosInstance.patch(endpoints.geoname.edit(r.props.name_id), {
              [def.key]: val,
            });
          }
          ok += 1;
        } catch (e) {
          /* мөрийг алгасна */
        }
        setDone(i + 1);
      }
      window.dispatchEvent(new Event("recount:changed"));
      onApplied?.(ok);
      onClose?.();
    } catch (e) {
      setErr("Шинэчлэхэд алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Талбар тооцоолуур</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={allFeatures}
                onChange={(e) => setAllFeatures(e.target.checked)}
              />
            }
            label={`Давхаргын бүх feature (${rows.length})`}
          />
          {!allFeatures && (
            <Typography variant="caption" color="text.secondary">
              Зөвхөн сонгосон {selectedIds?.size || 0} мөрд үйлчилнэ.
            </Typography>
          )}

          <Typography variant="subtitle2">
            Нөхцөл (WHERE) — заавал биш
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              fullWidth
              size="small"
              label="Шүүх талбар"
              value={whereField}
              onChange={(e) => setWhereField(e.target.value)}
            >
              <MenuItem value="">
                <em>Байхгүй</em>
              </MenuItem>
              {cols.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              label="Хуучин утга"
              value={whereValue}
              disabled={!whereField}
              onChange={(e) => setWhereValue(e.target.value)}
            />
          </Stack>

          <Divider />

          <Typography variant="subtitle2">Шинэ утга оноох</Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Талбар сонгох"
            value={setField}
            onChange={(e) => setSetField(e.target.value)}
          >
            {EDITABLE.map((f) => (
              <MenuItem key={f.key} value={f.key}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            size="small"
            placeholder="Шинэ утга"
            value={setValue}
            onChange={(e) => setSetValue(e.target.value)}
            helperText={
              setField === "is_border"
                ? "true / false"
                : setField === "type_id"
                  ? "Ангиллын дугаар (id)"
                  : " "
            }
          />

          <Alert severity={targetRows.length ? "info" : "warning"}>
            {targetRows.length} мөрд шинэчлэлт хийгдэнэ.
          </Alert>

          {busy && (
            <Stack spacing={0.5}>
              <LinearProgress
                variant="determinate"
                value={(done / Math.max(1, targetRows.length)) * 100}
              />
              <Typography variant="caption" color="text.secondary">
                {done} / {targetRows.length}
              </Typography>
            </Stack>
          )}
          {err && (
            <Typography variant="caption" color="error">
              {err}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={busy}>
          Цуцлах
        </Button>
        <LoadingButton
          variant="contained"
          color="primary"
          loading={busy}
          disabled={!canSave}
          onClick={handleSave}
        >
          Хадгалах
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

FieldCalcDialog.propTypes = {
  open: PropTypes.bool,
  tab: PropTypes.object,
  selectedIds: PropTypes.instanceOf(Set),
  onClose: PropTypes.func,
  onApplied: PropTypes.func,
};
