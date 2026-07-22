import PropTypes from "prop-types";

import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import { Stack, Button, Divider, Tooltip, Typography } from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
// ----------------------------------------------------------------------

export default function ChampaignTableRow({
  row,
  rowQueue,
  menuPermissions,
  onDelete,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { name, signed_date, id, dugaar, org } = row;

  const confirm = useBoolean();
  const popover = usePopover();

  const hasMenu = menuPermissions?.detail || menuPermissions?.delete;

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell
          onClick={
            menuPermissions?.detail
              ? () => window.open(`/dashboard/champaign/${id}/`, "_blank")
              : undefined
          }
          sx={{
            cursor: menuPermissions?.detail ? "pointer" : "default",
            color: menuPermissions?.detail ? "primary.main" : "text.primary",
            textDecoration: menuPermissions?.detail ? "underline" : "none",
            maxWidth: 600,
            textTransform: "uppercase",
            "&:hover": menuPermissions?.detail
              ? { textDecoration: "underline" }
              : {},
          }}
        >
          <Tooltip title={name && name.length > 100 ? name : ""}>
            <Typography
              component="a"
              sx={{ textDecoration: "none", color: "inherit" }}
              id={`champaign-detail-${index}`}
            >
              {name && name.length > 100
                ? name.slice(0, 100) + "..."
                : name || "-"}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell>{dugaar || "-"}</TableCell>
        <TableCell>{signed_date || "-"}</TableCell>

        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ProfileAvatar user={org} size="small" />
            <Typography variant="body2">{org?.full_name}</Typography>
          </Stack>
        </TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          {hasMenu && (
            <IconButton
              color={popover.open ? "inherit" : "default"}
              onClick={popover.onOpen}
              id={`champaign-action-${index}`}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        {menuPermissions?.detail && (
          <MenuItem
            onClick={() => {
              window.open(`/dashboard/champaign/${id}/`, "_blank");
              popover.onClose();
            }}
          >
            <Iconify icon="solar:eye-bold" />
            Дэлгэрэнгүй
          </MenuItem>
        )}

        {menuPermissions?.detail && menuPermissions?.delete && (
          <Divider sx={{ borderStyle: "dashed" }} />
        )}

        {menuPermissions?.delete && (
          <MenuItem
            onClick={() => {
              confirm.onTrue();
              popover.onClose();
            }}
            sx={{ color: "error.main" }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Устгах
          </MenuItem>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content="Та энэ гэрээт ажлыг устгахдаа итгэлтэй байна уу?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onDelete?.(id);
              confirm.onFalse();
            }}
          >
            Устгах
          </Button>
        }
      />
    </>
  );
}

ChampaignTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  onDelete: PropTypes.func,
};
