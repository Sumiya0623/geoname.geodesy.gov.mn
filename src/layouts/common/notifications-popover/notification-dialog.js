import PropTypes from "prop-types";
import { useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from "@mui/material";
import axiosInstance from "src/utils/axios";

export default function NotificationDialog({
  open,
  onClose,
  notification,
  onMarkAsRead,
}) {
  useEffect(() => {
    if (open && notification?.unread) {
      axiosInstance
        .patch(`/api/core/notification/${notification.id}/`, {
          unread: false,
        })
        .then(() => {
          onMarkAsRead?.(notification.id); // 💡 Callback дуудаж өгөгдлийг шинэчилнэ
        })
        .catch((error) => {});
    }
  }, [open, notification, onMarkAsRead]);

  if (!notification || !open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{notification.verb}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Огноо: {notification.timestamp}
          </Typography>
          <Typography variant="body1">{notification.description}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          Хаах
        </Button>
      </DialogActions>
    </Dialog>
  );
}

NotificationDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  notification: PropTypes.object,
  onMarkAsRead: PropTypes.func,
};
