import PropTypes from "prop-types";
import TableRow from "@mui/material/TableRow";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import TableCell from "@mui/material/TableCell";
import { useSnackbar } from "notistack";
import { useState } from "react";
import { LoadingButton } from "@mui/lab";
import axiosInstance, { endpoints } from "src/utils/axios";
import ActNewEditForm from "./act-new-edit-form";
import { useBoolean } from "src/hooks/use-boolean";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import { RouterLink } from "src/routes/components";
import { paths } from "src/routes/paths";
import Label from "src/components/label";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import ProfileAvatar from "src/components/profile-avatar";
import PointDetailsDialog from "src/sections/point/PointDetailsDialog";

export default function ActTableRow({
  row,
  rowQueue,
  refetch,
  projectId,
  onDeleteRow,
  tableHeadLength,
  user,
  menuPermissions,
}) {
  const form = useBoolean();
  const confirm = useBoolean();
  const declineDialog = useBoolean();
  const popover = usePopover();
  const statusPopover = usePopover();
  const { enqueueSnackbar } = useSnackbar();
  const {
    id,
    officer,
    engineer,
    act,
    measurement,
    is_accepted,
    accepted_date,
    created_date,
    desc: description,
  } = row;
  const [loading, setLoading] = useState({
    accept: false,
    decline: false,
    download: false,
  });

  const [desc, setDesc] = useState("");
  const [pointDialogOpen, setPointDialogOpen] = useState(false);

  const decide = async (ok) => {
    setLoading((s) => ({ ...s, [ok ? "accept" : "decline"]: true }));
    const URL = ok ? endpoints.act.accept(id) : endpoints.act.decline(id);

    try {
      await axiosInstance.post(URL, !ok && { desc: desc });
      enqueueSnackbar(
        `${measurement?.point?.number} дугаартай цэгийн актыг ${ok ? "зөвшөөрлөө" : "татгалзлаа"}`
      );
      setDesc("");
      declineDialog.onFalse();
    } catch (error) {
      enqueueSnackbar(error?.message || "Алдаа гарлаа", {
        variant: "error",
      });
    } finally {
      refetch();
      setLoading((s) => ({ ...s, [ok ? "accept" : "decline"]: false }));
    }
  };

  const { page, rowsPerPage, index } = rowQueue;
  const projectTo = paths.dashboard.champaign.details(measurement?.project?.id);
  const linkTo = measurement?.point?.id
    ? `/dashboard/ready/${measurement?.point.id}`
    : "#";
  const statusName = measurement?.point?.status?.name;
  const isPointDeleted =
    statusName && statusName.toLowerCase().includes("уст");

  return (
    <>
      <TableRow hover sx={{ "& td": { py: 1 } }}>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {page * rowsPerPage + index + 1}
          </Typography>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              alt={measurement?.point?.name}
              src={`${process.env.NEXT_PUBLIC_HOST_API}${measurement?.point?.thumb}`}
              sx={{
                borderRadius: 1,
                height: 48,
                width: 48,
                flexShrink: 0,
                objectFit: "cover",
                bgcolor: "background.neutral",
              }}
            />
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Link
                component={RouterLink}
                href={linkTo}
                color="primary"
                variant="subtitle2"
                underline="hover"
                noWrap
              >
                {measurement?.point?.name || "-"}
              </Link>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                >
                  № {measurement?.point?.number || "-"}
                </Typography>
                {statusName && (
                  <Chip
                    label={statusName}
                    size="small"
                    variant="soft"
                    color={isPointDeleted ? "error" : "success"}
                    sx={{ height: 18, borderRadius: 0.5, fontSize: 10, fontWeight: 600 }}
                  />
                )}
              </Stack>
            </Stack>
          </Stack>
        </TableCell>

        <TableCell>
          {measurement?.network?.name ? (
            <Chip
              label={measurement.network.name}
              size="small"
              variant="soft"
              color="info"
              sx={{ borderRadius: 0.75, fontWeight: 600 }}
            />
          ) : (
            <Typography variant="body2" color="text.disabled">-</Typography>
          )}
        </TableCell>

        <TableCell>
          <Tooltip title={measurement?.project?.name || ""}>
            <Link
              component={RouterLink}
              href={projectTo}
              color="primary"
              variant="subtitle2"
              underline="hover"
              noWrap
            >
              {(measurement?.project?.name || "-")?.length > 50
                ? `${measurement.project.name.slice(0, 30)}…`
                : measurement?.project?.name || "-"}
            </Link>
          </Tooltip>
        </TableCell>

        <TableCell>
          <Tooltip title={engineer?.full_name || "-"} arrow>
            <Box sx={{ display: "inline-flex" }}>
              <ProfileAvatar user={engineer} size={32} />
            </Box>
          </Tooltip>
        </TableCell>

        <TableCell id={`act-download-${index}`}>
          {is_accepted === true ? (
            <LoadingButton
              loading={loading.download}
              onClick={async () => {
                try {
                  setLoading((s) => ({ ...s, download: true }));
                  const res = await axiosInstance.post(
                    endpoints.act.download(id)
                  );
                  const fileUrl = res?.data?.file_url;
                  if (fileUrl) {
                    window.open(fileUrl, "_blank", "noopener,noreferrer");
                  }
                } catch (error) {
                  enqueueSnackbar(
                    error?.response?.data?.results ||
                      "Акт татах үед алдаа гарлаа",
                    { variant: "error" }
                  );
                } finally {
                  setLoading((s) => ({ ...s, download: false }));
                }
              }}
              variant="soft"
              color="primary"
              size="small"
              startIcon={<Iconify icon="mdi:download" width={16} />}
              sx={{ borderRadius: 1, textTransform: "none", fontWeight: 600 }}
            >
              Татах
            </LoadingButton>
          ) : is_accepted === false ? (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          ) : (
            <Label variant="soft" color={act ? "success" : "secondary"}>
              Хянаж байгаа
            </Label>
          )}
        </TableCell>

        <TableCell sx={{ whiteSpace: "nowrap" }}>
          <Button
            id={`act-status-${index}`}
            variant="soft"
            size="small"
            color={
              is_accepted === true
                ? "success"
                : accepted_date
                  ? "error"
                  : "secondary"
            }
            onClick={statusPopover.onOpen}
            startIcon={
              <Iconify
                icon={
                  is_accepted === true
                    ? "solar:check-circle-bold"
                    : accepted_date
                      ? "solar:close-circle-bold"
                      : "solar:clock-circle-bold-duotone"
                }
                width={16}
              />
            }
            sx={{
              borderRadius: 1,
              textTransform: "none",
              px: 1.25,
              fontWeight: 600,
            }}
          >
            {is_accepted === true
              ? "Баталсан"
              : accepted_date
                ? "Татгалзсан"
                : "Хянаж байна"}
          </Button>
        </TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          <IconButton
            color={popover.open ? "inherit" : "default"}
            onClick={popover.onOpen}
            id={`act-delete-${index}`}
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
              <ActNewEditForm
                currentItem={row}
                projectId={projectId}
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
      <CustomPopover
        open={statusPopover.open}
        onClose={statusPopover.onClose}
        arrow="top-center"
        sx={{ width: 300, p: 2 }}
      >
        {is_accepted === true ? (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Баталгаажуулалт
            </Typography>
            <Stack spacing={1}>
              {officer && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProfileAvatar user={officer} size={28} />
                  <Typography variant="body2" color="text.secondary">
                    Мэргэжилтэн: {officer?.full_name || "-"}
                  </Typography>
                </Stack>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Огноо:</strong>{" "}
                {accepted_date
                  ? accepted_date.split("T")[0]
                  : created_date?.split("T")[0]}
              </Typography>
              {description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Тайлбар:</strong> {description}
                </Typography>
              )}
            </Stack>
          </Box>
        ) : accepted_date ? (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Татгалзсан
            </Typography>
            <Stack spacing={1}>
              {officer && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProfileAvatar user={officer} size={28} />
                  <Typography variant="body2" color="text.secondary">
                    Мэргэжилтэн: {officer?.full_name || "-"}
                  </Typography>
                </Stack>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Огноо:</strong>{" "}
                {accepted_date
                  ? accepted_date.split("T")[0]
                  : created_date?.split("T")[0]}
              </Typography>
              {description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Шалтгаан:</strong> {description}
                </Typography>
              )}
            </Stack>
          </Box>
        ) : (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Хянаж байна
            </Typography>
            <Stack spacing={1}>
              {officer && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProfileAvatar user={officer} size={28} />
                  <Typography variant="body2" color="text.secondary">
                    Мэргэжилтэн: {officer?.full_name || "-"}
                  </Typography>
                </Stack>
              )}
              <Typography variant="body2" color="text.secondary">
                <strong>Үүсгэсэн огноо:</strong>{" "}
                {created_date?.split("T")[0] || "-"}
              </Typography>
              {description && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Тайлбар:</strong> {description}
                </Typography>
              )}
              {user?.id === officer?.id && (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ mt: 1 }}
                >
                  <LoadingButton
                    size="small"
                    variant="contained"
                    color="success"
                    loading={loading.accept}
                    onClick={() => {
                      statusPopover.onClose();
                      decide(true);
                    }}
                  >
                    Зөвшөөрөх
                  </LoadingButton>

                  <LoadingButton
                    size="small"
                    variant="outlined"
                    color="error"
                    loading={loading.decline}
                    onClick={() => {
                      statusPopover.onClose();
                      declineDialog.onTrue();
                    }}
                  >
                    Татгалзах
                  </LoadingButton>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </CustomPopover>
      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{row.id}</strong> актыг устгахдаа итгэлтэй байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />
      <Dialog
        open={declineDialog.value}
        onClose={declineDialog.onFalse}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Татгалзах шалтгаан</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Татгалзах шалтгаан оруулна уу"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={declineDialog.onFalse}>Буцах</Button>
          <LoadingButton
            variant="contained"
            color="error"
            loading={loading.decline}
            onClick={() => decide(false)}
          >
            Татгалзах
          </LoadingButton>
        </DialogActions>
      </Dialog>
      <PointDetailsDialog
        open={pointDialogOpen}
        onClose={() => setPointDialogOpen(false)}
        point={measurement?.point}
      />
    </>
  );
}

ActTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  refetch: PropTypes.func,
  tableHeadLength: PropTypes.number,
  projectId: PropTypes.number,
  onDeleteRow: PropTypes.func,
  menuPermissions: PropTypes.object,
};
