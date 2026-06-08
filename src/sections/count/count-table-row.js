import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import { Box, Button, Divider, Chip, Tooltip } from "@mui/material";
import Stack from "@mui/material/Stack";
import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import { useState } from "react";
import CountNewEditForm from "./count-new-edit-form";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Link,
} from "@mui/material";
import axiosInstance, { endpoints } from "src/utils/axios";
import { enqueueSnackbar } from "notistack";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ProfileAvatar from "src/components/profile-avatar";
import { useAuthContext } from "src/auth/hooks";
import { paths } from "src/routes/paths";
import { RouterLink } from "src/routes/components";
import CountDetailDialog from "../point/details/count/count-detail-dialog";

const PointDetailMap = dynamic(() => import("../point/point-detail-map"), {
  ssr: false,
});

const parsePointCoordinates = (source) => {
  if (!source) return null;

  const geoloc = source.geoloc || source.location?.geoloc;
  let coords;

  if (geoloc) {
    if (typeof geoloc === "string") {
      const trimmed = geoloc.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          coords = parsed?.coordinates;
        } catch (error) {
          console.warn("Failed to parse geoloc JSON", error);
        }
      } else {
        const match = trimmed.match(/POINT\s*\(([-\d.]+)\s+([-\d.]+)\)/i);
        if (match) {
          coords = [parseFloat(match[1]), parseFloat(match[2])];
        }
      }
    } else if (Array.isArray(geoloc)) {
      coords = geoloc;
    } else if (
      typeof geoloc === "object" &&
      Array.isArray(geoloc.coordinates)
    ) {
      coords = geoloc.coordinates;
    }
  }

  if (!coords || coords.length < 2) {
    const lon = Number(
      source?.longitude ??
        source?.lon ??
        source?.location?.longitude ??
        source?.location?.lon,
    );
    const lat = Number(
      source?.latitude ??
        source?.lat ??
        source?.location?.latitude ??
        source?.location?.lat,
    );

    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      coords = [lon, lat];
    }
  }

  if (Array.isArray(coords) && coords.length >= 2) {
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      return [lon, lat];
    }
  }

  return null;
};

// ----------------------------------------------------------------------

