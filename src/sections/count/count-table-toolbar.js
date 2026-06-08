import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import {
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";
import { useBoolean } from "src/hooks/use-boolean";
import CountNewEditForm from "./count-new-edit-form";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

export default function CountTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  refetch,
  menuPermissions,
  projectId,
}) {
  const form = useBoolean();
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters],
  );
  const { constants: statuses } = useGetConstantsFordropdown("POINTSTATUS");
  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{
          xs: "column",
          md: "row",
        }}
        sx={{
          p: 2.5,
          pr: { xs: 2.5, md: 1 },
        }}
      >
        <TextField
          fullWidth
          placeholder="Нэр, дугаараар..."
          value={filters.point_name_or_number}
          onChange={handleFilterField("point_name_or_number")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled" }}
                />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          placeholder="Гэрээний нэрээр..."
          value={filters.project__name}
          onChange={handleFilterField("project__name")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled" }}
                />
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
          <Tooltip title="Шүүлт цэвэрлэх">
            <IconButton onClick={onReset}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="solar:restart-bold" />
              </Badge>
            </IconButton>
          </Tooltip>
          {menuPermissions?.create && projectId && (
            <IconButton onClick={form.onToggle} id="count-add">
              <Iconify icon="ic:baseline-plus" />
            </IconButton>
          )}
        </Stack>
      </Stack>
      <Dialog open={form.value} onClose={form.onFalse} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
          }}
        >
          Тооллого бүртгэх
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <CountNewEditForm
            onCloseForm={form.onFalse}
            refetch={refetch}
            projectId={projectId}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

CountTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  refetch: PropTypes.func,
  users: PropTypes.array,
  points: PropTypes.array,
  pointsLoading: PropTypes.func,
  onFilters: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
