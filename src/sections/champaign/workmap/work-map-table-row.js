import PropTypes from "prop-types";

import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import { fDate } from "src/utils/format-time";
import { useBoolean } from "src/hooks/use-boolean";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// ----------------------------------------------------------------------
// Ажлын зургийн нэг мөр — нээх / устгах үйлдэл 3 цэгийн цэсэнд.
// ----------------------------------------------------------------------

export default function WorkMapTableRow({
  row,
  rowQueue,
  menuPermissions,
  onDeleteRow,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { title, units_text: unitsText, name_count: nameCount, scale } = row;

  const confirm = useBoolean();
  const popover = usePopover();

  return (
    <>
      <TableRow hover>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell sx={{ whiteSpace: "normal" }}>{title || "-"}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>{unitsText || "-"}</TableCell>
        <TableCell align="center">{nameCount ?? 0}</TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {scale ? `1 : ${Number(scale).toLocaleString()}` : "-"}
        </TableCell>
        {/* Үүсгэсэн хэрэглэгч — нэгдсэн ProfileAvatar компонентоор */}
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ProfileAvatar user={row.user} size={28} />
            <Typography variant="body2" noWrap>
              {row.user_name || row.user?.full_name || "-"}
            </Typography>
          </Stack>
        </TableCell>

        {/* Огноо — богино хэлбэр */}
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {row.created_date ? fDate(row.created_date, "yyyy.MM.dd") : "-"}
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
        sx={{ width: 170 }}
      >
        <MenuItem
          onClick={() => {
            if (row.file_url)
              window.open(row.file_url, "_blank", "noopener,noreferrer");
            popover.onClose();
          }}
        >
          <Iconify icon="solar:eye-bold" />
          Нээх
        </MenuItem>

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

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={`"${title || "Ажлын зураг"}"‑ыг устгах уу?`}
        action={
          <IconButton
            color="error"
            onClick={() => {
              onDeleteRow();
              confirm.onFalse();
            }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
          </IconButton>
        }
      />
    </>
  );
}

WorkMapTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  onDeleteRow: PropTypes.func,
};
