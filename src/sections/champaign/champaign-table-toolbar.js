import PropTypes from "prop-types";
import Stack from "@mui/material/Stack";
import {
  Badge,
  Button,
  Tooltip,
  IconButton,
  InputAdornment,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import Iconify from "src/components/iconify";
import { useCallback } from "react";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "notistack";

// ----------------------------------------------------------------------

export default function ChampaignTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  onRefetch,
  menuPermissions,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters],
  );

  const handleSyncGeoNameProjects = useCallback(async () => {
    try {
      const res = await axiosInstance.post(endpoints.champaign.sync());
      if (res?.status === 200) {
        enqueueSnackbar("Гэрээт ажлууд амжилттай шинэчлэгдлээ.", {
          variant: "success",
        });
        onRefetch?.();
      }
    } catch (error) {
      enqueueSnackbar(
        error?.message || "Гэрээт ажлыг татах үед алдаа гарлаа.",
        { variant: "error" },
      );
    }
  }, [enqueueSnackbar, onRefetch]);

  return (
    <Stack
      spacing={1}
      alignItems={{ xs: "stretch", md: "center" }}
      justifyContent="space-between"
      direction={{ xs: "column", md: "row" }}
      sx={{
        p: 2.5,
      }}
    >
      <TextField
        fullWidth
        placeholder="Нэрээр"
        value={filters.name}
        onChange={handleFilterField("name")}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ flexShrink: 0 }}
      >
        {menuPermissions.sync && (
          <Tooltip title="Гэрээт ажлын жагсаалтыг шинэчлэх">
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleSyncGeoNameProjects}
              startIcon={<Iconify icon="eva:cloud-download-outline" />}
              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              Шинэчлэх
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

ChampaignTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  onRefetch: PropTypes.func,
  menuPermissions: PropTypes.object,
};
