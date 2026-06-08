import PropTypes from "prop-types";
import { useState } from "react";

import { Box, Stack, Button, TextField } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// Layer = PG view. Нэр + SQL (SELECT ...) бичиж view үүсгээд GeoServer дээр
// нийтэлнэ. currentLayer өгвөл засах (SQL шинэчлэх).
// ----------------------------------------------------------------------

export default function WorkspaceLayerForm({
  workspaceId,
  store,
  currentLayer = null,
  onCancel,
  onSaved,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const editing = !!currentLayer;

  const [name, setName] = useState(currentLayer?.name || "");
  const [sql, setSql] = useState(
    currentLayer?.sql || "SELECT id, name, geoloc FROM core_geoname"
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const URL = editing
        ? endpoints.workspace.gsUpdateLayer(workspaceId)
        : endpoints.workspace.gsCreateLayer(workspaceId);
      await axiosInstance.post(URL, { store, name, sql, title: name });
      enqueueSnackbar(`Layer амжилттай ${editing ? "шинэчлэгдлээ" : "үүслээ"}`);
      onSaved && onSaved();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Layer хадгалахад алдаа гарлаа",
        { variant: "warning" }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderLeft: "4px solid",
        borderColor: "info.light",
        bgcolor: "background.neutral",
        borderRadius: 1,
      }}
    >
      <Stack spacing={1.5}>
        <TextField
          label="Layer / view нэр"
          size="small"
          value={name}
          disabled={editing}
          onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
          placeholder="v_uul_namuud"
          helperText={editing ? "Нэр өөрчлөх боломжгүй" : "Зөвхөн үсэг, тоо, _"}
        />
        <TextField
          label="SQL (SELECT ...)"
          size="small"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          multiline
          minRows={3}
          InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
          placeholder="SELECT id, name, geoloc FROM core_geoname WHERE type_id = 5"
        />
        <Stack direction="row" spacing={1}>
          <LoadingButton
            size="small"
            variant="contained"
            loading={saving}
            disabled={!name || !sql}
            onClick={handleSubmit}
          >
            {editing ? "Шинэчлэх" : "Нийтлэх"}
          </LoadingButton>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onCancel}
          >
            Буцах
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

WorkspaceLayerForm.propTypes = {
  workspaceId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  store: PropTypes.string,
  currentLayer: PropTypes.object,
  onCancel: PropTypes.func,
  onSaved: PropTypes.func,
};
