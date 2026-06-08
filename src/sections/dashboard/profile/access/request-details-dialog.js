import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Stack,
  IconButton,
} from '@mui/material';

import { fDateTime } from 'src/utils/format-time';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { getMethodLabelColor } from './method-colors';

// ----------------------------------------------------------------------

export default function RequestDetailsDialog({ open, onClose, request }) {
  const {
    id,
    user_name,
    url,
    query_string,
    remote_ip,
    datetime,
    method,
    status_code,
    data,
    user
  } = request || {};

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'info';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  const formatJsonData = (jsonString) => {
    if (!jsonString) return 'Өгөгдөл байхгүй';
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return jsonString;
    }
  };

  if (!request) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">
          HTTP хүсэлтийн дэлгэрэнгүй
        </Typography>
        <IconButton onClick={onClose}>
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Basic Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Ерөнхий мэдээлэл
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>ID:</strong>
                  </Typography>
                  <Typography variant="body2">{id}</Typography>
                </Stack>
                
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>Хэрэглэгч:</strong>
                  </Typography>
                  <Typography variant="body2">{user_name || '-'}</Typography>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>User ID:</strong>
                  </Typography>
                  <Typography variant="body2">{user || '-'}</Typography>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>IP хаяг:</strong>
                  </Typography>
                  <Typography variant="body2">{remote_ip}</Typography>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>Огноо:</strong>
                  </Typography>
                  <Typography variant="body2">{fDateTime(datetime)}</Typography>
                </Stack>
              </Stack>
            </Box>
          </Grid>

          {/* Request Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              HTTP хүсэлт
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>Үйлдэл:</strong>
                  </Typography>
                  <Label variant="soft" color={getMethodLabelColor(method)}>
                    {method}
                  </Label>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    <strong>Статус:</strong>
                  </Typography>
                  <Label variant="soft" color={getStatusColor(status_code)}>
                    {status_code}
                  </Label>
                </Stack>

                <Stack direction="column" spacing={1}>
                  <Typography variant="body2">
                    <strong>URL:</strong>
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      p: 1, 
                      bgcolor: 'background.paper', 
                      borderRadius: 0.5,
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}
                  >
                    {url}
                  </Typography>
                </Stack>

                {query_string && (
                  <Stack direction="column" spacing={1}>
                    <Typography variant="body2">
                      <strong>Query String:</strong>
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        p: 1, 
                        bgcolor: 'background.paper', 
                        borderRadius: 0.5,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}
                    >
                      {query_string}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Grid>

          {/* Request Data */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Хүсэлтийн өгөгдөл
            </Typography>
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'background.neutral', 
                borderRadius: 1,
                maxHeight: 300,
                overflow: 'auto'
              }}
            >
              <Typography 
                variant="body2" 
                component="pre"
                sx={{ 
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0
                }}
              >
                {formatJsonData(data)}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Хаах
        </Button>
      </DialogActions>
    </Dialog>
  );
}

RequestDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  request: PropTypes.object,
};
