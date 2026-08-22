import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Divider,
  Collapse,
  MenuItem,
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
import CustomPopover, { usePopover } from "src/components/custom-popover";

import WorkspaceLayerForm from "./workspace-layer-form";

// ----------------------------------------------------------------------
// Store мөр — задарч доторх layer (PG view)‑уудаа жагсаана. Layer нэмэх,
// засах, устгах. Store‑оо устгах. Бүх үйлдэл босоо 3 цэгт цэсэнд.
// ----------------------------------------------------------------------

// Нэг layer мөрийн үйлдлийн (SQL засах / устгах) 3 цэгт цэс
function LayerActions({ canEditSql, onEditSql, onDelete }) {
  const popover = usePopover();
  return (
    <>
      <IconButton onClick={popover.onOpen}>
        <Icon icon="mdi:dots-vertical" />
      </IconButton>
      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 180 }}
      >
        {canEditSql && (
          <MenuItem
            onClick={() => {
              onEditSql();
              popover.onClose();
            }}
          >
            <Icon icon="solar:pen-bold" />
            SQL засах
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            onDelete();
            popover.onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <Icon icon="solar:trash-bin-trash-bold" />
          Layer устгах
        </MenuItem>
      </CustomPopover>
    </>
  );
}
LayerActions.propTypes = {
  canEditSql: PropTypes.bool,
  onEditSql: PropTypes.func,
  onDelete: PropTypes.func,
};

export default function WorkspaceStoreRow({
  workspaceId,
  store,
  canUpdate,
  onStoreDeleted,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const open = useBoolean();
  const confirmStore = useBoolean();
  const storePopover = usePopover();
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
        <IconButton onClick={open.onToggle}>
          <Icon icon={open.value ? "mdi:chevron-down" : "mdi:chevron-right"} />
        </IconButton>
        <Icon icon="mdi:database" width={20} />
        <Typography variant="subtitle2" sx={{ ml: 1, flexGrow: 1 }}>
          {store.name}
        </Typography>

        {canUpdate && (
          <>
            <IconButton onClick={storePopover.onOpen}>
              <Icon icon="mdi:dots-vertical" />
            </IconButton>
            <CustomPopover
              open={storePopover.open}
              onClose={storePopover.onClose}
              arrow="right-top"
              sx={{ width: 180 }}
            >
              <MenuItem
                onClick={() => {
                  setAddOpen((v) => !v);
                  setEditLayer(null);
                  if (!open.value) open.onTrue();
                  storePopover.onClose();
                }}
              >
                <Icon icon="mdi:plus-circle-outline" />
                Layer нэмэх
              </MenuItem>
              <Divider sx={{ borderStyle: "dashed" }} />
              <MenuItem
                onClick={() => {
                  confirmStore.onTrue();
                  storePopover.onClose();
                }}
                sx={{ color: "error.main" }}
              >
                <Icon icon="solar:trash-bin-trash-bold" />
                Store устгах
              </MenuItem>
            </CustomPopover>
          </>
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
                    <Chip variant="soft" color="info" label="view" />
                  ) : (
                    <Chip variant="outlined" label="table" />
                  )}
                  {canUpdate && (
                    <LayerActions
                      canEditSql={ly.is_view}
                      onEditSql={() =>
                        setEditLayer((p) => (p === ly.name ? null : ly.name))
                      }
                      onDelete={() => setDelLayer(ly)}
                    />
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
