import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Box, Collapse, Tooltip } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";
import GeoServerEditForm from "./geoserver-new-edit-form";
import { useBoolean } from "src/hooks/use-boolean";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

export default function GeoServerTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  menuPermissions
}) {
  const { constants: workspaces, constantsMutation } =
    useGetConstantsFordropdown("WORKSPACES");
  const form = useBoolean();
  const handleFilterName = useCallback(
    (event) => {
      onFilters("name", event.target.value);
    },
    [onFilters]
  );

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
          placeholder="Нэрээр..."
          value={filters.name}
          onChange={handleFilterName}
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
          {menuPermissions?.create &&
            <IconButton onClick={form.onToggle}>
              <Badge color="error" variant="dot" invisible={!canReset}>
                <Iconify icon="ic:baseline-plus" />
              </Badge>
            </IconButton>
          }
        </Stack>
      </Stack>
      <Stack>
        <Collapse in={form.value} timeout="auto" unmountOnExit>
          <Box sx={{ p: 1.5, mb: { xs: 3, md: 1 } }}>
            <GeoServerEditForm
              onCloseForm={form.onFalse}
              refetch={constantsMutation}
            />
          </Box>
        </Collapse>
      </Stack>
    </>
  );
}

GeoServerTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
};
