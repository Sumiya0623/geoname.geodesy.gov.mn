import PropTypes from "prop-types";
import { useState } from "react";
import TableRow from "@mui/material/TableRow";
import { Stack, Button, Tooltip, Typography, IconButton } from "@mui/material";
import TableCell from "@mui/material/TableCell";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import ProfileAvatar from "src/components/profile-avatar";
// ----------------------------------------------------------------------

export default function ChampaignTableRow({
  row,
  rowQueue,
  menuPermissions,
  onDelete,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const { name, signed_date, id, dugaar, org } = row;

  const [openConfirm, setOpenConfirm] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell
          onClick={
            menuPermissions?.detail
              ? () => window.open(`/dashboard/champaign/${id}/`, "_blank")
              : undefined
          }
          sx={{
            cursor: menuPermissions?.detail ? "pointer" : "default",
            color: menuPermissions?.detail ? "primary.main" : "text.primary",
            textDecoration: menuPermissions?.detail ? "underline" : "none",
            maxWidth: 600,
            textTransform: "uppercase",
            "&:hover": menuPermissions?.detail
              ? { textDecoration: "underline" }
              : {},
          }}
        >
          <Tooltip title={name && name.length > 100 ? name : ""}>
            <Typography
              component="a"
              sx={{ textDecoration: "none", color: "inherit" }}
              id={`champaign-detail-${index}`}
            >
              {name && name.length > 100
                ? name.slice(0, 100) + "..."
                : name || "-"}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell>{dugaar || "-"}</TableCell>
        <TableCell>{signed_date || "-"}</TableCell>

        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ProfileAvatar user={org} size="small" />
            <Typography variant="body2">{org?.full_name}</Typography>
          </Stack>
        </TableCell>

        <TableCell align="right">
          {menuPermissions?.delete && (
            <Tooltip title="Устгах">
              <IconButton
                color="error"
                size="small"
                onClick={() => setOpenConfirm(true)}
              >
                <Iconify icon="eva:trash-2-fill" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      <ConfirmDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Устгах"
        content="Та энэ гэрээт ажлыг устгахдаа итгэлтэй байна уу?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onDelete?.(id);
              setOpenConfirm(false);
            }}
          >
            Устгах
          </Button>
        }
      />
    </>
  );
}

ChampaignTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  onDelete: PropTypes.func,
};
