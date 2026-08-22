import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Tooltip } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Ажлын зургийн жагсаалтын toolbar — гарчиг/нэгжээр хайх, шүүлт цэвэрлэх,
// шинэ ажлын зураг үүсгэх (+). Бусад жагсаалтын toolbar‑тай ижил бүтэц.
// ----------------------------------------------------------------------

export default function WorkMapTableToolbar({
  filters,
  onFilters,
  canReset,
  onReset,
  canCreate,
  onCreate,
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
      sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
    >
      <TextField
        fullWidth
        value={filters.search}
        onChange={handleSearch}
        placeholder="Зургийн нэр, сум, аймгаар хайх..."
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
        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>

        {canCreate && (
          <Tooltip title="Ажлын зураг үүсгэх">
            <IconButton color="inherit" onClick={onCreate}>
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

WorkMapTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  canCreate: PropTypes.bool,
  onCreate: PropTypes.func,
};
