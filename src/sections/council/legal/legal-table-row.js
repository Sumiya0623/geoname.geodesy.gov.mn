import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import { Box, Link, Button, Divider, Collapse } from "@mui/material";

import { fDate } from "src/utils/format-time";
import { HOST_API } from "src/config-global";
import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import LegalNewEditForm from "./legal-new-edit-form";

// ----------------------------------------------------------------------

export default function LegalTableRow({
  row,
  index,
  page,
  rowsPerPage,
  colSpan = 8,
  menuPermissions,
  refetch,
  onDeleteRow,
  // Төслийн горим — устгахгүй, ЗӨВХӨН тухайн төслөөс салгана
  detachMode = false,
}) {
  const { name, unit, org, order_number, order_date, signer, document } = row;

  const edit = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();

  const docUrl = document
    ? document.startsWith("http")
      ? document
      : `${HOST_API}${document}`
    : null;

  return (
    <>
      <TableRow hover selected={edit.value}>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{name}</TableCell>
        <TableCell>{unit?.unit || "-"}</TableCell>
        {/* Байгууллага — аймаг/сум түвшний шийдвэрт (LEGAL_ORGS) */}
        <TableCell>{org?.name || "-"}</TableCell>
        <TableCell>
          {order_date ? fDate(order_date, "yyyy-MM-dd") : "-"}
        </TableCell>
        <TableCell>{order_number || "-"}</TableCell>
        <TableCell align="center">
          {docUrl ? (
            <Link
              href={docUrl}
              target="_blank"
              rel="noopener"
              title="Баримт нээх"
            >
              <Iconify
                icon="vscode-icons:file-type-pdf2"
                width={22}
                sx={{ verticalAlign: "middle" }}
              />
            </Link>
          ) : (
            "-"
          )}
        </TableCell>
        <TableCell align="right" sx={{ px: 1 }}>
          {(menuPermissions?.update || menuPermissions?.delete) && (
            <IconButton
              color={popover.open ? "inherit" : "default"}
              onClick={popover.onOpen}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {/* Засах форм — тухайн мөрний доор нээгдэнэ */}
      <TableRow>
        <TableCell sx={{ p: 0, border: "none" }} colSpan={colSpan}>
          <Collapse in={edit.value} timeout="auto" unmountOnExit>
            <Box sx={{ p: 1.5 }}>
              <LegalNewEditForm
                currentItem={row}
                onClose={edit.onFalse}
                refetch={() => {
                  edit.onFalse();
                  refetch && refetch();
                }}
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
        {menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              edit.onToggle();
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
              <Iconify
                icon={
                  detachMode
                    ? "solar:link-broken-minimalistic-bold"
                    : "solar:trash-bin-trash-bold"
                }
              />
              {detachMode ? "Хасах" : "Устгах"}
            </MenuItem>
          </>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title={detachMode ? "Төслөөс хасах" : "Устгах"}
        content={
          detachMode ? (
            <>
              <strong>{name}</strong> тогтоолыг энэ төслөөс хасах уу? Тогтоол нь{" "}
              <strong>санд хэвээр үлдэнэ</strong> — устахгүй.
            </>
          ) : (
            <>
              <strong>{name}</strong> тогтоолыг устгахдаа итгэлтэй байна уу?
            </>
          )
        }
        action={
          <Button
            variant="contained"
            color={detachMode ? "warning" : "error"}
            onClick={onDeleteRow}
          >
            {detachMode ? "Хасах" : "Устгах"}
          </Button>
        }
      />
    </>
  );
}

LegalTableRow.propTypes = {
  row: PropTypes.object,
  index: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  colSpan: PropTypes.number,
  menuPermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
  detachMode: PropTypes.bool,
};
