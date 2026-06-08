import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import {
  Badge,
  Tooltip,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

// ----------------------------------------------------------------------

const METHOD_OPTIONS = [
  { value: "", label: "Бүгд" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Бүгд" },
  { value: "205", label: "Гарсан" },
  { value: "login", label: "Нэвтэрсэн" },
  { value: "2", label: "2xx" },
  { value: "3", label: "3xx" },
  { value: "4", label: "4xx" },
  { value: "5", label: "5xx" },
];

export default function RequestTableToolbar({
  onReset,
  filters,
  canReset,
  onFilters,
  loading = false,
}) {
  const handleFilterUserName = useCallback(
    (event) => {
      onFilters("user__first_name", event.target.value);
    },
    [onFilters]
  );

  const handleFilterUrl = useCallback(
    (event) => {
      onFilters("url", event.target.value);
    },
    [onFilters]
  );

  const handleFilterMethod = useCallback(
    (event) => {
      onFilters("method", event.target.value);
    },
    [onFilters]
  );

  const handleFilterStatus = useCallback(
    (event) => {
      onFilters("status_code", event.target.value);
    },
    [onFilters]
  );

  return (
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
      id="access-tour5"
    >
      <TextField
        fullWidth
        placeholder="Хэрэглэгчийн нэрээр..."
        value={filters.user__first_name}
        onChange={handleFilterUserName}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:person-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <TextField
        fullWidth
        placeholder="URL хаягаар..."
        value={filters.url}
        onChange={handleFilterUrl}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:link-fill" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          ),
        }}
      />

      <FormControl sx={{ minWidth: 120 }}>
        <InputLabel>Үйлдэл</InputLabel>
        <Select
          value={filters.method}
          onChange={handleFilterMethod}
          label="Үйлдэл"
          disabled={loading}
        >
          {METHOD_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl sx={{ minWidth: 140 }}>
        <InputLabel>Статус</InputLabel>
        <Select
          value={filters.status_code}
          onChange={handleFilterStatus}
          label="Статус"
          disabled={loading}
        >
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Tooltip title="Шүүлт цэвэрлэх">
        <span>
          <IconButton onClick={onReset} disabled={loading}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

RequestTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  loading: PropTypes.bool,
};
