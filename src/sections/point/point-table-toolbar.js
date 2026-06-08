import PropTypes from "prop-types";
import { useCallback, useState } from "react";

import {
  Autocomplete,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  MenuItem,
  Checkbox,
} from "@mui/material";

import dayjs from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";

import Iconify from "src/components/iconify";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import {
  useGetNomeksForDropDown,
  useGetSystemsForDropDown,
} from "src/api/measurement";
import Link from "next/link";

// ----------------------------------------------------------------------

export default function PointTableToolbar({
  filters,
  onFilters,
  statusOptions,
  canReset,
  onReset,
}) {
  const popover = usePopover();

  const [showDateFilters, setShowDateFilters] = useState(false);

  // Remote options
  const requestBody = { parent: "" };
  const { systems } = useGetSystemsForDropDown(requestBody);
  const { nomeks = [] } = useGetNomeksForDropDown(requestBody);

  const toStringArray = (value) =>
    Array.isArray(value) ? value.map(String) : String(value).split(",");

  // Text filter generic handler
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  // Status (multiple)
  const handleStatusChange = useCallback(
    (event) => onFilters("status_in", toStringArray(event.target.value)),
    [onFilters]
  );

  const handleSystemChange = useCallback(
    (event) =>
      onFilters("measurement_system_in", toStringArray(event.target.value)),
    [onFilters]
  );

  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ md: "row" }}
        sx={{ p: 2.5, pr: { xs: 2.5, md: 1 }, flexWrap: "wrap", gap: 1 }}
      >
        <TextField
          placeholder="нэр, дугаар..."
          value={filters.name_or_number ?? ""}
          onChange={handleFilterField("name_or_number")}
          sx={{ flexGrow: 1 }}
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

        <TextField
          select
          label="Систем"
          value={(filters.measurement_system_in ?? []).map(String)}
          onChange={handleFilterField("measurement_system_in")}
          SelectProps={{
            multiple: true,
            MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
          }}
          sx={{ flexGrow: 1, textTransform: "capitalize" }}
        >
          {systems?.map((o) => (
            <MenuItem key={o.id} value={String(o.id)}>
              {o.name}
            </MenuItem>
          ))}
        </TextField>

        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={2}
          options={nomeks || []}
          value={(filters.nomek_in || [])
            .map((id) => (nomeks || []).find((o) => o.id === id))
            .filter(Boolean)}
          onChange={(_, newValue) =>
            onFilters(
              "nomek_in",
              newValue.map((o) => o.id)
            )
          }
          getOptionLabel={(option) => option.nomek}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          slotProps={{ paper: { sx: { maxHeight: 260 } } }}
          sx={{ flexGrow: 1 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Нэрлэвэрээр..."
              placeholder="+ нэрлэвэр"
            />
          )}
          renderOption={(props, option, { selected }) => (
            <li {...props} key={option.id}>
              <Checkbox size="small" disableRipple checked={selected} />
              {option.nomek}
            </li>
          )}
          renderTags={(selected, getTagProps) =>
            selected.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.id}
                label={option.nomek}
                size="small"
                variant="outlined"
                color="primary"
              />
            ))
          }
          groupBy={(opt) => opt.scale?.name || ""}
        />

        <IconButton
          aria-label="Нэмэлт шүүлтүүр"
          onClick={() => setShowDateFilters((prev) => !prev)}
        >
          <Iconify icon="ic:round-filter-alt" />
        </IconButton>

        {canReset && (
          <IconButton
            aria-label="Шүүлтүүр цэвэрлэх"
            onClick={onReset}
            color="error"
          >
            <Iconify icon="solar:restart-bold" />
          </IconButton>
        )}

        <IconButton
          component={Link}
          href="/dashboard/map"
          aria-label="Газрын зураг"
        >
          <Iconify
            color="primary"
            icon="mdi:map-outline"
            width={24}
            height={24}
          />
        </IconButton>
        <CustomPopover
          open={popover.open}
          onClose={popover.onClose}
          arrow="right-top"
          sx={{ width: 140 }}
        >
          <MenuItem onClick={popover.onClose}>
            <Iconify icon="solar:printer-minimalistic-bold" />
            Print
          </MenuItem>
          <MenuItem onClick={popover.onClose}>
            <Iconify icon="solar:import-bold" />
            Import
          </MenuItem>
          <MenuItem onClick={popover.onClose}>
            <Iconify icon="solar:export-bold" />
            Export
          </MenuItem>
        </CustomPopover>
      </Stack>

      {showDateFilters && (
        <Stack
          spacing={2}
          direction={{ xs: "column", md: "row" }}
          sx={{ px: 2.5, pb: 2.5, pt: 0 }}
        >
          <TextField
            select
            label="Төлөв"
            value={(filters.status_in ?? []).map(String)}
            onChange={handleFilterField("status_in")}
            SelectProps={{
              multiple: true,
              MenuProps: { PaperProps: { sx: { maxHeight: 360 } } },
            }}
            sx={{ flexGrow: 1, textTransform: "capitalize" }}
          >
            {statusOptions?.map((o) => (
              <MenuItem key={o.id} value={String(o.id)}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="эхлэх огноо"
              value={
                filters.measured_start_date
                  ? dayjs(filters.measured_start_date)
                  : null
              }
              onChange={(v) =>
                onFilters(
                  "measured_start_date",
                  v?.isValid?.() ? v.format("YYYY-MM-DD") : ""
                )
              }
              format="YYYY-MM-DD"
              slotProps={{
                textField: {
                  sx: { minWidth: { md: 180 }, flexGrow: 1 },
                },
              }}
            />
          </LocalizationProvider>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="дуусах огноо"
              value={
                filters.measured_end_date
                  ? dayjs(filters.measured_end_date)
                  : null
              }
              onChange={(v) =>
                onFilters(
                  "measured_end_date",
                  v?.isValid?.() ? v.format("YYYY-MM-DD") : ""
                )
              }
              format="YYYY-MM-DD"
              slotProps={{
                textField: {
                  sx: { minWidth: { md: 180 }, flexGrow: 1 },
                },
              }}
            />
          </LocalizationProvider>
        </Stack>
      )}
    </>
  );
}

PointTableToolbar.propTypes = {
  filters: PropTypes.object.isRequired,
  onFilters: PropTypes.func.isRequired,
  statusOptions: PropTypes.array.isRequired,
  canReset: PropTypes.bool,
  onReset: PropTypes.func,
};
