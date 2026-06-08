import PropTypes from "prop-types";
import { useCallback } from "react";

import Stack from "@mui/material/Stack";
import {
  Collapse,
  Box,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

import Iconify from "src/components/iconify";

import { useBoolean } from "src/hooks/use-boolean";
import ActNewEditForm from "./act-new-edit-form";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

export default function ActTableToolbar({
  refetch,
  filters,
  onFilters,
  projectId,
  setSeeOwn,
  seeOwn,
}) {
  const form = useBoolean();
  const { constants: statuses } = useGetConstantsFordropdown("POINTSTATUS");
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
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        sx={{
          p: 2.5,
          pr: { xs: 2.5, md: 1 },
        }}
      >
        <TextField
          placeholder="Цэгийн нэр, дугаараар..."
          value={filters.measurement_point_name_or_number}
          onChange={handleFilterField("measurement_point_name_or_number")}
          sx={{ flex: 1, minWidth: 240 }}
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
          placeholder="Гэрээний нэрээр..."
          value={filters.project__name}
          onChange={handleFilterField("project__name")}
          sx={{ flex: 1, minWidth: 240 }}
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
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Төлөвөөр...</InputLabel>
          <Select
            fullWidth
            label="Төлөвөөр..."
            value={filters.accepted_state || ""}
            onChange={handleFilterField("accepted_state")}
            MenuProps={{ PaperProps: { sx: { maxHeight: 240 } } }}
          >
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              Хоосон
            </MenuItem>
            <MenuItem value="pending">Хянаж байгаа</MenuItem>
            <MenuItem value="accepted">Баталсан</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              defaultChecked={seeOwn}
              onChange={(e) => setSeeOwn((prev) => !prev)}
            />
          }
          label="Хариуцсан акт"
        />
      </Stack>

      <Stack>
        <Collapse in={form.value} timeout="auto" unmountOnExit>
          <Box sx={{ p: 1.5, mb: { xs: 3, md: 1 } }}>
            <ActNewEditForm
              onCloseForm={form.onFalse}
              refetch={refetch}
              projectId={projectId}
            />
          </Box>
        </Collapse>
      </Stack>
    </>
  );
}

ActTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  refetch: PropTypes.func,
  projectId: PropTypes.number,
  menuPermissions: PropTypes.object,
};
