import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import {
  Badge,
  Dialog,
  DialogContent,
  DialogTitle,
  Tooltip,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";
import { useBoolean } from "src/hooks/use-boolean";
import CountNewEditForm from "./count-new-edit-form";

// ----------------------------------------------------------------------

export default function CountTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  refetch,
  menuPermissions,
  pointId,
}) {
  const form = useBoolean();
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "flex-end", md: "center" }}
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
          placeholder="Нэрээр..."
          value={filters.name}
          onChange={handleFilterField("name")}
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
          placeholder="Түлхүүр үгээр..."
          value={filters.key}
          onChange={handleFilterField("key")}
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

        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>
        {menuPermissions?.create && (
          <IconButton onClick={form.onToggle}>
            <Iconify icon="ic:baseline-plus" />
          </IconButton>
        )}
      </Stack>
      <Stack>
        <Dialog
          open={form.value}
          onClose={form.onFalse}
          fullWidth
          maxWidth="sm"
        >
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
              pointId={pointId}
            />
          </DialogContent>
        </Dialog>
      </Stack>
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
};
