import PropTypes from "prop-types";
import Stack from "@mui/material/Stack";
import { Autocomplete, TextField } from "@mui/material";

import { useGetUnitsFordropdown } from "src/api/unit";

export default function UnitFilterToolbar({ filters, onFilters, units }) {
  const { units: unit2List } = useGetUnitsFordropdown(
    filters.unit1?.id ? { parent_unit: filters.unit1.id } : null
  );
  const { units: unit3List } = useGetUnitsFordropdown(
    filters.unit2?.id ? { parent_unit: filters.unit2.id } : null
  );
  return (
    <>
      <Stack
        spacing={2}
        alignItems={{ xs: "flex-end", md: "center" }}
        direction={{ xs: "column", md: "row" }}
      >
        <Autocomplete
          fullWidth
          value={filters.unit1}
          onChange={(e, newVal) => {
            onFilters("unit1", newVal);
            onFilters("unit2", null);
            onFilters("unit3", null);
          }}
          options={units}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Аймаг" />}
        />

        <Autocomplete
          fullWidth
          value={filters.unit2}
          onChange={(e, newVal) => {
            onFilters("unit2", newVal);
            onFilters("unit3", null);
          }}
          options={unit2List}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Сум" />}
        />

        <Autocomplete
          fullWidth
          value={filters.unit3}
          onChange={(e, newVal) => onFilters("unit3", newVal)}
          options={unit3List}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Баг" />}
        />
      </Stack>
    </>
  );
}

UnitFilterToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  units: PropTypes.array,
};
