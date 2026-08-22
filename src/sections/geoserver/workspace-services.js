import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Card,
  Chip,
  Stack,
  Switch,
  Button,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useGetWorkspaceGsStatus } from "src/api/workspace";

// ----------------------------------------------------------------------
// Сонгосон workspace‑ийг GeoServer дээр удирдах: байгаа эсэх (sync), мөн
// WMS / WFS / WMTS үйлчилгээг идэвхжүүлэх/идэвхгүйжүүлэх.
// ----------------------------------------------------------------------

const SERVICES = [
  { key: "wms", label: "WMS", desc: "Web Map Service — зураг (растер) хэлбэрээр" },
  { key: "wfs", label: "WFS", desc: "Web Feature Service — вектор feature" },
  { key: "wmts", label: "WMTS", desc: "Web Map Tile Service — кэшлэсэн tile" },
];

export default function WorkspaceServices({ workspaceId, workspaceName, canUpdate }) {
  const { enqueueSnackbar } = useSnackbar();
  const { gsServices, gsExists, gsLoading, gsMutation } =
    useGetWorkspaceGsStatus(workspaceId);

  const [busy, setBusy] = useState(null); // одоо хадгалж буй үйлчилгээ

  const handleToggle = async (svc, next) => {
    setBusy(svc);
    try {
      await axiosInstance.post(endpoints.workspace.gsService(workspaceId), {
        service: svc,
        enabled: next,
      });
      enqueueSnackbar(
        `${svc.toUpperCase()} ${next ? "идэвхжлээ" : "идэвхгүй боллоо"}`
      );
      await gsMutation();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail ||
          `${svc.toUpperCase()} тохиргоо хадгалахад алдаа гарлаа`,
        { variant: "warning" }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      await axiosInstance.post(endpoints.workspace.gsSync(workspaceId));
      enqueueSnackbar(`"${workspaceName}" workspace GeoServer дээр үүслээ`);
      await gsMutation();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Workspace үүсгэхэд алдаа гарлаа",
        { variant: "warning" }
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "background.neutral" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon icon="mdi:server-network" width={22} />
          <Typography variant="subtitle1">GeoServer удирдлага</Typography>
          {gsLoading ? (
            <CircularProgress size={14} />
          ) : gsExists ? (
            <Chip color="success" variant="soft" label="Холбогдсон" />
          ) : (
            <Chip color="warning" variant="soft" label="GeoServer дээр алга" />
          )}
        </Stack>

        {!gsLoading && !gsExists && canUpdate && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<Icon icon="mdi:cloud-upload-outline" />}
            disabled={busy === "sync"}
            onClick={handleSync}
          >
            GeoServer дээр үүсгэх
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {`Workspace: `}
        <b>{workspaceName}</b>
      </Typography>

      <Stack spacing={1} sx={{ mt: 1.5 }}>
        {SERVICES.map((s) => {
          const state = gsServices?.[s.key] || {};
          const enabled = !!state.enabled;
          const unavailable =
            state.enabled === null || state.scope === "error";
          return (
            <Stack
              key={s.key}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 1.5,
                py: 1,
                borderRadius: 1,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2">{s.label}</Typography>
                  {state.scope === "global" && (
                    <Tooltip title="Глобал тохиргоогоор">
                      <Chip variant="outlined" label="global" />
                    </Tooltip>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {s.desc}
                </Typography>
              </Box>

              <Stack direction="row" alignItems="center" spacing={1}>
                {busy === s.key && <CircularProgress size={16} />}
                <Switch
                  checked={enabled}
                  disabled={
                    !canUpdate || gsLoading || unavailable || busy === s.key
                  }
                  onChange={(e) => handleToggle(s.key, e.target.checked)}
                />
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}

WorkspaceServices.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  workspaceName: PropTypes.string,
  canUpdate: PropTypes.bool,
};
