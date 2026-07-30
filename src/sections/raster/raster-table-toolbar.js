import PropTypes from "prop-types";

import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import { Badge, Button, Tooltip, Autocomplete } from "@mui/material";

import { useGetLegalUnits } from "src/api/legal";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------
// Хэвлэлийн эх — toolbar: гарчгаар хайх, ЗЗ нэгж (аймаг → сум), он.
// Баруун талд шүүлт цэвэрлэх + «Хэвлэх».
// ----------------------------------------------------------------------

export default function RasterTableToolbar({
  filters,
  onFilters,
  canReset,
  onReset,
  onPrint,
}) {
  // UNITLEVEL Constant‑ийн нэр ЯГ таарах ёстой ("Аймаг" гэвэл хоосон буцна)
  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, true);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    filters.aimag?.id,
    !!filters.aimag?.id,
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
        onChange={(e) => onFilters("search", e.target.value)}
        placeholder="Зургийн нэрээр..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <Autocomplete
        value={filters.aimag || null}
        onChange={(_e, v) => {
          onFilters("aimag", v);
          onFilters("sum", null);
        }}
        options={aimagOptions}
        getOptionLabel={(o) => o?.unit || ""}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        sx={{ minWidth: 200, flexShrink: 0 }}
        renderInput={(params) => (
          <TextField {...params} placeholder="Аймаг / Нийслэл" />
        )}
      />

      <Autocomplete
        value={filters.sum || null}
        onChange={(_e, v) => onFilters("sum", v)}
        disabled={!filters.aimag?.id}
        options={sumOptions}
        getOptionLabel={(o) => o?.unit || ""}
        isOptionEqualToValue={(o, v) => o?.id === v?.id}
        sx={{ minWidth: 200, flexShrink: 0 }}
        renderInput={(params) => (
          <TextField {...params} placeholder="Сум / Дүүрэг" />
        )}
      />

      <TextField
        value={filters.year || ""}
        onChange={(e) =>
          onFilters("year", e.target.value.replace(/\D/g, "").slice(0, 4))
        }
        placeholder="Он"
        sx={{ minWidth: 110, flexShrink: 0 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify
                icon="solar:calendar-bold"
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

        <Button
          variant="contained"
          startIcon={<Iconify icon="solar:printer-bold" />}
          onClick={onPrint}
          sx={{ whiteSpace: "nowrap" }}
        >
          Хэвлэх
        </Button>
      </Stack>
    </Stack>
  );
}

RasterTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  onPrint: PropTypes.func,
};
