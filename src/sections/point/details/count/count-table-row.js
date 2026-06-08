import PropTypes from "prop-types";

import MenuItem from "@mui/material/MenuItem";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import IconButton from "@mui/material/IconButton";
import {
  Box,
  Button,
  Divider,
  Collapse,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { ConfirmDialog } from "src/components/custom-dialog";
import CustomPopover, { usePopover } from "src/components/custom-popover";
import Lightbox from "src/components/lightbox/lightbox";
import { useState } from "react";
import CountNewEditForm from "./count-new-edit-form";
import axiosInstance, { endpoints } from "src/utils/axios";
import { enqueueSnackbar } from "notistack";
import ProfileAvatar from "src/components/profile-avatar";
import dynamic from "next/dynamic";
import CountDetailDialog from "./count-detail-dialog";

// ----------------------------------------------------------------------

const PointDetailMap = dynamic(() => import("../../point-detail-map"), {
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

export default function CountTableRow({
  row,
  rowQueue,
  menuPermissions,
  refetch,
  onDeleteRow,
  decidePermissions,
  user,
}) {
  const { page, rowsPerPage, index } = rowQueue;
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    point,
    counted_by,
    confirmed_by,
    confirmed_date,
    counted_date,
    description,
    status,
  } = row;
  const form = useBoolean();
  const confirm = useBoolean();
  const popover = usePopover();
  const [imagesOpen, setImagesOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [loading, setLoading] = useState(false);

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
          return {
            src: `${process.env.NEXT_PUBLIC_HOST_API}${photo?.photo}`,
            type: photo?.type,
          };
        })
        .filter(Boolean)
    : [];

  const [currentSlide, setCurrentSlide] = useState(0);
  const isDecided = confirmed_by && confirmed_date ? true : false;

  return (
    <>
      <TableRow sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell>{page * rowsPerPage + index + 1}</TableCell>
        <TableCell>{point?.name}</TableCell>
        <TableCell>{point?.number}</TableCell>
        {/* <TableCell>{counted_by?.full_name}</TableCell> */}
        <TableCell>
          <ProfileAvatar user={counted_by} />
        </TableCell>
        <TableCell>{counted_date}</TableCell>
        <TableCell>{description}</TableCell>
        <TableCell>
          {status?.name}
          <IconButton
            size="small"
            color={imagesOpen ? "primary" : "default"}
            onClick={() => {
              setDetailOpen(true);
              popover.onClose();
            }}
            title="Зурагнууд"
            id={`count-photos-${index}`}
          >
            <Iconify
              icon={imagesOpen ? "eva:eye-off-2-outline" : "eva:eye-outline"}
            />
          </IconButton>
        </TableCell>
        <TableCell>
          {isDecided ? (
            <Chip
              icon={<Iconify icon="ci:wavy-check" />}
              label={confirmed_by?.full_name}
              sx={{ borderRadius: 9999, px: 2 }}
              color="info"
            />
          ) : (
            <Chip
              icon={<Iconify icon="mdi:clipboard-search-outline" />}
              label="Хянаж байна"
              sx={{ borderRadius: 9999, px: 2 }}
            />
          )}
        </TableCell>
        <TableCell>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
          >
            <IconButton
              size="small"
              color={imagesOpen ? "primary" : "default"}
              onClick={() => setImagesOpen((v) => !v)}
              title="Зурагнууд"
            >
              <Iconify
                icon={imagesOpen ? "carbon:chevron-up" : "carbon:chevron-down"}
              />
            </IconButton>
            <IconButton
              color={popover.open ? "inherit" : "default"}
              onClick={popover.onOpen}
            >
              <Iconify icon="eva:more-vertical-fill" />
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={10}>
          {/* <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 1, py: 2 }}>
              <CountNewEditForm
                currentCount={row}
                //
                onCloseForm={form.onFalse}
                //
                refetch={refetch}
              />
            </Box>
          </Collapse> */}

          <Dialog
            open={form.value}
            onClose={form.onFalse}
            fullWidth
            maxWidth="sm"
          >
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
                //
                onCloseForm={form.onFalse}
                //
                refetch={refetch}
              />
            </DialogContent>
          </Dialog>
          {/* images collapse */}
          {slides.length > 0 && (
            <Collapse in={imagesOpen} timeout="auto" unmountOnExit>
              <Box sx={{ px: 1, py: 2 }}>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                  {slides.map((s, i) => (
                    <Avatar
                      key={i}
                      variant="rounded"
                      src={s.src}
                      alt={`img-${i}`}
                      sx={{ width: 120, height: 90, cursor: "pointer" }}
                      onClick={() => {
                        setLightboxIndex(i);
                        setLightboxOpen(true);
                      }}
                    />
                  ))}

                  <Lightbox
                    slides={slides}
                    open={lightboxOpen}
                    index={lightboxIndex}
                    close={() => setLightboxOpen(false)}
                  />
                </Stack>

                {!isDecided &&
                  decidePermissions?.create &&
                  user?.id !== row?.counted_by?.id && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button
                          variant="contained"
                          color="success"
                          onClick={handleApprove}
                          disabled={loading}
                        >
                          {loading ? "..." : "Зөвшөөрөх"}
                        </Button>

                        <Button
                          variant="outlined"
                          color="error"
                          onClick={handleDecline}
                          disabled={loading}
                        >
                          {loading ? "..." : "Буцаах"}
                        </Button>
                      </Box>
                    </>
                  )}
              </Box>
            </Collapse>
          )}
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
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

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Устгах"
        content={
          <>
            Та <strong>{name}</strong> гэсэн нэртэй тогтмолыг устгахдаа итгэлтэй
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
  refetch: PropTypes.func,
  onDeleteRow: PropTypes.func,
};
