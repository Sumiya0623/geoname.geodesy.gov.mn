/* eslint-disable import/no-unresolved */
import { m } from "framer-motion";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";

import {
  Tab,
  Box,
  Tabs,
  List,
  Stack,
  Badge,
  Drawer,
  Tooltip,
  Divider,
  Checkbox,
  IconButton,
  Typography,
  CircularProgress,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useResponsive } from "src/hooks/use-responsive";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useInfiniteNotifications } from "src/api/notification";

import Label from "src/components/label";
import Iconify from "src/components/iconify";
import { varHover } from "src/components/animate";
import { enqueueSnackbar } from "src/components/snackbar";

import NotificationItem from "./notification-item";
import NotificationDialog from "./notification-dialog";

export default function NotificationsPopover() {
  const drawer = useBoolean();
  const smUp = useResponsive("up", "sm");
  const [currentTab, setCurrentTab] = useState("all");
  const scrollContainerRef = useRef(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState([]);

  const {
    notifications,
    notificationsUnReadCount,
    loadMore,
    hasMore,
    meta,
    notificationsMutation,
    notificationsValidating,
  } = useInfiniteNotifications();

  useEffect(() => {
    if (drawer.value) {
      setCurrentTab("all");
      setSelected([]);
      scrollContainerRef.current?.scrollTo(0, 0);
    }
  }, [drawer.value]);

  const STATUS_TABS = useMemo(
    () => [
      {
        id: "all",
        name: "Бүгд",
        count: meta?.count || notifications.length,
        color: "default",
        filter: () => true,
      },
      {
        id: "unread",
        name: "Уншаагүй",
        count:
          meta?.unread_count ?? notifications.filter((n) => n.unread).length,
        color: "warning",
        filter: (n) => n.unread === true,
      },
      {
        id: "read",
        name: "Уншсан",
        count:
          (meta?.count ?? notifications.length) -
          (meta?.unread_count ?? notifications.filter((n) => n.unread).length),
        color: "success",
        filter: (n) => n.unread === false,
      },
    ],
    [meta, notifications],
  );

  const filteredNotifications = useMemo(() => {
    const selectedTab = STATUS_TABS.find((tab) => tab.id === currentTab);
    return notifications.filter(selectedTab?.filter || (() => true));
  }, [notifications, currentTab, STATUS_TABS]);

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
    setSelected([]);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, []);

  const onMarkAsRead = useCallback(
    (id) => {
      notificationsMutation((prev) => {
        if (!prev) return prev;
        return prev.map((page) => ({
          ...page,
          results: page.results.map((n) =>
            n.id === id ? { ...n, unread: false } : n,
          ),
          unread_count: Math.max(0, page.unread_count - 1),
        }));
      }, false);
    },
    [notificationsMutation],
  );

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (
      el &&
      el.scrollTop + el.clientHeight >= el.scrollHeight - 40 &&
      hasMore &&
      !notificationsValidating
    ) {
      loadMore();
    }
  };

  const onDeleted = useCallback(
    (id) => {
      notificationsMutation();
    },
    [notificationsMutation],
  );

  const handleSelect = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.length === filteredNotifications.length) {
      setSelected([]);
    } else {
      setSelected(filteredNotifications.map((n) => n.id));
    }
  }, [selected, filteredNotifications]);

  const handleBulkDelete = useCallback(async () => {
    try {
      await axiosInstance.post(endpoints.notification.bulkDelete, {
        ids: selected,
      });
      enqueueSnackbar(`${selected.length} мэдэгдэл устгагдлаа`, {
        variant: "success",
      });
      setSelected([]);
      notificationsMutation();
    } catch (error) {
      enqueueSnackbar("Устгах үед алдаа гарлаа", { variant: "error" });
    }
  }, [selected, notificationsMutation]);

  const handleBulkRead = useCallback(async () => {
    try {
      await axiosInstance.post(endpoints.notification.bulkRead, {
        ids: selected,
      });
      enqueueSnackbar(`${selected.length} мэдэгдэл уншсан болголоо`, {
        variant: "success",
      });
      setSelected([]);
      notificationsMutation();
    } catch (error) {
      enqueueSnackbar("Алдаа гарлаа", { variant: "error" });
    }
  }, [selected, notificationsMutation]);

  const isAllSelected =
    filteredNotifications.length > 0 &&
    selected.length === filteredNotifications.length;
  const isIndeterminate =
    selected.length > 0 && selected.length < filteredNotifications.length;

  return (
    <>
      <IconButton
        component={m.button}
        whileTap="tap"
        whileHover="hover"
        variants={varHover(1.05)}
        color={drawer.value ? "primary" : "default"}
        onClick={drawer.onTrue}
      >
        <Badge badgeContent={notificationsUnReadCount} color="error">
          <Iconify icon="mingcute:notification-fill" width={24} />
        </Badge>
      </IconButton>

      <Drawer
        open={drawer.value}
        onClose={drawer.onFalse}
        anchor="right"
        slotProps={{ backdrop: { invisible: true } }}
        PaperProps={{ sx: { width: 1, maxWidth: 420 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{ py: 2, pl: 2, pr: 1, minHeight: 68 }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Мэдэгдэл
          </Typography>

          {selected.length > 0 && (
            <>
              <Tooltip title="Уншсан болгох">
                <IconButton color="info" onClick={handleBulkRead}>
                  <Iconify icon="solar:check-read-bold" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Устгах">
                <IconButton color="error" onClick={handleBulkDelete}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Tooltip>
            </>
          )}

          <IconButton onClick={drawer.onFalse}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>

        <Divider />

        <Stack direction="row" alignItems="center" sx={{ px: 1 }}>
          <Tooltip title={isAllSelected ? "Бүгдийг Буцах" : "Бүгдийг сонгох"}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={handleSelectAll}
            />
          </Tooltip>

          {selected.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              {selected.length} сонгосон
            </Typography>
          ) : (
            <Tabs
              value={currentTab}
              onChange={handleChangeTab}
              sx={{ flexGrow: 1 }}
            >
              {STATUS_TABS.map((tab) => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={tab.name}
                  iconPosition="end"
                  icon={
                    <Label
                      variant={tab.id === currentTab ? "filled" : "soft"}
                      color={tab.color}
                    >
                      {tab.count}
                    </Label>
                  }
                  sx={{ "&:not(:last-of-type)": { mr: 3 } }}
                />
              ))}
            </Tabs>
          )}
        </Stack>

        <Divider />

        <Box
          ref={scrollContainerRef}
          onScroll={handleScroll}
          sx={{ overflowY: "auto", px: 0, pt: 0 }}
        >
          <List disablePadding>
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                selected={selected.includes(notification.id)}
                onSelect={() => handleSelect(notification.id)}
                onClick={() => {
                  setSelectedNotification(notification);
                  setDialogOpen(true);
                }}
                onDeleted={onDeleted}
              />
            ))}
          </List>

          {notificationsValidating && (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Box>
      </Drawer>

      <NotificationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        notification={selectedNotification}
        onMarkAsRead={onMarkAsRead}
      />
    </>
  );
}
