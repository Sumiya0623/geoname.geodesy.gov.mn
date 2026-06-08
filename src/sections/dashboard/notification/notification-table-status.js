import PropTypes from 'prop-types';
import { useCallback } from 'react';
import { Tabs, Tab } from '@mui/material';
import { Box } from '@mui/system';
import Label from 'src/components/label';

// Card-ууд: Бүгд / Даалгавар / Гүйцэтгэл / Хяналт / Устгагдсан
export default function NotificationTableStatusBar({ filters, onFilters, STATUSES }) {
  const handleStatusChange = useCallback(
    (_, newValue) => {
      onFilters('category', newValue ?? null);
    },
    [onFilters]
  );

  return (
    <Box sx={{ px: 2, pt: 1 }}>
      <Tabs value={filters.category ?? ''} onChange={handleStatusChange}>
        {STATUSES.map((tab) => (
          <Tab
            key={tab.id || 'all'}
            value={tab.id ?? ''}
            label={tab.name}
            iconPosition="end"
            icon={
              <Label
                variant={
                  filters.category === tab.id || (tab.id === '' && !filters.category)
                    ? 'filled'
                    : 'soft'
                }
                color={tab?.color || 'default'}
              >
                {String(tab.count)}
              </Label>
            }
            sx={{ '&:not(:last-of-type)': { mr: 3 } }}
          />
        ))}
      </Tabs>
    </Box>
  );
}

NotificationTableStatusBar.propTypes = {
  STATUSES: PropTypes.array.isRequired,
  filters: PropTypes.object,
  onFilters: PropTypes.func,
};
