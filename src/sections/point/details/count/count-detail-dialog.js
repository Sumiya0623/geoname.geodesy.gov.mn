import IconButton from "@mui/material/IconButton";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  Accordion,
  AccordionSummary,
  Typography,
  AccordionDetails,
  Link,
} from "@mui/material";
import Stack from "@mui/material/Stack";
import Iconify from "src/components/iconify";
import dynamic from "next/dynamic";

const PointDetailMap = dynamic(
  () => import("src/sections/point/point-detail-map"),
  {
    // const PointDetailMap = dynamic(() => import("../../point-detail-map"), {
    ssr: false,
  },
);

function CountDetailDialog({
  detailOpen,
  setDetailOpen,
  row,
  slides,
  currentSlide,
  setCurrentSlide,
  setLightboxIndex,
  setLightboxOpen,
  parsePointCoordinates,
}) {
  const {
    point,
    counted_by,
    confirmed_by,
    confirmed_date,
    counted_date,
    description,
    status,
  } = row;
  const pointCoordinates = parsePointCoordinates(point);

  return (
    <Dialog
      open={detailOpen}
      onClose={() => setDetailOpen(false)}
      maxWidth="md"
      fullWidth
    >
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
        <Typography variant="h6">Тооллогын дэлгэрэнгүй мэдээлэл</Typography>
        <IconButton
          onClick={() => setDetailOpen(false)}
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
      <DialogContent sx={{ m: 0, px: 0 }}>
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
            sx={{
              bgcolor: "grey.50",
              borderRadius: 1,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            <>
              <Iconify icon="eva:pin-fill" width={20} />
              <Typography variant="h6">Цэгийн мэдээлэл</Typography>
            </>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            <Stack
              spacing={1}
              direction={{ xs: "column", md: "row" }}
              alignItems={{ md: "flex-start" }}
              sx={{ p: 1 }}
            >
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Нэр:
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {point?.name ? (
                    <Link
                      href={`/dashboard/ready/${point.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="body1"
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(`/dashboard/ready/${point.id}`, "_blank");
                      }}
                      onMouseDown={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          window.open(`/dashboard/ready/${point.id}`, "_blank");
                        }
                      }}
                      sx={{
                        color: "primary.main",
                        textDecoration: "none",
                        "&:hover": {
                          textDecoration: "underline",
                        },
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      {point.name}
                      <Iconify icon="eva:external-link-fill" width={16} />
                    </Link>
                  ) : (
                    "-"
                  )}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Дугаар:
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

              <Box
                flex={1}
                sx={{
                  height: 250,
                  borderRadius: 2,
                  overflow: "hidden",
                  boxShadow: 1,
                }}
              >
                {pointCoordinates ? (
                  <Box
                    sx={{
                      height: 250,
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    <PointDetailMap point={point} coords={pointCoordinates} />
                  </Box>
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
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded sx={{ p: 0 }}>
          <AccordionSummary
            expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
            sx={{
              my: 0,
              py: 0,
              bgcolor: "grey.50",
              borderRadius: 1,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            <>
              <Iconify icon="eva:file-text-fill" />
              <Typography variant="h6">Тооллогын мэдээлэл</Typography>
            </>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              sx={{ p: 1 }}
              alignItems={{ md: "flex-start" }}
            >
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Илгээсэн огноо: {counted_date || "-"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Илгээсэн: {counted_by?.full_name || "-"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Тайлбар: {description || "-"}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  Төлөв: {status?.name || "-"}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Баталсан: {confirmed_by?.full_name || "Батлагдаагүй"}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  Баталсан огноо: {confirmed_date || "-"}
                </Typography>
              </Box>
              {slides.length > 0 && (
                <Box
                  flex={1}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <Box
                    sx={{
                      width: 260,
                      height: 220,
                      position: "relative",
                      borderRadius: 2,
                      overflow: "hidden",
                      cursor: "pointer",
                      bgcolor: "grey.100",
                    }}
                    onClick={() => {
                      setLightboxIndex(currentSlide);
                      setLightboxOpen(true);
                    }}
                  >
                    <img
                      src={slides[currentSlide]?.src}
                      alt={
                        slides[currentSlide]?.type?.name ||
                        `img-${currentSlide}`
                      }
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />

                    {/* төрөл нэр – баруун дээд буланд */}
                    {slides[currentSlide]?.type?.name && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: "rgba(0,0,0,0.6)",
                        }}
                      >
                        <Typography variant="caption" color="common.white">
                          {slides[currentSlide].type.name}
                        </Typography>
                      </Box>
                    )}

                    {/* өмнөх сум – зүүн тал дотор нь */}
                    {slides.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlide(
                            (prev) =>
                              (prev - 1 + slides.length) % slides.length,
                          );
                        }}
                        sx={{
                          position: "absolute",
                          top: "50%",
                          left: 4,
                          transform: "translateY(-50%)",
                          bgcolor: "rgba(0,0,0,0.4)",
                          color: "common.white",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                        }}
                      >
                        <Iconify icon="eva:arrow-ios-back-fill" />
                      </IconButton>
                    )}

                    {/* дараагийн сум – баруун тал дотор нь */}
                    {slides.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentSlide((prev) => (prev + 1) % slides.length);
                        }}
                        sx={{
                          position: "absolute",
                          top: "50%",
                          right: 4,
                          transform: "translateY(-50%)",
                          bgcolor: "rgba(0,0,0,0.4)",
                          color: "common.white",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                        }}
                      >
                        <Iconify icon="eva:arrow-ios-forward-fill" />
                      </IconButton>
                    )}
                  </Box>

                  {/* төрөл нэр – slider-ийн доор, төвд */}
                  {slides[currentSlide]?.type?.name && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="center"
                      sx={{ mt: 0.75, display: "block" }}
                    >
                      {slides[currentSlide].type.name}
                    </Typography>
                  )}

                  {/* дугаарлалт */}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    align="center"
                    sx={{ mt: 0.25 }}
                  >
                    {currentSlide + 1} / {slides.length}
                  </Typography>
                </Box>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}

export default CountDetailDialog;
