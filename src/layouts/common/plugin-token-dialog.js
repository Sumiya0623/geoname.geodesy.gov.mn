import PropTypes from "prop-types";
import { useState, useEffect, useCallback } from "react";

import {
  Box,
  Alert,
  Button,
  Dialog,
  TextField,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// QGIS plugin‑д зориулсан хандалтын token — 12 цаг хүчинтэй. Хэрэглэгч энэ
// цонхноос token‑оо хуулж аваад QGIS plugin дээр paste хийнэ.
// ----------------------------------------------------------------------

export default function PluginTokenDialog({ open, onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(endpoints.user.pluginToken);
      setToken(res?.data?.token || "");
    } catch (e) {
      enqueueSnackbar("Token авахад алдаа гарлаа", { variant: "error" });
      setToken("");
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (open) fetchToken();
    else setToken("");
  }, [open, fetchToken]);

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      enqueueSnackbar("Token хуулагдлаа", { variant: "success" });
    } catch (e) {
      // navigator.clipboard байхгүй үед — сонгоод хуулна
      enqueueSnackbar("Хуулж чадсангүй — гараар сонгож хуулна уу", {
        variant: "warning",
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>QGIS Plugin Token</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Доорх token‑оо хуулж QGIS plugin (Геонэр бүртгэл) дээр paste хийнэ үү.
          Token нь <b>12 цаг</b> хүчинтэй. Хугацаа дуусвал энэ цонхыг дахин нээж
          шинэ token авна уу.
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={26} />
          </Box>
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={token}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" },
              endAdornment: (
                <InputAdornment position="end" sx={{ alignSelf: "flex-start" }}>
                  <IconButton onClick={handleCopy} edge="end" disabled={!token}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}

        <Alert severity="warning" sx={{ mt: 2 }}>
          Token нь таны нэрийн өмнөөс хандах эрх олгоно — бусадтай бүү хуваалцаарай.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchToken}
          disabled={loading}
        >
          Шинэчлэх
        </Button>
        <Button
          variant="contained"
          startIcon={<CopyIcon />}
          onClick={handleCopy}
          disabled={!token}
        >
          Хуулах
        </Button>
        <Button onClick={onClose}>Хаах</Button>
      </DialogActions>
    </Dialog>
  );
}

PluginTokenDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};
