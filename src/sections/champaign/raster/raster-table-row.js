import PropTypes from "prop-types";

import {
  Chip,
  Button,
  Divider,
  Tooltip,
  TableRow,
  MenuItem,
  TableCell,
  Typography,
  IconButton,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// ----------------------------------------------------------------------

export default function RasterTableRow({ row, order, onDelete }) {
  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>{order}</TableCell>
        <TableCell>{row.year || "—"}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {row.title || row.units_text || "—"}
          </Typography>
        </TableCell>
        <TableCell align="center">{row.name_count}</TableCell>
        <TableCell align="center">
          {row.is_border ? (
            <Chip color="warning" label="Тийм" />
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          {row.scale ? `1 : ${Number(row.scale).toLocaleString()}` : "—"}
        </TableCell>
        <TableCell>{row.user_name || "—"}</TableCell>
        <TableCell align="center">
          {row.file_url ? (
            <Tooltip title="PDF татах">
              <IconButton
                color="error"
                component="a"
                href={row.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Iconify icon="mdi:file-pdf-box" width={24} />
              </IconButton>
            </Tooltip>
          ) : (
            "—"
          )}
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
        sx={{ width: 200 }}
      >
        {row.file_url && (
          <>
            <MenuItem
              component="a"
              href={row.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={popover.onClose}
            >
              <Iconify icon="mdi:file-pdf-box" />
              PDF татах
            </MenuItem>
            <Divider sx={{ borderStyle: "dashed" }} />
          </>
        )}
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
        content="Та энэ хэвлэлийн эхийг устгахдаа итгэлтэй байна уу?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onDelete?.(row.id);
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

RasterTableRow.propTypes = {
  row: PropTypes.object,
  order: PropTypes.number,
  onDelete: PropTypes.func,
};
