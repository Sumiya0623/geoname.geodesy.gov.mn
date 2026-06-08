import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Tooltip, MenuItem } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// View хүснэгтийн toolbar — хайлт, level1/2/3 dependent dropdown, reset.
// ----------------------------------------------------------------------

export default function WorkspaceViewsToolbar({
  filters,
  onFilters,
  canReset,
  onReset,
  level1Opts,
  level2Opts,
  level3Opts,
}) {
  const handleField = useCallback(
    (field) => (event) => onFilters(field, event.target.value),
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
        value={filters.search}
        onChange={handleField("search")}
        placeholder="Нэрээр хайх..."
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
        label="Ангилал"
        value={filters.level1}
        onChange={handleField("level1")}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">— Бүгд —</MenuItem>
        {level1Opts.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        label="Анхдагч"
        value={filters.level2}
        onChange={handleField("level2")}
        disabled={!filters.level1}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">— Бүгд —</MenuItem>
        {level2Opts.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        fullWidth
        label="Дэд"
        value={filters.level3}
        onChange={handleField("level3")}
        disabled={!filters.level2}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">— Бүгд —</MenuItem>
        {level3Opts.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </TextField>

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
      </Stack>
    </Stack>
  );
}

WorkspaceViewsToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  level1Opts: PropTypes.array,
  level2Opts: PropTypes.array,
  level3Opts: PropTypes.array,
};
