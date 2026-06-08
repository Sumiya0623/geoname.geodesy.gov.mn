import PropTypes from "prop-types";
import { useCallback } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Iconify from "src/components/iconify";
import { useBoolean } from "src/hooks/use-boolean";

import {
  useGetNetWorksForDropDown,
  useGetNomeksForDropDown,
  useGetSystemsForDropDown,
} from "src/api/measurement";
import { useDebounce } from "src/hooks/use-debounce";
import { useSearchUnits } from "src/api/unit";

// ----------------------------------------------------------------------

export default function RuleTableToolbar({
  onReset,
  refetch,
  filters,
  canReset,
  onFilters,
  layer,
}) {
  const formUnit = useBoolean();
  const form = useBoolean();

  const requestBody = {
    layerId: layer?.id,
    parent: "",
  };

  const debouncedUnitQuery = useDebounce(filters.point_unit_query);
  const { units, unitsLoading } = useSearchUnits(
    !filters.point_unit_in && debouncedUnitQuery
  );

  const {
    systems,
    systemsEmpty,
    systemsMutation,
    systemsLoading,
    systemsCount,
  } = useGetSystemsForDropDown(requestBody);

  const {
    networks,
    networksEmpty,
    networksMutation,
    networksLoading,
    networksCount,
  } = useGetNetWorksForDropDown(requestBody);

  const { nomeks, nomeksEmpty, nomeksMutation, nomeksLoading, nomeksCount } =
    useGetNomeksForDropDown(requestBody);

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
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        sx={{ px: 2.5, my: 2 }}
      >
        <TextField
          fullWidth
          placeholder="Нэрээр..."
          value={filters.name}
          onChange={handleFilterField("name")}
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
      </Stack>
    </>
  );
}

RuleTableToolbar.propTypes = {
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  refetch: PropTypes.func,
  layer: PropTypes.object,
};
