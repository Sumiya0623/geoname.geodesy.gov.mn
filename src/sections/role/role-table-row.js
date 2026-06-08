import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import { Box, Button, Collapse, Divider } from "@mui/material";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { useState } from "react";
import { RoleDetailsView } from "./view";

// ----------------------------------------------------------------------

export default function RoleTableRow({
  row,
  rowQueue,
  onEditRow,
  onDeleteRow,
  tableHeadLength,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { id, name, ...res } = row;
  const confirm = useBoolean();
  const popover = usePopover();
  const [roleId, setRoleId] = useState(null);
  const isRoleOpen = roleId === id;
  const isDisabled = roleId !== null && roleId !== id;
  const handleToggleRole = (id) => {
    setRoleId((prevId) => (prevId === id ? null : id));
  };

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{name}</TableCell>
        <TableCell>
          <span>{res?.actions?.length ?? 0}</span>
          <IconButton
            onClick={() => handleToggleRole(id)}
            disabled={isDisabled}
          >
            <Iconify
              icon="eva:arrow-ios-downward-fill"
              width={24}
              sx={{ transform: isRoleOpen ? "rotate(-180deg)" : "none" }}
            />
          </IconButton>
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

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        <MenuItem
          onClick={() => {
            onEditRow();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Засах
        </MenuItem>

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
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> гэсэн нэртэй эрхийг устгахдаа итгэлтэй
            байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
      <TableRow>
        <TableCell colSpan={tableHeadLength} sx={{ p: 0 }}>
          <Collapse in={isRoleOpen} unmountOnExit>
            <Box sx={{ p: 2 }}>
              <RoleDetailsView id={row.id} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

RoleTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  onEditRow: PropTypes.func,
  onDeleteRow: PropTypes.func,
  tableHeadLength: PropTypes.number,
  menuPermissions: PropTypes.object,
};
