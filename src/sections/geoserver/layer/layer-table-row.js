import PropTypes from "prop-types";
import TableRow from "@mui/material/TableRow";
import {
  Box,
  Button,
  Chip,
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
import LayerNewEditForm from "./layer-new-edit-form";
import { useState } from "react";
import { RuleListView } from "../rule";

export default function LayerTableRow({
  row,
  rowQueue,
  onDeleteRow,
  menuPermissions,
  tableHeadLength,
  refetch,
  stId,
}) {
  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const { page, rowsPerPage, index } = rowQueue;
  const { id, title: name, table, is_raster, is_published, store } = row;

  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const isMenuOpen = selectedLayerId === id;
  const isDisabled = selectedLayerId !== null && selectedLayerId !== id; // Disable others
  const handleToggleStyle = (id) => {
    setSelectedLayerId((prevId) => (prevId === id ? null : id)); // Toggle logic
  };

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{table?.name || "-"}</TableCell>
        <TableCell>{table?.code}</TableCell>
        <TableCell>
          {is_published ? (
            <Chip label="Идэвхтэй" color="success" size="small" />
          ) : (
            <Chip label="Идэвхигүй" color="default" size="small" />
          )}
        </TableCell>

        <TableCell>
          Ангилал
          <IconButton
            onClick={() => handleToggleStyle(id)}
            disabled={isDisabled}
          >
            <Iconify
              icon="eva:arrow-ios-downward-fill"
              width={24}
              sx={{ transform: isMenuOpen ? "rotate(-180deg)" : "none" }}
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
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={tableHeadLength}
        >
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <LayerNewEditForm
                currentLayer={row}
                onCloseForm={form.onFalse}
                refetch={refetch}
                stId={stId}
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
        <MenuItem
          onClick={() => {
            form.onToggle();
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
            Та <strong>{name}</strong> Давхаргыг устгахдаа итгэлтэй байна уу?
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
          <Collapse in={isMenuOpen} unmountOnExit>
            <Box sx={{ p: 2 }}>
              <RuleListView layerId={selectedLayerId} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

LayerTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  tableHeadLength: PropTypes.number,
  stId: PropTypes.number,
};
