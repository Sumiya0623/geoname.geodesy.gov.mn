import PropTypes from "prop-types";
import dynamic from "next/dynamic";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import Iconify from "src/components/iconify";

const PointDetailMap = dynamic(
  () => import("src/sections/point/point-detail-map"),
  { ssr: false }
);

export default function PointDetailsDialog({ open, onClose, point }) {
  if (!point) {
    return null;
  }

  const coords =
    point?.geoloc?.coordinates ||
    (point?.b && point?.l ? [Number(point.l), Number(point.b)] : null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: "primary.main",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
        }}
      >
        <Typography variant="h6">
          Цэгийн мэдээлэл: {point?.name || "-"}
        </Typography>
        <IconButton
          onClick={onClose}
          sx={{
            color: "white",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          <Iconify icon="eva:close-fill" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack
          sx={{ p: 0.5 }}
          spacing={1}
          direction={{ xs: "column", md: "row" }}
          alignItems={{ md: "flex-start" }}
        >
          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Нэр:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {point?.name || "-"}
            </Typography>

            <Typography variant="subtitle2" color="text.secondary">
              Төвийн дугаар:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {point?.number || "-"}
            </Typography>

            <Typography variant="subtitle2" color="text.secondary">
              Засаг захиргаа:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {point?.unit?.map((item) => item?.unit || "")?.join(", ") ||
                "N/A"}
            </Typography>

            <Typography variant="subtitle2" color="text.secondary">
              Одоогийн төлөв:
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {point?.status?.name || "-"}
            </Typography>
          </Box>

          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Байршил:
            </Typography>
            <Box
              sx={{
                overflow: "hidden",
              }}
            >
              {coords ? (
                <PointDetailMap point={point} coords={coords} />
              ) : (
                <Box
                  sx={{
                    height: 250,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "grey.100",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Газрын зурагт харуулах координат олдсонгүй
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

PointDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  point: PropTypes.object,
};
