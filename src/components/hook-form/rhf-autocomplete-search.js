// components/hook-form/RHFAutocompleteSearch.js
import PropTypes from "prop-types";
import { Controller, useFormContext } from "react-hook-form";
import { Typography, TextField, Box } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import Iconify from "../iconify";
import SearchNotFound from "../search-not-found";
import match from "autosuggest-highlight/match";
import parse from "autosuggest-highlight/parse";

export default function RHFAutocompleteSearch({
  name,
  label,
  helperText,
  placeholder,
  query,
  loading,
  options = [],
  getOptionLabel,
  renderOption,
  isOptionEqualToValue = (a, b) => a?.id === b?.id,
  ...other
}) {
  const { control, setValue } = useFormContext();

  // 🧠 Default label renderer: register + name
  const defaultGetOptionLabel = (option) =>
    option?.register ? `${option.register} - ${option.full_name} || ''}` : "";

  // 🧠 Default option renderer with highlight
  const defaultRenderOption = (props, option, { inputValue }) => {
    const label = defaultGetOptionLabel(option);
    const matches = match(label, inputValue);
    const parts = parse(label, matches);

    return (
      <Box component="li" {...props} key={option.id}>
        {parts.map((part, index) => (
          <Typography
            key={index}
            component="span"
            color={part.highlight ? "primary" : "textPrimary"}
            sx={{
              typography: "body2",
              fontWeight: part.highlight
                ? "fontWeightSemiBold"
                : "fontWeightMedium",
            }}
          >
            {part.text}
          </Typography>
        ))}
      </Box>
    );
  };

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <Autocomplete
          {...field}
          value={field.value}
          onChange={(_, newValue) =>
            setValue(name, newValue, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          options={options}
          loading={loading}
          loadingText={<Typography variant="body2">Уншиж байна...</Typography>}
          noOptionsText={
            <SearchNotFound query={query} sx={{ bgcolor: "unset" }} />
          }
          fullWidth
          autoHighlight
          popupIcon={null}
          isOptionEqualToValue={isOptionEqualToValue}
          getOptionLabel={getOptionLabel || defaultGetOptionLabel}
          renderOption={renderOption || defaultRenderOption}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              variant="filled"
              error={!!error}
              helperText={error ? error?.message : helperText}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading && (
                      <Iconify
                        icon="svg-spinners:8-dots-rotate"
                        sx={{ mr: -3 }}
                      />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          slotProps={{ paper: { sx: { maxHeight: 250 } } }}
          {...other}
        />
      )}
    />
  );
}

RHFAutocompleteSearch.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  helperText: PropTypes.node,
  placeholder: PropTypes.string,
  query: PropTypes.string,
  loading: PropTypes.bool,
  options: PropTypes.array,
  getOptionLabel: PropTypes.func,
  renderOption: PropTypes.func,
  isOptionEqualToValue: PropTypes.func,
};
