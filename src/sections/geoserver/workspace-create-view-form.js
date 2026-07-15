import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Radio,
  Stack,
  Alert,
  Button,
  Dialog,
  RadioGroup,
  TextField,
  Typography,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Нэг талбар сонгож, түүний утга БҮРД тусдаа шүүсэн (filter) view үүсгэх форм.
// Жишээ: adminunit дээр level_id сонговол утга тус бүрээр (аймаг 22 мөр, сум 339
// мөр, улс 1 мөр...) тусдаа давхарга үүснэ.
// ----------------------------------------------------------------------

export default function WorkspaceCreateViewForm({
  open,
  workspaceId,
  source,
  store,
  onClose,
  onCreated,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState([]);
  const [geomField, setGeomField] = useState("geom");
  const [field, setField] = useState("");
  const [prefix, setPrefix] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !workspaceId || !source) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    setField("");
    setPrefix(source);
    (async () => {
      try {
        const res = await axiosInstance.get(
          endpoints.workspace.gsLayerFields(workspaceId, source)
        );
        if (!active) return;
        setFields(res?.data?.results || []);
        setGeomField(res?.data?.geom_field || "geom");
      } catch (e) {
        if (active) setError(e?.response?.data?.detail || e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, workspaceId, source]);

  const handleSubmit = useCallback(async () => {
    if (!field) {
      setError("Ангилах талбар сонгоно уу");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axiosInstance.post(
        endpoints.workspace.gsCreateGroupedView(workspaceId),
        { source, store, field, geom_field: geomField, prefix: prefix.trim() }
      );
      const n = res?.data?.count || 0;
      const errs = res?.data?.errors || [];
      enqueueSnackbar(
        `${n} view үүслээ${errs.length ? ` (${errs.length} алдаа)` : ""}`,
        { variant: errs.length ? "warning" : "success" }
      );
      onCreated && onCreated(res?.data);
      onClose && onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  }, [
    field,
    workspaceId,
    source,
    store,
    geomField,
    prefix,
    enqueueSnackbar,
    onCreated,
    onClose,
  ]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        View үүсгэх
        <Typography variant="body2" color="text.secondary">
          Эх давхарга: <b>{source}</b> · сонгосон талбарын утга бүрд тусдаа view
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{String(error)}</Alert>}

            <TextField
              fullWidth
              size="small"
              label="View нэрийн угтвар"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              helperText={
                field
                  ? `Жишээ нэр: ${prefix || source}_<${field}-ийн утга>`
                  : "Зөвхөн латин үсэг, тоо, доогуур зураас (_)"
              }
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Ангилах талбар (нэгийг сонгоно)
              </Typography>
              <RadioGroup value={field} onChange={(e) => setField(e.target.value)}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 0.5,
                  }}
                >
                  {fields.map((f) => (
                    <FormControlLabel
                      key={f.name}
                      value={f.name}
                      control={<Radio size="small" />}
                      label={
                        <span>
                          {f.name}{" "}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            {f.binding}
                          </Typography>
                        </span>
                      }
                    />
                  ))}
                </Box>
              </RadioGroup>
              {!fields.length && (
                <Typography variant="body2" color="text.secondary">
                  Талбар олдсонгүй.
                </Typography>
              )}
            </Box>

            <Alert severity="info" icon={<Iconify icon="solar:info-circle-bold" />}>
              Талбарын ялгаатай утга бүрд <b>{prefix || source}_&lt;утга&gt;</b>{" "}
              нэртэй шүүсэн view үүсч GeoServer‑т нийтлэгдэнэ.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Болих
        </Button>
        <LoadingButton
          variant="contained"
          loading={submitting}
          disabled={loading || !field || !prefix.trim()}
          onClick={handleSubmit}
        >
          View үүсгэх
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

WorkspaceCreateViewForm.propTypes = {
  open: PropTypes.bool,
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  source: PropTypes.string,
  store: PropTypes.string,
  onClose: PropTypes.func,
  onCreated: PropTypes.func,
};
