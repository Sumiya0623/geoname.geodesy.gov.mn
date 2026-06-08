import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Tooltip } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

import GeonameCategoryCascade from "./geoname-category-cascade";

// ----------------------------------------------------------------------

export default function GeonameTableToolbar({
  filters,
  onFilters,
  canReset,
  onReset,
  canCreate,
  onCreate,
  rootTypeId,
  onAdvanced,
  advancedActive,
}) {
  const handleSearch = useCallback(
    (event) => onFilters("search", event.target.value),
    [onFilters],
  );

  return (
    <Stack
      spacing={2}
      alignItems={{ xs: "stretch", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      sx={{ p: 2.5 }}
    >
      <TextField
        fullWidth
        value={filters.search}
        onChange={handleSearch}
        placeholder="Нэр, дугаараар хайх..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Ангилал — картын child‑аас эхэлж шаталж задарна */}
      <GeonameCategoryCascade
        rootTypeId={rootTypeId}
        value={filters.category}
        onChange={(id) => onFilters("category", id)}
      />

      {/* Жижиг товчнууд — үргэлж 1 мөрөнд */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ flexShrink: 0 }}
      >
        <Tooltip title="Дэлгэрэнгүй хайлт">
          <IconButton color="inherit" onClick={onAdvanced}>
            <Badge color="error" variant="dot" invisible={!advancedActive}>
              <Iconify icon="solar:filter-bold" />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>

        {canCreate && (
          <Tooltip title="Шинэ нэр нэмэх">
            <IconButton color="inherit" onClick={onCreate}>
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

GeonameTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  canCreate: PropTypes.bool,
  onCreate: PropTypes.func,
  rootTypeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onAdvanced: PropTypes.func,
  advancedActive: PropTypes.bool,
};
