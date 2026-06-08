import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import { Chip, Button, Divider } from "@mui/material";

import { fDate } from "src/utils/format-time";
import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// ----------------------------------------------------------------------

export default function GeonameTableRow({
  row,
  index,
  page,
  rowsPerPage,
  menuPermissions,
  onEdit,
  onDeleteRow,
}) {
  const { name, number, type, status, is_approved, created_date } = row;

  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell sx={{ whiteSpace: "normal", maxWidth: 280 }}>{name || "-"}</TableCell>
        <TableCell>{number || "-"}</TableCell>
        <TableCell>{type?.name || "-"}</TableCell>
        <TableCell>
          {status?.name ? <Chip size="small" variant="soft" label={status.name} /> : "-"}
        </TableCell>
        <TableCell align="center">
          <Chip
            size="small"
            variant="soft"
            color={is_approved ? "success" : "warning"}
            label={is_approved ? "Батлагдсан" : "Түр"}
          />
        </TableCell>
        <TableCell>{created_date ? fDate(created_date) : "-"}</TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          {(menuPermissions?.update || menuPermissions?.delete) && (
            <IconButton onClick={popover.onOpen}>
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        {menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              onEdit();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}
        {menuPermissions?.delete && (
          <>
            <Divider sx={{ borderStyle: "dashed" }} />
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
          </>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            <strong>{name}</strong> нэрийг устгахдаа итгэлтэй байна уу?
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

GeonameTableRow.propTypes = {
  row: PropTypes.object,
  index: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  menuPermissions: PropTypes.object,
  onEdit: PropTypes.func,
  onDeleteRow: PropTypes.func,
};
