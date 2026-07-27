import PropTypes from "prop-types";
import { useRef, useState, useEffect } from "react";

import {
  Stack,
  Dialog,
  Button,
  Checkbox,
  TextField,
  Typography,
  DialogTitle,
  Autocomplete,
  DialogContent,
  DialogActions,
  FormControlLabel,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

import { statusColorByName } from "./recountStatus";

// ----------------------------------------------------------------------
// Тооллогын мөрийг ЗАСАХ — төлөв (олон), нэрийн ангилал (3 түвшин), тайлбар.
// Төлөв/тайлбар → ReCount (PATCH), ангилал → тухайн GeoName‑ийн type (PATCH).
// ----------------------------------------------------------------------

// Ангиллын dropdown (GEONAME_TYPES) — parent байвал дэд, эс бол үндсэн
function useTypes(parentId, enabled) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    const p = new URLSearchParams();
    if (parentId) p.set("parent", parentId);
    else p.set("key", "GEONAME_TYPES");
    axiosInstance
      .get(endpoints.nameclass.list(p.toString()))
      .then((res) => setItems(res?.data?.results || []))
      .catch(() => setItems([]));
  }, [parentId, enabled]);
  return items;
}

export default function RecountEditDialog({ open, row, onClose, onSaved }) {
  const { constants: statuses } = useGetConstantsFordropdown("RECOUNT_STATUS");
  const [checked, setChecked] = useState(() => new Set());
  const [draft, setDraft] = useState("");
  const [t1, setT1] = useState(null);
  const [t2, setT2] = useState(null);
  const [t3, setT3] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Засах үед дүүргэх зорилтот ангиллын ID-ууд (view: type_l1=Үндсэн, type_l2=Дэд,
  // type_id=Төрөл). Options ачаалагдахад тааруулж set хийнэ; хэрэглэгч гар аргаар
  // сонговол цэвэрлэнэ.
  const targetRef = useRef({ l1: null, l2: null, l3: null });

  const ty1 = useTypes(null, open);
  const ty2 = useTypes(t1?.id, open && !!t1?.id);
  const ty3 = useTypes(t2?.id, open && !!t2?.id);

  // Мөрийн утгуудаар формыг дүүргэнэ
  useEffect(() => {
    if (!open || !row) return;
    const ids = String(row.props?.status_ids || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    setChecked(new Set(ids));
    setDraft(row.props?.draft || "");
    const num = (v) => (v != null && v !== "" ? Number(v) : null);
    targetRef.current = {
      l1: num(row.props?.type_l1),
      l2: num(row.props?.type_l2),
      l3: num(row.props?.type_id),
    };
    setT1(null);
    setT2(null);
    setT3(null);
    setErr("");
  }, [open, row]);

  // Options ачаалагдахад зорилтот ангиллыг тааруулж дүүргэнэ (Үндсэн→Дэд→Төрөл)
  useEffect(() => {
    const tl = targetRef.current.l1;
    if (tl && !t1 && ty1.length) {
      const m = ty1.find((o) => o.id === tl);
      if (m) setT1(m);
    }
  }, [ty1, t1]);
  useEffect(() => {
    const tl = targetRef.current.l2;
    if (tl && !t2 && ty2.length) {
      const m = ty2.find((o) => o.id === tl);
      if (m) setT2(m);
    }
  }, [ty2, t2]);
  useEffect(() => {
    const tl = targetRef.current.l3;
    if (tl && !t3 && ty3.length) {
      const m = ty3.find((o) => o.id === tl);
      if (m) {
        setT3(m);
        targetRef.current = { l1: null, l2: null, l3: null };
      }
    }
  }, [ty3, t3]);

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    setErr("");
    try {
      const rcId = row.props?.id;
      await axiosInstance.patch(endpoints.recount.edit(rcId), {
        status_ids: [...checked],
        draft,
      });
      // Ангилал сонгосон бол тухайн GeoName‑ийн төрлийг шинэчилнэ
      const newType = t3 || t2 || t1;
      if (newType?.id && row.props?.name_id) {
        await axiosInstance.patch(endpoints.geoname.edit(row.props.name_id), {
          type_id: newType.id,
        });
      }
      window.dispatchEvent(new Event("recount:changed"));
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Хадгалахад алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Тооллого засах — {row?.props?.name || row?.props?.draft || ""}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Төлөв</Typography>
            <Stack direction="row" flexWrap="wrap">
              {statuses.map((s) => (
                <FormControlLabel
                  key={s.id}
                  sx={{ minWidth: 160 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={checked.has(s.id)}
                      onChange={() => toggle(s.id)}
                      sx={{
                        color: statusColorByName(s.name),
                        "&.Mui-checked": { color: statusColorByName(s.name) },
                      }}
                    />
                  }
                  label={s.name}
                />
              ))}
            </Stack>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="subtitle2">
              Нэрийн ангилал {row?.props?.name_id ? "" : "(GeoName‑гүй мөр)"}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Autocomplete
                fullWidth
                size="small"
                options={ty1}
                value={t1}
                disabled={!row?.props?.name_id}
                onChange={(e, v) => {
                  targetRef.current = { l1: null, l2: null, l3: null };
                  setT1(v);
                  setT2(null);
                  setT3(null);
                }}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(p) => <TextField {...p} label="Үндсэн" />}
              />
              <Autocomplete
                fullWidth
                size="small"
                options={ty2}
                value={t2}
                disabled={!t1?.id}
                onChange={(e, v) => {
                  setT2(v);
                  setT3(null);
                }}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(p) => <TextField {...p} label="Дэд" />}
              />
              <Autocomplete
                fullWidth
                size="small"
                options={ty3}
                value={t3}
                disabled={!t2?.id}
                onChange={(e, v) => setT3(v)}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(p) => <TextField {...p} label="Төрөл" />}
              />
            </Stack>
          </Stack>

          <TextField
            fullWidth
            multiline
            minRows={2}
            size="small"
            label="Тайлбар / draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          {err && (
            <Typography variant="caption" color="error">
              {err}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Болих
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          Хадгалах
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

RecountEditDialog.propTypes = {
  open: PropTypes.bool,
  row: PropTypes.object,
  onClose: PropTypes.func,
  onSaved: PropTypes.func,
};
