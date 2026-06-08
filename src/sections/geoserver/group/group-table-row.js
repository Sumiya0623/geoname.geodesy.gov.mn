import PropTypes from "prop-types";
import TableRow from "@mui/material/TableRow";
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
} from "@mui/material";
import TableCell from "@mui/material/TableCell";
import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import GroupNewEditForm from "./group-new-edit-form";
import GroupDetailDialog from "./group-detail-dialog";

export default function GroupTableRow({
  row,
  rowQueue,
  onDeleteRow,
  tableHeadLength,
  refetch,
  menuPermissions,
}) {
  const form = useBoolean();
  const confirm = useBoolean();
  const detail = useBoolean();
  const popover = usePopover();
  const { page, rowsPerPage, index } = rowQueue;
  const {
    id,
    name,
    items,
    layerOrder,
  } = row;
  
  const itemsCount = items?.length || 0;
  const featureNames = items?.map(item => item.layer?.table?.name || `Feature ${item.layer}`).join(", ") || "-";

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{name || "-"}</TableCell>
        <TableCell>{itemsCount}</TableCell>
        <TableCell title={featureNames}>
          {featureNames.length > 50 ? `${featureNames.substring(0, 50)}...` : featureNames}
        </TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
            id={`group-update-${index}`}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={tableHeadLength}
        >
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <GroupNewEditForm
                currentGroup={row}
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
        {menuPermissions?.detail && (
          <MenuItem
            onClick={() => {
              detail.onTrue();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:eye-bold" />
            Дэлгэрэнгүй
          </MenuItem>
        )}
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

      <GroupDetailDialog
        open={detail.value}
        onClose={detail.onFalse}
        group={row}
        onEdit={form.onTrue}
        menuPermissions={menuPermissions}
      />

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> layer group-ийг устгахдаа итгэлтэй байна уу?
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

GroupTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  tableHeadLength: PropTypes.number,
};