export default function CountTableRow({
  row,
  rowQueue,
  menuPermissions,
  decidePermissions,
  refetch,
  onDeleteRow,
  projectId,
  user,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const {
    id,
    point,
    counted_by,
    officer,
    confirmed_by,
    confirmed_date,
    counted_date,
    description,
    status,
  } = row;
  const { user: currentUser } = useAuthContext();

  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const statusInfoPopover = usePopover();
  const [imagesOpen, setImagesOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleFetch = async (bool) => {
    setLoading(true);
    try {
      const response = await axiosInstance.post(
        endpoints.point.count.approve(id),
        {
          is_approve: bool,
        },
      );
      if (response.status === 200) {
        refetch();
        setImagesOpen(false);
      }
    } catch (e) {
      enqueueSnackbar(e?.message || "Алдаа гарлаа", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    await handleFetch(true);
  };

  const handleDecline = async () => {
    await handleFetch(false);
  };

  const photos = [{ src: row?.thumb }];
  const images = row?.photos || photos;

  const slides = Array.isArray(images)
    ? images
        .map((photo) => {
          if (!photo) return null;
          return { src: `${process.env.NEXT_PUBLIC_HOST_API}${photo?.photo}` };
        })
        .filter(Boolean)
    : [];

  const [currentSlide, setCurrentSlide] = useState(0);
  const hasDays = typeof row.days === "number" && Number.isFinite(row.days);
  const isLate = hasDays ? row.days >= 15 : false;
  const pointCoordinates = parsePointCoordinates(point);
  const projectTo = paths.dashboard.champaign.details(row?.project?.id);
  const projectName = row?.project?.name || "-";
  const projectNameShort =
    projectName && projectName.length > 50
      ? `${projectName.slice(0, 30)}…`
      : projectName;
  const isDeleted =
    status?.name && status.name.toLowerCase().includes("уст");

  return (
    <>
      <TableRow hover sx={{ "& td": { py: 1 } }}>
        <TableCell>
          <Typography variant="body2" color="text.secondary">
            {page * rowsPerPage + index + 1}
          </Typography>
        </TableCell>

        <TableCell>
          <Link
            component="button"
            type="button"
            color="primary"
            variant="subtitle2"
            underline="hover"
            noWrap
            onClick={() => {
              setDetailOpen(true);
              popover.onClose();
            }}
            sx={{ display: "block", lineHeight: 1.3, textAlign: "left" }}
          >
            {point?.name}
          </Link>
          {point?.number && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: "block", lineHeight: 1.2 }}
            >
              № {point.number}
            </Typography>
          )}
        </TableCell>

        <TableCell>
          {row?.project ? (
            <Tooltip title={projectName}>
              <Link
                component={RouterLink}
                href={projectTo}
                color="primary"
                variant="subtitle2"
                underline="hover"
                noWrap
              >
                {projectNameShort}
              </Link>
            </Tooltip>
          ) : (
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Iconify
                icon="solar:user-id-bold-duotone"
                width={16}
                sx={{ color: "text.disabled" }}
              />
              <Typography variant="body2" color="text.secondary">
                Орон нутгийн мэргэжилтэн
              </Typography>
            </Stack>
          )}
        </TableCell>

        <TableCell>
          <Tooltip title={counted_by?.full_name || "-"} arrow>
            <Box sx={{ display: "inline-flex" }}>
              <ProfileAvatar user={counted_by} size={32} />
            </Box>
          </Tooltip>
        </TableCell>

        <TableCell>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Iconify
              icon="solar:calendar-minimalistic-bold-duotone"
              width={16}
              sx={{ color: "text.disabled" }}
            />
            <Typography variant="body2">{counted_date || "-"}</Typography>
          </Stack>
        </TableCell>

        <TableCell sx={{ textTransform: "capitalize" }}>
          <Chip
            label={status?.name || "-"}
            size="small"
            color={isDeleted ? "error" : "success"}
            variant="soft"
            sx={{ borderRadius: 1, fontWeight: 600 }}
          />
        </TableCell>

        <TableCell>
          <Button
            variant={confirmed_by ? "soft" : "soft"}
            size="small"
            color={confirmed_by ? "success" : "secondary"}
            onClick={statusInfoPopover.onOpen}
            startIcon={
              <Iconify
                icon={
                  confirmed_by
                    ? "solar:check-circle-bold"
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
            {confirmed_by ? "Баталсан" : "Хянаж байна"}
          </Button>
        </TableCell>

        <TableCell align="right" sx={{ px: 1 }}>
          {menuPermissions?.delete && menuPermissions?.update && (
            <IconButton
              color={popover.open ? "inherit" : "default"}
              onClick={popover.onOpen}
              id={`count-update-${index}`}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      <Dialog open={form.value} onClose={form.onFalse} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{
            bgcolor: "primary.main",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
          }}
        >
          Тооллогын мэдээлэл
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <CountNewEditForm
            currentCount={row}
            onCloseForm={form.onFalse}
            refetch={refetch}
          />
        </DialogContent>
      </Dialog>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <Divider sx={{ borderStyle: "dashed" }} />

        {menuPermissions?.update && (
          <MenuItem
            onClick={() => {
              form.onToggle();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:pen-bold" />
            Засах
          </MenuItem>
        )}

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
        open={statusInfoPopover.open}
        onClose={statusInfoPopover.onClose}
        arrow="top-center"
        sx={{ width: 260, p: 2 }}
      >
        {confirmed_by ? (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Баталгаажуулалт</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <ProfileAvatar user={confirmed_by} size={32} />
              <Box>
                <Typography variant="body2">
                  {confirmed_by?.full_name || "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {confirmed_date || "-"}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Хянаж байна</Typography>
            {hasDays && (
              <Chip
                label={`${row.days} хоног өнгөрсөн`}
                size="small"
                variant="outlined"
                color={isLate ? "error" : "warning"}
                sx={{ borderRadius: 9999, alignSelf: "flex-start" }}
              />
            )}
            {officer && (
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Мэргэжилтэн: {officer?.full_name || "-"}
                </Typography>
                {officer?.id === user?.id && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => {
                        statusInfoPopover.onClose();
                        handleApprove();
                      }}
                      disabled={loading}
                    >
                      {loading ? "..." : "Зөвшөөрөх"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => {
                        statusInfoPopover.onClose();
                        handleDecline();
                      }}
                      disabled={loading}
                    >
                      {loading ? "..." : "Буцаах"}
                    </Button>
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> гэсэн тооллогын мэдээг устгахдаа итгэлтэй
            байна уу?
          </>
        }
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Устгах
          </Button>
        }
      />

      <CountDetailDialog
        detailOpen={detailOpen}
        setDetailOpen={setDetailOpen}
        row={row}
        slides={slides}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        setLightboxIndex={setLightboxIndex}
        setLightboxOpen={setLightboxOpen}
        parsePointCoordinates={parsePointCoordinates}
      />
    </>
  );
}

CountTableRow.propTypes = {
  row: PropTypes.object,
  rowQueue: PropTypes.object,
  menuPermissions: PropTypes.object,
  decidePermissions: PropTypes.object,
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
};
