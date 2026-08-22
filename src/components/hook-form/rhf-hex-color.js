import PropTypes from 'prop-types';
import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';

import { HexColorPicker } from 'react-colorful';

export default function RHFHexColorPicker({ name, label, helperText, sx, ...other }) {
  const { control } = useFormContext();
  const [anchorEl, setAnchorEl] = useState(null);

  const open = Boolean(anchorEl);
  const id = open ? `${name}-color-popover` : undefined;

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const value = typeof field.value === 'string' && field.value ? field.value : '#000000';

        const handleOpen = (event) => setAnchorEl(event.currentTarget);
        const handleClose = () => setAnchorEl(null);

        const onTextChange = (e) => {
          const v = e.target.value;
          if (/^#?[0-9A-Fa-f]*$/.test(v.replace('#', ''))) {
            const withHash = v.startsWith('#') ? v : `#${v}`;
            field.onChange(withHash);
          }
        };

        return (
          <>
            <TextField
              {...field}
              value={value}
              onChange={onTextChange}
              label={label}
              fullWidth
              error={!!error}
              helperText={error ? error?.message : helperText}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton aria-describedby={id} onClick={handleOpen}>
                      <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: value, border: '1px solid', borderColor: 'divider' }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={sx}
              {...other}
            />
            <Popover
              id={id}
              open={open}
              anchorEl={anchorEl}
              onClose={handleClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              <Box sx={{ p: 2 }}>
                <HexColorPicker color={value} onChange={field.onChange} />
              </Box>
            </Popover>
          </>
        );
      }}
    />
  );
}

RHFHexColorPicker.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  helperText: PropTypes.node,
  sx: PropTypes.object,
};
