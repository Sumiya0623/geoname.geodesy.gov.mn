import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import {
  Badge,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Tooltip,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Iconify from "src/components/iconify";

export default function NumberTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  units,
}) {
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
        value={filters.number}
        onChange={handleFilterField("number")}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <FormControl sx={{ width: 1 }}>
        <InputLabel>Аймаг/нийслэл</InputLabel>
        <Select
          fullWidth
          value={filters.unit_in}
          onChange={handleFilterField("unit_in")}
          input={<OutlinedInput label="Аймаг/нийслэл..." />}
          MenuProps={{ PaperProps: { sx: { maxHeight: 240 } } }}
        >
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            Хоосон
          </MenuItem>
          <Divider sx={{ borderStyle: " dashed" }} />
          {units?.map((unit) => (
            <MenuItem key={unit.id} value={unit.id}>
              {unit.unit}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title="Шүүлт цэвэрлэх">
        <IconButton onClick={onReset}>
          <Badge color="error" variant="dot" invisible={!canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

NumberTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  units: PropTypes.array,
};
