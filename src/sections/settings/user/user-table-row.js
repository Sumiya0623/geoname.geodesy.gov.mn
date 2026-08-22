import PropTypes from "prop-types";
import {
  Box,
  IconButton,
  TableCell,
  MenuItem,
  TableRow,
  Button,
  Divider,
  Collapse,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import UserNewEditForm from "./user-new-edit-form";
import ProfileAvatar from "src/components/profile-avatar";

// ----------------------------------------------------------------------

export default function UserTableRow({
  rowQueue,
  refetch,
  tableHeadLength,
  row,
  onDeleteRow,
  menuPermissions,
  units,
  roles,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { id, photo, full_name, org, role, email, is_citizen, phone } = row;
  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={1} alignItems="center">
            <ProfileAvatar user={row} size={28} />
            <Typography variant="body2">{row?.full_name || "-"}</Typography>
          </Stack>
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {is_citizen ? (
            org?.full_name ? (
              org.full_name
            ) : (
              <Chip label="ХУР баталгаажаагүй" color="warning" />
            )
          ) : (
            <Chip label="Байгууллага" color="info" />
          )}
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{phone}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{email}</TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          {(menuPermissions?.delete || menuPermissions?.update) && (
            <IconButton
              color={popover.open ? "inherit" : "default"}
              onClick={popover.onOpen}
              id={`user-edit-${index}`}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={tableHeadLength} sx={{ p: 0 }}>
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2, py: 2 }}>
              <UserNewEditForm
                currentUser={row}
                roles={roles}
                units={units}
                onCloseForm={form.onFalse}
                refetch={refetch}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        {menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              form.onToggle();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}
        <Divider sx={{ borderStyle: "dashed" }} />
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

      {menuPermissions?.delete && (
        <ConfirmDialog
          open={confirm.value}
          onClose={confirm.onFalse}
          title="Устгах"
          content={
            <>
              Та <strong>{name}</strong> хэрэглэгчийг устгахдаа итгэлтэй байна
              уу?
            </>
          }
          action={
            <Button variant="contained" color="error" onClick={onDeleteRow}>
              Устгах
            </Button>
          }
        />
      )}
    </>
  );
}

UserTableRow.propTypes = {
  onDeleteRow: PropTypes.func,
  onEditRow: PropTypes.func,
  onSelectRow: PropTypes.func,
  row: PropTypes.object,
  selected: PropTypes.bool,
  roles: PropTypes.array,
  tableHeadLength: PropTypes.number,
  units: PropTypes.array,
};
