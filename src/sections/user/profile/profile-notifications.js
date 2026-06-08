"use client";

import {
  Box,
  Card,
  Stack,
  Button,
  Typography,
  CircularProgress,
} from "@mui/material";

import { useInfiniteNotifications } from "src/api/notification";

import Iconify from "src/components/iconify";

import NotificationItem from "src/layouts/common/notifications-popover/notification-item";

// ----------------------------------------------------------------------

export default function ProfileNotifications() {
  const {
    notifications,
    notificationsLoading,
    notificationsEmpty,
    notificationsMutation,
    loadMore,
    hasMore,
  } = useInfiniteNotifications();

  if (notificationsLoading) {
    return (
      <Box sx={{ py: 5, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notificationsEmpty) {
    return (
      <Card sx={{ p: 5, textAlign: "center" }}>
        <Iconify
          icon="solar:bell-off-bold-duotone"
          width={56}
          sx={{ color: "text.disabled", mb: 1 }}
        />
        <Typography variant="body2" color="text.secondary">
          Мэдэгдэл алга байна
        </Typography>
      </Card>
    );
  }

  return (
    <Card>
      <Stack>
        {notifications
          .filter((n) => n && n.actor)
          .map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={() => {}}
              onDeleted={() => notificationsMutation()}
            />
          ))}
      </Stack>

      {hasMore && (
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Button
            variant="soft"
            onClick={loadMore}
            startIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
          >
            Цааш үзэх
          </Button>
        </Box>
      )}
    </Card>
  );
}
