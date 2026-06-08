import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import {
  Box,
  Button,
  Collapse,
  Divider,
  Tooltip,
  Typography,
} from "@mui/material";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";

import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { useTheme } from "@emotion/react";
import SubUnitListView from "./view/sub-unit-list-view";
import SubUnitNewEditForm from "./sub-unit-new-edit-form";

// ----------------------------------------------------------------------

export default function SubUnitTableRow({
  row,
  refetch,
  rowQueue,
  onViewRow,
  onDeleteRow,
  tableHeadLength,
  childunits,
}) {
  const theme = useTheme();
  const { page, rowsPerPage, index } = rowQueue;
  const { id, unit, subcount } = row;
  const confirm = useBoolean();
  const popover = usePopover();
  const collapse = useBoolean();
  const form = useBoolean();

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>
          <Box display="flex" alignItems="center" sx={{ mt: 0 }}>
            <Typography variant="body2" fontWeight="bold" noWrap>
              {unit}
            </Typography>
            {subcount > 0 && (
              <Tooltip
                arrow
                title={
                  <Typography variant="overline">
                    {collapse.value ? "хаах" : "харах"}
                  </Typography>
                }
              >
                <IconButton onClick={() => collapse.onToggle()} sx={{ p: 0.5 }}>
                  <Iconify
                    width={16}
                    icon="eva:arrow-ios-downward-fill"
                    sx={{
                      transition: theme.transitions.create("all"),
                      ...(collapse.value && {
                        transform: "rotate(-180deg)",
                      }),
                    }}
                  />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
        <TableCell>{subcount || "-"}</TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>
      {collapse.value && (
        <TableRow>
          <TableCell colSpan={tableHeadLength} sx={{ p: 0 }}>
            <Collapse in={collapse.value} unmountOnExit>
              <SubUnitListView currentUnit={row} />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <SubUnitNewEditForm
                currentUnit={row}
                onCloseForm={form.onFalse}
                refetch={refetch}
                childunits={childunits}
              />
            </Box>
          </Collapse>
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
            onViewRow();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:eye-bold" />
          Дэлгэрэнгүй
        </MenuItem>
        {/* )} */}

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
    </>
  );
}

SubUnitTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  onViewRow: PropTypes.func,
  onEditRow: PropTypes.func,
  onDeleteRow: PropTypes.func,
  refetch: PropTypes.func,
  menuPermissions: PropTypes.object,
  tableHeadLength: PropTypes.number,
  childunits: PropTypes.array,
};
