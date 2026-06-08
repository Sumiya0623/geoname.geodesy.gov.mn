import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import {
  Box,
  Button,
  Divider,
  Collapse,
  ListItemText,
  Stack,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import ConstantNewEditForm from "./number-new-edit-form";
import ProfileAvatar from "src/components/profile-avatar";

// ----------------------------------------------------------------------

export default function NumberTableRow({
  row,
  rowQueue,
  menuPermissions,
  refetch,
  onDeleteRow,
  networks,
  units,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { id, number, network, unit, is_used, user } = row;
  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{number}</TableCell>
        <TableCell>{network?.name || "-"}</TableCell>
        <TableCell>{unit?.unit || "-"}</TableCell>
        <TableCell>{is_used ? "Тийм" : "Үгүй"}</TableCell>
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={2}>
            <ProfileAvatar user={user} />
            <ListItemText
              primary={user?.full_name || "-"}
              primaryTypographyProps={{ variant: "body2" }}
            />
          </Stack>
        </TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box
              sx={{
                px: 1,
                py: 2,
                ml: { xs: "auto", md: 0 },
                width: { xs: "50%", md: "auto" },
              }}
            >
              <ConstantNewEditForm
                currentConstant={row}
                networks={networks}
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
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> дугаарыг устгахдаа итгэлтэй байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
    </>
  );
}

NumberTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  networks: PropTypes.array,
  units: PropTypes.array,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
};
