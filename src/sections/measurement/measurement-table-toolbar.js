import PropTypes from "prop-types";
import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import {
  Collapse,
  Box,
  Button,
  Autocomplete,
  IconButton,
  Badge,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  MenuItem,
  Divider,
  Checkbox,
  Chip,
  Tooltip,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

import { useBoolean } from "src/hooks/use-boolean";
import MeasurementNewEditForm from "./measurement-new-edit-form";

import {
  useGetNetWorksForDropDown,
  useGetNomeksForDropDown,
  useGetRegisteredUnitsForDropDown,
  useGetSystemsForDropDown,
} from "src/api/measurement";

import RegisteredUnitFilterToolbar from "./measurement-unit-filter-toolbar";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

export default function MeasurementTableToolbar({
  onReset,
  refetch,
  filters,
  canReset,
  onFilters,
  projectId,
  pointId,
  menuPermissions,
}) {
  const formUnit = useBoolean();
  const form = useBoolean();
  const requestBody = {
    project: projectId,
    parent: "",
  };
  const { units } = useGetRegisteredUnitsForDropDown({ parent: "" });
  const { systems } = useGetSystemsForDropDown(requestBody);
  const { networks } = useGetNetWorksForDropDown(requestBody);
  const { nomeks } = useGetNomeksForDropDown(requestBody);
  const { statuses } = useGetConstantsFordropdown("POINTSTATUS");
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "flex-end", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        sx={{ px: 2.5, my: 2 }}
      >
        <TextField
          fullWidth
          placeholder="Дугаараар..."
          value={filters.point__number}
          onChange={handleFilterField("point__number")}
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
          fullWidth
          placeholder="Нэрээр..."
          value={filters.point__name}
          onChange={handleFilterField("point__name")}
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
        <FormControl sx={{ width: 1 }}>
          <InputLabel>Сүлжээгээр...</InputLabel>

          <Select
            fullWidth
            value={filters.network_in}
            onChange={handleFilterField("network_in")}
            input={<OutlinedInput label="Сүлжээгээр..." />}
            MenuProps={{ PaperProps: { sx: { maxHeight: 240 } } }}
          >
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              Хоосон
            </MenuItem>

            <Divider sx={{ borderStyle: " dashed" }} />

            {networks?.map((network) => (
              <MenuItem key={network.id} value={network.id}>
                {network.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ width: 1 }}>
          <InputLabel>Солбицлын систем...</InputLabel>

          <Select
            fullWidth
            value={filters.system_in}
            onChange={handleFilterField("system_in")}
            input={<OutlinedInput label="Солбицлын систем..." />}
            MenuProps={{ PaperProps: { sx: { maxHeight: 240 } } }}
          >
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              Хоосон
            </MenuItem>

            <Divider sx={{ borderStyle: " dashed" }} />

            {systems?.map((system) => (
              <MenuItem key={system.id} value={system.id}>
                {system.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          fullWidth
          multiple
          disableCloseOnSelect
          limitTags={2}
          value={(filters.point_nomek_in || [])
            .map((id) => nomeks.find((o) => o.id === id))
            .filter(Boolean)}
          onChange={(_, newValue) =>
            handleFilterField("point_nomek_in")({
              target: { value: newValue.map((o) => o.id) }, // <-- зөвхөн тоонууд
            })
          }
          options={nomeks}
          getOptionLabel={(option) => option.nomek}
          isOptionEqualToValue={(opt, val) => opt.id === val.id}
          slotProps={{
            paper: { sx: { maxHeight: 260 } },
          }}
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
                color="primary"
                variant="soft" // хэрэв стандарт MUI бол 'outlined'/'filled' хэрэглэнэ
              />
            ))
          }
          groupBy={(opt) => opt.scale?.name || ""}
        />
        <Button
          startIcon={<Iconify icon="ic:round-filter-list" />}
          onClick={formUnit.onToggle}
        >
          Шүүлт
        </Button>
        <Tooltip title="Шүүлт цэвэрлэх">
          <IconButton onClick={onReset}>
            <Badge color="error" variant="dot" invisible={!canReset}>
              <Iconify icon="solar:restart-bold" />
            </Badge>
          </IconButton>
        </Tooltip>
        {menuPermissions?.create && (
          <IconButton onClick={form.onToggle} id="measurement-create">
            <Iconify icon="ic:baseline-plus" />
          </IconButton>
        )}
      </Stack>
      <Stack>
        <Collapse in={form.value} timeout="auto" unmountOnExit>
          <Box sx={{ p: 1.5, mb: { xs: 3, md: 1 } }}>
            <MeasurementNewEditForm
              onCloseForm={form.onFalse}
              refetch={refetch}
              projectId={projectId}
              pointId={pointId}
            />
          </Box>
        </Collapse>
      </Stack>
      <Collapse in={formUnit.value} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2.5, pb: 2 }}>
          <RegisteredUnitFilterToolbar
            filters={filters}
            onFilters={onFilters}
            units={units}
          />
        </Box>
      </Collapse>
    </>
  );
}

MeasurementTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  refetch: PropTypes.func,
  projectId: PropTypes.number,
  menuPermissions: PropTypes.object,
};
