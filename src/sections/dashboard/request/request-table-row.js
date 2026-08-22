import PropTypes from "prop-types";
import { useState } from "react";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import {
  Box,
  Chip,
  Stack,
  Button,
  Divider,
  Tooltip,
  Collapse,
  Typography,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { fDate } from "src/utils/format-time";
import { useBoolean } from "src/hooks/use-boolean";
import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// ----------------------------------------------------------------------

export default function RequestTableRow({
  row,
  index,
  page,
  rowsPerPage,
  colSpan = 7,
  menuPermissions,
  onEdit,
  onDeleteRow,
}) {
  const {
    name,
    type,
    purpose = [],
    options = [],
    contacts = [],
    description,
    created_date,
  } = row;
  const firstName = name?.name || options?.[0]?.name || "-";

  const open = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const { enqueueSnackbar } = useSnackbar();
  const [downloading, setDownloading] = useState(false);

  // Өргөдлийн А4 маягтыг PDF болгон татах
  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await axiosInstance.get(endpoints.request.form(row.id), {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `өргөдөл_${row.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      enqueueSnackbar("Маягт татахад алдаа гарлаа", { variant: "error" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <TableRow hover>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell sx={{ whiteSpace: "normal", maxWidth: 280 }}>
          {firstName}
          <IconButton onClick={open.onToggle}>
            <Icon
              icon={open.value ? "mdi:chevron-down" : "mdi:chevron-right"}
            />
          </IconButton>
        </TableCell>
        <TableCell>{type?.name || "-"}</TableCell>
        <TableCell align="center">
          <Tooltip title="Өргөдлийн маягт татах (PDF)">
            <span>
              <Button
                variant="soft"
                color="primary"
                onClick={handleDownload}
                disabled={downloading}
                startIcon={
                  <Icon
                    icon={
                      downloading
                        ? "eos-icons:loading"
                        : "solar:file-download-bold"
                    }
                  />
                }
                sx={{ whiteSpace: "nowrap" }}
              >
                Маягт
              </Button>
            </span>
          </Tooltip>
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

      <TableRow>
        <TableCell sx={{ p: 0, border: "none" }} colSpan={colSpan}>
          <Collapse in={open.value} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: "background.neutral" }}>
              {description && (
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <b>Тайлбар:</b> {description}
                </Typography>
              )}
              {purpose.length > 0 && (
                <Stack
                  direction="row"
                  flexWrap="wrap"
                  gap={0.5}
                  sx={{ mb: 1.5 }}
                >
                  {purpose.map((p) => (
                    <Chip
                      key={p.id}
                      variant="outlined"
                      label={p.name}
                    />
                  ))}
                </Stack>
              )}
              {options.map((o, i) => (
                <Box
                  key={o.id || i}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    borderRadius: 1,
                    bgcolor: "background.paper",
                  }}
                >
                  <Typography variant="subtitle2">
                    Санал 1: {o.name || "-"}
                    {o.name2 ? ` · Санал 2: ${o.name2}` : ""}
                  </Typography>
                  {o.desc && (
                    <Typography variant="caption" color="text.secondary">
                      {o.desc}
                    </Typography>
                  )}
                </Box>
              ))}
              {(contacts || []).length > 0 && (
                <Stack sx={{ mt: 0.5 }} spacing={0.25}>
                  {contacts.map((c, ci) => (
                    <Typography
                      key={c.id || ci}
                      variant="caption"
                      color="text.secondary"
                    >
                      • {c.full_name || "-"} {c.phone ? `(${c.phone})` : ""}{" "}
                      {c.register ? `· ${c.register}` : ""}
                    </Typography>
                  ))}
                </Stack>
              )}
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
        content="Энэ хүсэлтийг устгахдаа итгэлтэй байна уу?"
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
    </>
  );
}

RequestTableRow.propTypes = {
  row: PropTypes.object,
  index: PropTypes.number,
  page: PropTypes.number,
  rowsPerPage: PropTypes.number,
  colSpan: PropTypes.number,
  menuPermissions: PropTypes.object,
  onEdit: PropTypes.func,
  onDeleteRow: PropTypes.func,
};
