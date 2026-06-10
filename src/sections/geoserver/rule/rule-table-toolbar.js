import PropTypes from "prop-types";
import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------

export default function RuleTableToolbar({ filters, onFilters }) {
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  return (
    <Stack
      spacing={2}
      alignItems={{ xs: "flex-end", md: "center" }}
      direction={{ xs: "column", md: "row" }}
      sx={{ px: 2.5, my: 2 }}
    >
      <TextField
        fullWidth
        placeholder="Хайх..."
        value={filters?.name || ""}
        onChange={handleFilterField("name")}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />
    </Stack>
  );
}

RuleTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
};
