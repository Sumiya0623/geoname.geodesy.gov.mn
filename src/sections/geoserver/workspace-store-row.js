import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Collapse,
  Tooltip,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useBoolean } from "src/hooks/use-boolean";
import { useSnackbar } from "src/components/snackbar";
import { useGetStoreLayers } from "src/api/workspace";
import { ConfirmDialog } from "src/components/custom-dialog";

import WorkspaceLayerForm from "./workspace-layer-form";

// ----------------------------------------------------------------------
// Store мөр — задарч доторх layer (PG view)‑уудаа жагсаана. Layer нэмэх,
// засах, устгах. Store‑оо устгах.
// ----------------------------------------------------------------------

export default function WorkspaceStoreRow({
  workspaceId,
  store,
  canUpdate,
  onStoreDeleted,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const open = useBoolean();
  const confirmStore = useBoolean();
  const [addOpen, setAddOpen] = useState(false);
  const [editLayer, setEditLayer] = useState(null);
  const [delLayer, setDelLayer] = useState(null);

  const { layers, layersLoading, layersMutation } = useGetStoreLayers(
    open.value ? workspaceId : null,
    store.name
  );

  const handleDeleteStore = async () => {
    confirmStore.onFalse();
    try {
      await axiosInstance.post(endpoints.workspace.gsDeleteStore(workspaceId), {
        store: store.name,
      });
      enqueueSnackbar("Store устгагдлаа");
      onStoreDeleted && onStoreDeleted();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Store устгахад алдаа гарлаа",
        { variant: "warning" }
      );
    }
  };

  const handleDeleteLayer = async () => {
    const name = delLayer?.name;
    setDelLayer(null);
    try {
      await axiosInstance.post(endpoints.workspace.gsDeleteLayer(workspaceId), {
        store: store.name,
        name,
      });
      enqueueSnackbar("Layer устгагдлаа");
      await layersMutation();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Layer устгахад алдаа гарлаа",
        { variant: "warning" }
      );
    }
  };

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1, py: 0.75, bgcolor: open.value ? "action.hover" : "transparent" }}
      >
        <IconButton size="small" onClick={open.onToggle}>
          <Icon icon={open.value ? "mdi:chevron-down" : "mdi:chevron-right"} />
        </IconButton>
        <Icon icon="mdi:database" width={20} />
        <Typography variant="subtitle2" sx={{ ml: 1, flexGrow: 1 }}>
          {store.name}
        </Typography>

        {canUpdate && (
          <Tooltip title="Layer нэмэх">
            <IconButton
              size="small"
              color={addOpen ? "primary" : "default"}
              onClick={() => {
                setAddOpen((v) => !v);
                setEditLayer(null);
                if (!open.value) open.onTrue();
              }}
            >
              <Icon icon="mdi:plus-circle-outline" />
            </IconButton>
          </Tooltip>
        )}
        {canUpdate && (
          <Tooltip title="Store устгах">
            <IconButton size="small" color="error" onClick={confirmStore.onTrue}>
              <Icon icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Collapse in={open.value} timeout="auto" unmountOnExit>
        <Box sx={{ p: 1.5, pt: 0.5 }}>
          {/* Layer нэмэх форм */}
          {addOpen && (
            <Box sx={{ mb: 1 }}>
              <WorkspaceLayerForm
                workspaceId={workspaceId}
                store={store.name}
                onCancel={() => setAddOpen(false)}
                onSaved={async () => {
                  setAddOpen(false);
                  await layersMutation();
                }}
              />
            </Box>
          )}

          {layersLoading ? (
            <Box sx={{ py: 1, textAlign: "center" }}>
              <CircularProgress size={18} />
            </Box>
          ) : layers.length > 0 ? (
            layers.map((ly) => (
              <Box key={ly.name}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    px: 1,
                    py: 0.75,
                    borderBottom: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Icon icon="mdi:layers-outline" width={18} />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {ly.name}
                  </Typography>
                  {ly.is_view ? (
                    <Chip size="small" variant="soft" color="info" label="view" />
                  ) : (
                    <Chip size="small" variant="outlined" label="table" />
                  )}
                  {canUpdate && ly.is_view && (
                    <Tooltip title="SQL засах">
                      <IconButton
                        size="small"
                        onClick={() =>
                          setEditLayer((p) => (p === ly.name ? null : ly.name))
                        }
                      >
                        <Icon icon="solar:pen-bold" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canUpdate && (
                    <Tooltip title="Layer устгах">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDelLayer(ly)}
                      >
                        <Icon icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>

                {editLayer === ly.name && (
                  <Box sx={{ my: 1 }}>
                    <WorkspaceLayerForm
                      workspaceId={workspaceId}
                      store={store.name}
                      currentLayer={ly}
                      onCancel={() => setEditLayer(null)}
                      onSaved={async () => {
                        setEditLayer(null);
                        await layersMutation();
                      }}
                    />
                  </Box>
                )}
              </Box>
            ))
          ) : (
            !addOpen && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Layer алга. &quot;+&quot; дарж view‑ээс layer үүсгэнэ үү.
              </Typography>
            )
          )}
        </Box>
      </Collapse>

      <ConfirmDialog
        open={confirmStore.value}
        onClose={confirmStore.onFalse}
        title="Store устгах уу?"
        content={`"${store.name}" store болон доторх бүх layer GeoServer‑ээс устана.`}
        action={
          <Button variant="outlined" color="error" onClick={handleDeleteStore}>
            Тийм
          </Button>
        }
      />

      <ConfirmDialog
        open={!!delLayer}
        onClose={() => setDelLayer(null)}
        title="Layer устгах уу?"
        content={`"${delLayer?.name}" layer GeoServer‑ээс хасагдаж, PG view нь устана.`}
        action={
          <Button variant="outlined" color="error" onClick={handleDeleteLayer}>
            Тийм
          </Button>
        }
      />
    </Box>
  );
}

WorkspaceStoreRow.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  store: PropTypes.object,
  canUpdate: PropTypes.bool,
  onStoreDeleted: PropTypes.func,
};
