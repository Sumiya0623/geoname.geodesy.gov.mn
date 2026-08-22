"use client";

import PropTypes from "prop-types";

import {
  Box,
  Link,
  Chip,
  Divider,
  Tooltip,
  MenuItem,
  Collapse,
  TableRow,
  TableCell,
  IconButton,
} from "@mui/material";

import { fDate } from "src/utils/format-time";
import { HOST_API } from "src/config-global";

import Iconify from "src/components/iconify";
import CustomPopover, { usePopover } from "src/components/custom-popover";

import LegalNewEditForm from "src/sections/council/legal/legal-new-edit-form";

import AttachNamePanel from "./attach-name-panel";

// ----------------------------------------------------------------------
// Баримт бичгийн мөр — үйлдлүүд нь 3 цэгийн ЦЭС дотор:
//   • Нэр холбох      → мөрийн доор AttachNamePanel задарна
//   • Засах           → мөрийн доор LegalNewEditForm задарна
//   • Төслөөс хасах   → эцэг дээрх баталгаажуулах диалог
// «Холбоотой нэр» багана нь ЗӨВХӨН тухайн төслийн тодруулалтад (ReCount)
// хамаарах нэрсийн тоо (project_names_count); сангийн нийт нь tooltip дээр.
// ----------------------------------------------------------------------

export default function AttachTableRow({
  row,
  index,
  page,
  rowsPerPage,
  colSpan,
  projectId,
  menuPermissions,
  open = false,
  editing = false,
  onToggleAttach,
  onToggleEdit,
  onDetach,
  onChanged,
}) {
  const popover = usePopover();

  const url = row.document
    ? row.document.startsWith("http")
      ? row.document
      : `${HOST_API}${row.document}`
    : null;

  return (
    <>
      <TableRow
        hover
        selected={open || editing}
        sx={{ cursor: "pointer" }}
        onClick={onToggleAttach}
      >
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{row.name}</TableCell>
        <TableCell>{row.type?.name || "-"}</TableCell>
        {/* Байгууллага (LEGAL_ORGS) — аймаг/сум түвшний шийдвэрт */}
        <TableCell>{row.org?.name || "-"}</TableCell>
        <TableCell>{row.order_number || "-"}</TableCell>
        <TableCell>
          {row.order_date ? fDate(row.order_date, "yyyy-MM-dd") : "-"}
        </TableCell>
        <TableCell align="center">
          <Tooltip title={`Санд нийт ${row.names_count || 0} нэр холбоотой`}>
            <Chip
              size="small"
              variant={row.project_names_count ? "soft" : "outlined"}
              color={row.project_names_count ? "success" : "default"}
              label={row.project_names_count || 0}
            />
          </Tooltip>
        </TableCell>
        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
          {url ? (
            <Link href={url} target="_blank" rel="noopener" title="Баримт нээх">
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
        <TableCell align="right" sx={{ px: 1 }} onClick={(e) => e.stopPropagation()}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
          >
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      {/* Задардаг хэсэг — нэр холбох ЭСВЭЛ засах форм */}
      <TableRow>
        <TableCell sx={{ py: 0, border: "none" }} colSpan={colSpan}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ my: 1 }}>
              <AttachNamePanel
                projectId={projectId}
                order={row}
                onChanged={onChanged}
              />
            </Box>
          </Collapse>

          <Collapse in={editing} timeout="auto" unmountOnExit>
            <Box sx={{ my: 1 }}>
              <LegalNewEditForm
                currentItem={row}
                onClose={onToggleEdit}
                refetch={() => {
                  onToggleEdit();
                  onChanged?.();
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
        sx={{ width: 180 }}
      >
        <MenuItem
          onClick={() => {
            onToggleAttach();
            popover.onClose();
          }}
        >
          <Iconify
            icon={open ? "eva:chevron-up-fill" : "mdi:link-variant-plus"}
          />
          Нэр холбох
        </MenuItem>

        {!!menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              onToggleEdit();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}

        {!!menuPermissions?.delete && (
          <>
            <Divider sx={{ borderStyle: "dashed" }} />
            <MenuItem
              onClick={() => {
                onDetach();
                popover.onClose();
              }}
              sx={{ color: "error.main" }}
            >
              <Iconify icon="solar:link-broken-minimalistic-bold" />
              Төслөөс хасах
            </MenuItem>
          </>
        )}
      </CustomPopover>
    </>
  );
}

AttachTableRow.propTypes = {
  row: PropTypes.object,
  index: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  colSpan: PropTypes.number,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  menuPermissions: PropTypes.object,
  open: PropTypes.bool,
  editing: PropTypes.bool,
  onToggleAttach: PropTypes.func,
  onToggleEdit: PropTypes.func,
  onDetach: PropTypes.func,
  onChanged: PropTypes.func,
};
