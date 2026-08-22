import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Tooltip, MenuItem } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------

export default function BaseMapTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  action,
}) {
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters],
  );

  return (
    <Stack
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
    >
      <TextField
        fullWidth
        placeholder="Нэр, түлхүүрээр..."
        value={filters.search}
        onChange={handleFilterField("search")}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        select
        fullWidth
        label="Төрөл"
        value={filters.layer_type}
        onChange={handleFilterField("layer_type")}
        sx={{ maxWidth: { md: 220 } }}
      >
        <MenuItem value="">Бүгд</MenuItem>
        <MenuItem value="base">Суурь</MenuItem>
        <MenuItem value="overlay">Нэмэлт</MenuItem>
      </TextField>

      <Tooltip title="Шүүлт цэвэрлэх">
        <IconButton onClick={onReset}>
          <Badge color="error" variant="dot" invisible={!canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>

      {action}
    </Stack>
  );
}

BaseMapTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  action: PropTypes.node,
};
