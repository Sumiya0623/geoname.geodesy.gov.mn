import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Card,
  Stack,
  Button,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useBoolean } from "src/hooks/use-boolean";
import { useSnackbar } from "src/components/snackbar";
import { useGetWorkspaceStores } from "src/api/workspace";

import WorkspaceStoreRow from "./workspace-store-row";

// ----------------------------------------------------------------------
// Сонгосон workspace‑ийн Store‑ууд (geoname DB рүү холбогдсон PostGIS) ба
// тус бүрийн PG view‑д суурилсан layer‑уудыг удирдана.
// ----------------------------------------------------------------------

export default function WorkspaceStores({ workspaceId, canUpdate }) {
  const { enqueueSnackbar } = useSnackbar();
  const { stores, storesLoading, storesMutation } =
    useGetWorkspaceStores(workspaceId);

  const addStore = useBoolean();
  const [storeName, setStoreName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateStore = async () => {
    setCreating(true);
    try {
      await axiosInstance.post(endpoints.workspace.gsCreateStore(workspaceId), {
        name: storeName,
      });
      enqueueSnackbar(`"${storeName}" store үүслээ`);
      setStoreName("");
      addStore.onFalse();
      await storesMutation();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Store үүсгэхэд алдаа гарлаа",
        { variant: "warning" }
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon icon="mdi:database-cog-outline" width={22} />
          <Typography variant="subtitle1">Store & Layer (geoname view)</Typography>
        </Stack>
        {canUpdate && (
          <Button
            size="small"
            variant="outlined"
            startIcon={
              <Icon icon={addStore.value ? "mdi:minus" : "mingcute:add-line"} />
            }
            onClick={addStore.onToggle}
          >
            {addStore.value ? "Хаах" : "Store нэмэх"}
          </Button>
        )}
      </Stack>

      {addStore.value && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{
            mb: 1.5,
            p: 1.5,
            borderLeft: "4px solid",
            borderColor: "success.light",
            bgcolor: "background.neutral",
            borderRadius: 1,
          }}
        >
          <TextField
            size="small"
            label="Store нэр"
            value={storeName}
            onChange={(e) =>
              setStoreName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
            }
            placeholder="geoname_pg"
            helperText="geoname DB рүү PostGIS холболт"
            sx={{ flexGrow: 1 }}
          />
          <LoadingButton
            variant="contained"
            loading={creating}
            disabled={!storeName}
            onClick={handleCreateStore}
            sx={{ mt: 0.25 }}
          >
            Үүсгэх
          </LoadingButton>
        </Stack>
      )}

      {storesLoading ? (
        <Box sx={{ py: 2, textAlign: "center" }}>
          <CircularProgress size={20} />
        </Box>
      ) : stores.length > 0 ? (
        stores.map((s) => (
          <WorkspaceStoreRow
            key={s.name}
            workspaceId={workspaceId}
            store={s}
            canUpdate={canUpdate}
            onStoreDeleted={storesMutation}
          />
        ))
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          Store алга. &quot;Store нэмэх&quot; дарж geoname DB‑тэй холбоно уу.
        </Typography>
      )}
    </Card>
  );
}

WorkspaceStores.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  canUpdate: PropTypes.bool,
};
