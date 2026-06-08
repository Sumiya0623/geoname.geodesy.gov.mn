import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import {
  TableRow,
  TableCell,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from '@mui/material';

import { fDateTime } from 'src/utils/format-time';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

export default function NotificationTableRow({ row, rowQueue, onDeleteRow }) {
  const { page, rowsPerPage, index } = rowQueue;
  const {
    category,
    category_color,
    to_email,
    to_user,
    subject,
    body,
    status,
    status_display,
    error,
    created_at,
  } = row;

  const [openView, setOpenView] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);

  const handleView = useCallback(() => setOpenView(true), []);
  const handleCloseView = useCallback(() => setOpenView(false), []);

  const isSent = status === 'sent';

  return (
    <>
      <TableRow hover>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {category ? (
            <Label variant="soft" color={category_color || 'default'}>
              {category.name}
            </Label>
          ) : (
            <Label variant="soft" color="default">
              Ангилалгүй
            </Label>
          )}
        </TableCell>

        <TableCell sx={{ maxWidth: 220 }}>
          <Typography variant="body2" noWrap>
            {to_user || '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {to_email}
          </Typography>
        </TableCell>

        <TableCell sx={{ maxWidth: 320 }}>
          <Typography variant="body2" noWrap>
            {subject || '-'}
          </Typography>
        </TableCell>

        <TableCell>
          <Tooltip title={!isSent && error ? error : ''}>
            <Label variant="soft" color={isSent ? 'success' : 'error'}>
              {status_display || (isSent ? 'Амжилттай' : 'Амжилтгүй')}
            </Label>
          </Tooltip>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fDateTime(created_at, 'yyyy-MM-dd HH:mm')}</TableCell>

        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
          <Tooltip title="Дэлгэрэнгүй харах">
            <IconButton onClick={handleView}>
              <Iconify icon="solar:eye-bold" />
            </IconButton>
          </Tooltip>
          {onDeleteRow && (
            <Tooltip title="Устгах">
              <IconButton color="error" onClick={() => setOpenConfirm(true)}>
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={openView} onClose={handleCloseView} fullWidth maxWidth="sm">
        <DialogTitle>{subject || 'Имэйл'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              {category && (
                <Label variant="soft" color={category_color || 'default'}>
                  {category.name}
                </Label>
              )}
              <Label variant="soft" color={isSent ? 'success' : 'error'}>
                {status_display || (isSent ? 'Амжилттай' : 'Амжилтгүй')}
              </Label>
            </Stack>
            <Typography variant="body2">
              <b>Хүлээн авагч:</b> {to_user} {to_email ? `<${to_email}>` : ''}
            </Typography>
            <Typography variant="body2">
              <b>Огноо:</b> {fDateTime(created_at, 'yyyy-MM-dd HH:mm')}
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Агуулга
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'background.neutral',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: body || '-' }}
              />
            </Box>
            {!isSent && error && (
              <Box>
                <Typography variant="subtitle2" color="error" sx={{ mb: 0.5 }}>
                  Алдааны мэдээлэл
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'error.lighter',
                    color: 'error.darker',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {error}
                </Box>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseView}>Хаах</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Устгах"
        content="Энэ мэдэгдлийг устгахдаа итгэлтэй байна уу?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onDeleteRow();
              setOpenConfirm(false);
            }}
          >
            Устгах
          </Button>
        }
      />
    </>
  );
}

NotificationTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  onDeleteRow: PropTypes.func,
};
