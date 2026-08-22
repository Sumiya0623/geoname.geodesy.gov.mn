import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Stack,
  Button,
  Checkbox,
  Typography,
  ListItemButton,
  Popover,
  IconButton,
} from "@mui/material";

import Label from "src/components/label";
import Iconify from "src/components/iconify";
import axiosInstance from "src/utils/axios";
import { enqueueSnackbar } from "src/components/snackbar";

export default function NotificationItem({ notification, selected, onSelect, onClick, onDeleted }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const ownerDisplayName = notification.actor.full_name;

  const handleOpenPopover = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  const handleDelete = async (event) => {
    event.stopPropagation();
    try {
      await axiosInstance.delete(`/api/core/notification/${notification.id}/`);
      enqueueSnackbar("Мэдэгдэл устгагдлаа", { variant: "success" });
      onDeleted?.(notification.id);
      handleClosePopover();
    } catch (error) {
      enqueueSnackbar("Устгах үед алдаа гарлаа", { variant: "error" });
    }
  };

  const handleCheckbox = (event) => {
    event.stopPropagation();
    onSelect?.();
  };

  return (
    <>
      <ListItemButton
        disableRipple
        onClick={onClick}
        sx={{
          px: 1,
          py: 1.5,
          alignItems: "flex-start",
          borderBottom: (theme) => `dashed 1px ${theme.palette.divider}`,
        }}
      >
        <Checkbox
          checked={!!selected}
          onClick={handleCheckbox}
          sx={{ mt: 0.25, mr: 1 }}
        />

        <Stack sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Label
              variant="soft"
              color={notification.level}
              sx={{
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {notification.verb}
            </Label>
            <Typography variant="caption" color="text.disabled" noWrap sx={{ flexShrink: 0 }}>
              {notification.timestamp}
            </Typography>
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 0.5 }} noWrap>
            {ownerDisplayName} ({notification.actor.email})
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {notification.description}
          </Typography>
        </Stack>

        {notification.unread && (
          <Box
            sx={{
              width: 8,
              height: 8,
              mt: 1,
              ml: 1,
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: "info.main",
            }}
          />
        )}

        <IconButton
          color={open ? "inherit" : "default"}
          onClick={handleOpenPopover}
          sx={{ ml: 0.5, mt: -0.25 }}
        >
          <Iconify icon="eva:trash-2-outline" width={18} />
        </IconButton>
      </ListItemButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { p: 1, width: 160 } }}
      >
        <Button
          fullWidth
          color="error"
          variant="outlined"
          startIcon={<Iconify icon="eva:trash-2-outline" />}
          onClick={handleDelete}
        >
          Устгах
        </Button>
      </Popover>
    </>
  );
}

NotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  selected: PropTypes.bool,
  onSelect: PropTypes.func,
  onClick: PropTypes.func,
  onDeleted: PropTypes.func,
};
