import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import { Link, Chip, Button, Tooltip, Divider } from "@mui/material";

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
  const { id, name, number, type, is_approved, created_date, needs_review, confidence, source, units } = row;

  const aimag = units?.find((u) => u.level && u.level.includes("Аймаг"));
  const sum = units?.find((u) => u.level && u.level.includes("Сум"));
  // Аймаг/сум илрээгүй бол үлдсэн нэгжийг сум баганад нөөцлөн харуулна
  const otherUnits = units?.filter((u) => u !== aimag && u !== sum) || [];

  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell sx={{ whiteSpace: "normal", maxWidth: 280 }}>
          {name ? (
            <Link
              href={`/dashboard/geoname/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer" }}
            >
              {name}
            </Link>
          ) : (
            "-"
          )}
        </TableCell>
        <TableCell>{number || "-"}</TableCell>
        <TableCell>{type?.name || "-"}</TableCell>
        <TableCell>{aimag?.name || "-"}</TableCell>
        <TableCell sx={{ whiteSpace: "normal", maxWidth: 160 }}>
          {sum?.name || otherUnits.map((u) => u.name).join(", ") || "-"}
        </TableCell>
        <TableCell align="center">
          {confidence != null ? `${Math.round(confidence * 100)}%` : "-"}
        </TableCell>
        <TableCell>
          {needs_review == null ? (
            "-"
          ) : (
            <Tooltip
              title={source ? `Эх: ${source.volume} х.${source.page}` : ""}
              arrow
            >
              <Chip
                size="small"
                variant="soft"
                color={needs_review ? "warning" : "success"}
                label={needs_review ? "Хянах шаардлагатай" : "Шалгасан"}
              />
            </Tooltip>
          )}
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
