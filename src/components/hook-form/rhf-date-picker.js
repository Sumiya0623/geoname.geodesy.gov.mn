import PropTypes from 'prop-types';
import { Controller, useFormContext } from 'react-hook-form';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// ----------------------------------------------------------------------

export default function RHFDatePicker({
  name,
  helperText,
  type,
  size,
  variant = "filled",
  ...other
}) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        let dateValue = null;
        if (field.value) {
          try {
            dateValue = field.value instanceof Date ? field.value : new Date(field.value);
            if (isNaN(dateValue.getTime())) {
              dateValue = null;
            }
          } catch (e) {
            dateValue = null;
          }
        }

        return (
          <DatePicker
            {...field}
            value={dateValue}
            onChange={(newValue) => {
              field.onChange(newValue);
            }}
            slotProps={{
              textField: {
                fullWidth: true,
                size,
                error: !!error,
                helperText: error?.message || helperText,
                variant,
              },
            }}
            {...other}
          />
        );
      }}
    />
  );
}

RHFDatePicker.propTypes = {
  name: PropTypes.string.isRequired,
  helperText: PropTypes.string,
  type: PropTypes.string,
  size: PropTypes.string,
  variant: PropTypes.string,
};
