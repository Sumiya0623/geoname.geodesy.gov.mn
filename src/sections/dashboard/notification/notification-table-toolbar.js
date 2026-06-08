import PropTypes from 'prop-types';
import { useCallback } from 'react';
import Stack from '@mui/material/Stack';
import { Badge, Tooltip, TextField, InputAdornment, MenuItem } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: '', label: 'Бүх төлөв' },
  { value: 'sent', label: 'Амжилттай' },
  { value: 'failed', label: 'Амжилтгүй' },
];

export default function NotificationTableToolbar({ filters, onFilters, onReset, canReset }) {
  const handleFilterField = useCallback(
    (field) => (event) => {
      onFilters(field, event.target.value);
    },
    [onFilters]
  );

  return (
    <Stack
      spacing={2}
      alignItems={{ xs: 'flex-end', md: 'center' }}
      direction={{ xs: 'column', md: 'row' }}
      sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
    >
      <TextField
        fullWidth
        placeholder="Хүлээн авагч, гарчиг, агуулгаар хайх..."
        value={filters.search || ''}
        onChange={handleFilterField('search')}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        select
        label="Төлөв"
        value={filters.status || ''}
        onChange={handleFilterField('status')}
        sx={{ minWidth: { xs: '100%', md: 200 } }}
      >
        {STATUS_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <Tooltip title="Шүүлт цэвэрлэх">
        <IconButton onClick={onReset}>
          <Badge color="error" variant="dot" invisible={!canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

NotificationTableToolbar.propTypes = {
  filters: PropTypes.object,
  onFilters: PropTypes.func,
  onReset: PropTypes.func,
  canReset: PropTypes.bool,
};
