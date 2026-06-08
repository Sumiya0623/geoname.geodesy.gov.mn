import PropTypes from 'prop-types';
import { 
  TableCell, 
  TableRow, 
  Typography, 
  Stack,
  IconButton,
  Tooltip
} from '@mui/material';

import { fDate } from 'src/utils/format-time';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { getMethodLabelColor } from './method-colors';

// ----------------------------------------------------------------------

export default function RequestTableRow({
  rowQueue,
  row,
  onViewDetails,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { 
    id, 
    user_name, 
    url, 
    query_string, 
    remote_ip, 
    datetime, 
    method, 
    status_code, 
    data 
  } = row;


  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  const truncateData = (data, maxLength = 100) => {
    if (!data) return '-';
    if (data.length <= maxLength) return data;
    return `${data.substring(0, maxLength)}...`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onViewDetails && onViewDetails(row);
    }
  };

  return (
    <TableRow
      tabIndex={0}
      role="button"
      onClick={() => onViewDetails && onViewDetails(row)}
      onKeyDown={handleKeyDown}
      sx={{
        '& > *': { borderBottom: 'unset' },
        cursor: 'pointer',
        backgroundColor: 'transparent',
        transition: 'background-color 150ms ease',
        '&:hover': { backgroundColor: 'action.hover' },
        // show a clear focus ring for keyboard users
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
          backgroundColor: 'action.hover'
        },
      }}
    >
      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
      
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {user_name || '-'}
      </TableCell>
      
      <TableCell sx={{ maxWidth: 200 }}>
        <Typography variant="body2" noWrap>
          {url}
        </Typography>
        {query_string && (
          <Typography variant="caption" color="text.secondary" noWrap>
            ?{query_string}
          </Typography>
        )}
      </TableCell>
      
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {remote_ip}
      </TableCell>
      
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        {fDate(datetime, 'yyyy MM dd')}
      </TableCell>
      
      <TableCell>
        <Label variant="soft" color={getMethodLabelColor(method)}>
          {method}
        </Label>
      </TableCell>
      
      <TableCell>
        <Label variant="soft" color={getStatusColor(status_code)}>
          {status_code}
        </Label>
      </TableCell>
      
      <TableCell sx={{ maxWidth: 250 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}
          >
            {truncateData(data, 50)}
          </Typography>
          <Tooltip title="Дэлгэрэнгүй харах">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails && onViewDetails(row);
              }}
              sx={{ ml: 1 }}
            >
              <Iconify icon="solar:eye-bold" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

RequestTableRow.propTypes = {
  rowQueue: PropTypes.object,
  row: PropTypes.object,
  onViewDetails: PropTypes.func,
};
