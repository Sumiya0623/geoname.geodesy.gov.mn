import PropTypes from 'prop-types';

import { Stack } from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

// ----------------------------------------------------------------------

export default function TableSkeleton({ actionLength = 1, headLength, ...other }) {
  const withoutActionHeadLength = headLength - 1;
  return (
    <TableRow {...other}>
      {Array.from({ length: withoutActionHeadLength }).map((_, index) => (
        <TableCell key={index}>
          <Skeleton variant="text" sx={{ width: 1 }} />
        </TableCell>
      ))}

      <TableCell align="right" sx={{ px: 1 }}>
        {actionLength > 1 ? (
          <Stack direction="row" spacing={0.5}>
            {Array.from({ length: actionLength }).map((_, index) => (
              <Skeleton key={index} variant="circular" sx={{ height: 36, width: 36 }} />
            ))}
          </Stack>
        ) : (
          <Stack alignItems="flex-end">
            <Skeleton variant="circular" sx={{ height: 36, width: 36 }} />
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
}

TableSkeleton.propTypes = {
  headLength: PropTypes.number,
  actionLength: PropTypes.number,
};
