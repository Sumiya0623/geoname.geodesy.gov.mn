import PropTypes from "prop-types";
import { Autocomplete, Chip, TextField } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";

export default function RHFMultiChipAutocomplete({
  name,
  label,
  options = [],
  getOptionLabel = (opt) => opt?.name || "",
  isOptionEqualToValue = (opt, val) => opt?.id === val?.id,
}) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Autocomplete
          multiple
          options={options}
          getOptionLabel={getOptionLabel}
          isOptionEqualToValue={isOptionEqualToValue}
          value={field.value || []}
          onChange={(_, newValue) => field.onChange(newValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                {...getTagProps({ index })}
                key={option.id}
                label={getOptionLabel(option)}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              variant="filled"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            />
          )}
        />
      )}
    />
  );
}

RHFMultiChipAutocomplete.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  options: PropTypes.array,
  getOptionLabel: PropTypes.func,
  isOptionEqualToValue: PropTypes.func,
};
