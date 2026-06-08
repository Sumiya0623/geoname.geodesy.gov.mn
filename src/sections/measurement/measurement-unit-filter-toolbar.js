import PropTypes from "prop-types";
import Stack from "@mui/material/Stack";
import { Autocomplete, TextField } from "@mui/material";

import { useGetRegisteredUnitsForDropDown } from "src/api/measurement";

export default function RegisteredUnitFilterToolbar({
  filters,
  onFilters,
  units,
}) {
  const { units: unit2List } = useGetRegisteredUnitsForDropDown(
    filters.unit1?.id ? { parent: filters.unit1.id } : null
  );
  const { units: unit3List } = useGetRegisteredUnitsForDropDown(
    filters.unit2?.id ? { parent: filters.unit2.id } : null
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
          clearIcon={null}
          value={filters.unit1}
          onChange={(e, newVal) => {
            onFilters("unit1", newVal);
            onFilters("unit2", null);
            onFilters("unit3", null);
            onFilters("point_unit_in", newVal);
          }}
          options={units}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Аймаг" />}
        />

        <Autocomplete
          fullWidth
          clearIcon={null}
          value={filters.unit2}
          onChange={(e, newVal) => {
            onFilters("unit2", newVal);
            onFilters("unit3", null);
            onFilters("point_unit_in", newVal);
          }}
          options={unit2List}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Сум" />}
        />

        <Autocomplete
          fullWidth
          clearIcon={null}
          value={filters.unit3}
          onChange={(e, newVal) => {
            onFilters("point_unit_in", newVal);
          }}
          options={unit3List}
          getOptionLabel={(opt) => opt?.unit || ""}
          renderInput={(params) => <TextField {...params} label="Баг" />}
        />
      </Stack>
    </>
  );
}

RegisteredUnitFilterToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  units: PropTypes.array,
};
