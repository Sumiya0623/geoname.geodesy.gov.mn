import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import { Badge, Tooltip, Autocomplete } from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import { useGetLegalUnits } from "src/api/legal";
import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------

export default function LegalTableToolbar({
  filters,
  onFilters,
  canReset,
  onReset,
  canCreate,
  onCreate,
  typeCode = "0",
  canSync = false,
  onSync,
  syncing = false,
}) {
  const needAimag = typeCode === "1" || typeCode === "2";
  const needSum = typeCode === "2";

  // Аймаг ба (аймаг сонгосон үед) сум сонголтын жагсаалт
  const { units: aimagOptions } = useGetLegalUnits("Аймаг/Нийслэл", null, needAimag);
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    filters.aimag?.id,
    needSum && !!filters.aimag?.id
  );

  const handleSearch = useCallback(
    (event) => onFilters("search", event.target.value),
    [onFilters]
  );

  const handleYear = useCallback(
    (event) => onFilters("year", event.target.value.replace(/\D/g, "").slice(0, 4)),
    [onFilters]
  );

  const handleAimag = useCallback(
    (_e, value) => {
      onFilters("aimag", value);
      onFilters("sum", null); // аймаг солихоор сумыг цэвэрлэнэ
    },
    [onFilters]
  );

  const handleSum = useCallback(
    (_e, value) => onFilters("sum", value),
    [onFilters]
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
        placeholder="Нэр, дугаар, гарын үсгээр хайх..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        value={filters.year || ""}
        onChange={handleYear}
        placeholder="Он"
        sx={{ minWidth: 110, flexShrink: 0 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="solar:calendar-bold" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      {needAimag && (
        <Autocomplete
          value={filters.aimag || null}
          onChange={handleAimag}
          options={aimagOptions}
          getOptionLabel={(o) => o?.unit || ""}
          isOptionEqualToValue={(o, v) => o?.id === v?.id}
          sx={{ minWidth: 200, flexShrink: 0 }}
          renderInput={(params) => (
            <TextField {...params} placeholder="Аймаг / Нийслэл" />
          )}
        />
      )}

      {needSum && (
        <Autocomplete
          value={filters.sum || null}
          onChange={handleSum}
          disabled={!filters.aimag?.id}
          options={sumOptions}
          getOptionLabel={(o) => o?.unit || ""}
          isOptionEqualToValue={(o, v) => o?.id === v?.id}
          sx={{ minWidth: 200, flexShrink: 0 }}
          renderInput={(params) => (
            <TextField {...params} placeholder="Сум / Дүүрэг" />
          )}
        />
      )}

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

        {canSync && (
          <Tooltip title="Сангаас дуудах — төслийн хамрах засаг захиргаанд (аймаг сонгосон бол доод шатны сум, баг хүртэл) харьяалагдах бүх шийдвэрийг сангаас нэг дор төсөлд холбоно">
            <span>
              <IconButton
                color="primary"
                onClick={onSync}
                disabled={syncing}
              >
                <Iconify
                  icon="solar:refresh-circle-bold"
                  sx={
                    syncing
                      ? {
                          animation: "spin 1s linear infinite",
                          "@keyframes spin": {
                            from: { transform: "rotate(0deg)" },
                            to: { transform: "rotate(360deg)" },
                          },
                        }
                      : undefined
                  }
                />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {canCreate && (
          <Tooltip title="Шинэ тогтоол нэмэх">
            <IconButton color="inherit" onClick={onCreate}>
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

LegalTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
  canCreate: PropTypes.bool,
  onCreate: PropTypes.func,
  typeCode: PropTypes.string,
  canSync: PropTypes.bool,
  onSync: PropTypes.func,
  syncing: PropTypes.bool,
};
