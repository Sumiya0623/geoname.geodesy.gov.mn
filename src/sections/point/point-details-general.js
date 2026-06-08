import PropTypes from "prop-types";

import Card from "@mui/material/Card";
import Grid from "@mui/material/Unstable_Grid2";

import Iconify from "src/components/iconify";
import Label from "src/components/label";
import { alpha, Box, Typography, Tabs, Tab, IconButton } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";
import axiosInstance from "src/utils/axios";
import Carousel, {
  CarouselArrowIndex,
  useCarousel,
} from "src/components/carousel";
import Image from "src/components/image";
import Lightbox, { useLightBox } from "src/components/lightbox";
import MeasurementListView from "../measurement/view/measurement-list-view";
import dynamic from "next/dynamic";
import DetailOrderAct from "./details/detail-order-act";
import { useNextStep } from "nextstepjs";

const PointDetailMap = dynamic(() => import("./point-detail-map"), {
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
        source?.location?.lon
    );
    const lat = Number(
      source?.latitude ??
        source?.lat ??
        source?.location?.latitude ??
        source?.location?.lat
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

const TABS = [
  {
    value: "measure",
    label: "Хэмжилт",
    icon: <Iconify icon="solar:user-id-bold" width={24} />,
  },

  {
    value: "orderact",
    label: "Хандалт",
    icon: <Iconify icon="solar:bell-bing-bold" width={24} />,
  },
];

export default function PointDetailsGeneral({ id, send }) {
  const { enqueueSnackbar } = useSnackbar();
  const [point, setpoint] = useState(null);
  const [job, setjob] = useState(null);
  const [datas, setDatas] = useState(null);
  const [datasLoading, setDatasLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState("measure");
  const { currentStep, currentTour } = useNextStep();

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
  }, []);

  useEffect(() => {
    const handleSwitchToOrderAct = () => {
      setCurrentTab("orderact");
    };

    window.addEventListener("point:switch-to-orderact", handleSwitchToOrderAct);
    return () =>
      window.removeEventListener(
        "point:switch-to-orderact",
        handleSwitchToOrderAct
      );
  }, []);

  useEffect(() => {
    if (currentTour === "service-dynamic" && currentStep < 7) {
      setCurrentTab("measure");
    }
  }, [currentStep, currentTour]);

  const photos = useMemo(() => {
    const registry = new Map();

    const register = (item) => {
      if (!item?.src) return;
      const key = item.id ?? item.src;
      if (registry.has(key)) return;

      registry.set(key, {
        id: key,
        src: item.src,
        text: item.text || "",
      });
    };

    if (Array.isArray(point?.photos)) {
      point.photos.forEach((img) => {
        register({
          id: img?.id ?? img?.photo,
          src: img?.photo,
          text: img?.type?.name,
        });
      });
    }

    if (Array.isArray(datas?.measurements)) {
      datas.measurements.forEach((measurement, idx) => {
        register({
          id: `thumb-${measurement?.id ?? idx}`,
          src: measurement?.point?.thumb,
          text: measurement?.point?.name,
        });

        (measurement?.measurementphotos || []).forEach((photo) => {
          register({
            id: photo?.id ?? `${measurement?.id ?? idx}-${photo?.photo}`,
            src: photo?.photo,
            text: photo?.type?.name || photo?.type || "Unknown",
          });
        });
      });
    }

    return Array.from(registry.values());
  }, [datas?.measurements, point?.photos]);

  const lightbox = useLightBox(photos);
  const pointCoordinates = useMemo(
    () => parsePointCoordinates(datas || point),
    [datas, point]
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    getPointData();
  }, [id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const getPointData = async () => {
    try {
      const res = await axiosInstance.get(`/api/point/point/${id}/`);
      if (res?.status === 200) {
        setpoint(res?.data || null);
        setDatas(res?.data);
        send(res?.data?.marker_num || "");
        if (res?.data?.job) {
          // setjobId(res?.data?.job);
          getJobData(res?.data?.job);
        } else {
          enqueueSnackbar("Point data fetch failed!", { variant: "error" });
        }
      } else {
        enqueueSnackbar("Point data fetch failed!", { variant: "error" });
      }
    } catch (error) {
    } finally {
      setDatasLoading(false);
    }
  };

  const getJobData = async (id) => {
    try {
      const res = await axiosInstance.get(`/api/monpos/job/${id}/`);
      if (res?.status === 200) {
        setjob(res?.data || null);
      } else {
        enqueueSnackbar("Job data fetch failed!", { variant: "error" });
      }
    } catch (error) {}
  };

  const carouselLarge = useCarousel({
    rtl: false,
    draggable: false,
    adaptiveHeight: true,
    slidesToShow: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    infinite: true,
    dots: true,
    pauseOnHover: true,
  });

  useEffect(() => {
    carouselLarge.onSetNav();
  }, [carouselLarge]);

  useEffect(() => {
    if (lightbox.open) {
      carouselLarge.onTogo(lightbox.selected);
    }
  }, [carouselLarge, lightbox.open, lightbox.selected]);

  function handleShowOnMap() {
    const body = {
      lat: pointCoordinates[1],
      lon: pointCoordinates[0],
      zoom: 16,
    };
    const queried_request_body = new URLSearchParams(body).toString();

    const path = `/dashboard/map?${queried_request_body}&point_id=${id}`;
    window.open(path, "_blank");
  }

  return (
    <Grid container spacing={1} sx={{ width: "100%" }}>
      <Grid
        item
        xs={12}
        md={7}
        sx={{ display: "flex", flexDirection: "column" }}
      >
        <Card
          sx={{ flex: 1, p: 2, display: "flex", flexDirection: "column" }}
          id="service-detail"
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ py: 1 }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Iconify icon="eva:pin-fill" width={24} />
              <Typography variant="body2" color="text.secondary">
                Цэгийн нэр:
              </Typography>
            </Box>

            <Label
              variant="soft"
              sx={{
                bgcolor: "primary.main", // light background like in your image
                color: "white", // text color
                fontWeight: "bold",
                px: 1.2,
                py: 0.4,
                borderRadius: 1.5,
              }}
            >
              {datas?.name}
            </Label>
          </Box>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ py: 1 }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Iconify icon="eva:folder-fill" width={24} />
              <Typography variant="body2" color="text.secondary">
                Цэгийн дугаар:
              </Typography>
            </Box>

            <Label
              variant="soft"
              sx={{
                bgcolor: "primary.main", // light background like in your image
                color: "white", // text color
                fontWeight: "bold",
                px: 1.2,
                py: 0.4,
                borderRadius: 1.5,
              }}
            >
              {datas?.number}
            </Label>
          </Box>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ py: 1 }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Iconify icon="eva:navigation-2-fill" width={24} />
              <Typography variant="body2" color="text.secondary">
                Байршил:
              </Typography>
            </Box>

            <Label
              variant="soft"
              sx={{
                bgcolor: "primary.main", // light background like in your image
                color: "white", // text color
                fontWeight: "bold",
                px: 1.2,
                py: 0.4,
                borderRadius: 1.5,
              }}
            >
              {point?.unit?.map((item) => item?.unit || "")?.join(", ") ||
                "N/A"}
            </Label>
          </Box>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            sx={{ py: 1 }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Iconify icon="hugeicons:status" width={24} />
              <Typography variant="body2" color="text.secondary">
                Төлөв:
              </Typography>
            </Box>

            <Label
              variant="soft"
              sx={{
                bgcolor: "primary.main", // light background like in your image
                color: "white", // text color
                fontWeight: "bold",
                px: 1.2,
                py: 0.4,
                borderRadius: 1.5,
              }}
            >
              {point?.status?.name}
            </Label>
          </Box>

          <Box
            sx={{
              mt: 2,
              borderRadius: 2,
              overflow: "hidden",
              border: (theme) => `1px solid ${theme.palette.divider}`,
              boxShadow: (theme) => theme.customShadows?.z4 || theme.shadows[4],
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: (theme) =>
                  `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.dark, 0.24)})`,
              }}
            >
              <Box display="flex" alignItems="center" gap={1.5}>
                <Iconify icon="mdi:map" width={20} color="primary.main" />
                <Typography variant="subtitle2">Газрын зураг</Typography>
              </Box>
              <IconButton
                variant="contained"
                color="primary"
                id="service-map"
                onClick={() => {
                  handleShowOnMap();
                }}
              >
                <Iconify icon="tdesign:jump" width="12" height="12" />
              </IconButton>
            </Box>
            {pointCoordinates ? (
              <PointDetailMap point={datas} coords={pointCoordinates} />
            ) : (
              <Box
                sx={{
                  height: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "grey.100",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Газрын зурагт харуулах координат олдсонгүй
                </Typography>
              </Box>
            )}
          </Box>
        </Card>
      </Grid>
      <Grid item xs={12} md={5} sx={{ display: "flex" }}>
        <Card sx={{ flex: 1 }}>
          <Box
            id="service-photos"
            sx={{ flex: 1, position: "relative", overflow: "hidden" }}
          >
            {photos.length > 0 ? (
              <>
                <Carousel
                  {...carouselLarge.carouselSettings}
                  ref={carouselLarge.carouselRef}
                >
                  {photos.map((slide, index) => {
                    const key = slide?.id ?? slide?.src ?? `slide-${index}`;
                    // return <></>
                    return (
                      <Box key={key} position="relative">
                        <Image
                          alt={slide?.text}
                          src={slide?.src || ""}
                          ratio="1/1"
                          onClick={() => lightbox.onOpen(slide?.src)}
                          sx={{ cursor: "zoom-in" }}
                        />

                        <Box
                          sx={{
                            position: "absolute",
                            bottom: 16,
                            left: 16,
                            bgcolor: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="subtitle2">
                            {slide?.text || "No name"}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Carousel>

                <CarouselArrowIndex
                  index={carouselLarge.currentIndex}
                  total={photos.length}
                  onNext={carouselLarge.onNext}
                  onPrev={carouselLarge.onPrev}
                />
              </>
            ) : (
              <Box sx={{ textAlign: "center", py: 5 }}>
                <Typography variant="subtitle1" color="text.secondary">
                  Зураг олдсонгүй
                </Typography>
              </Box>
            )}

            <Lightbox
              index={lightbox.selected}
              slides={photos}
              open={lightbox.open}
              close={lightbox.onClose}
              onGetCurrentIndex={(index) => lightbox.setSelected(index)}
            />
          </Box>
        </Card>
      </Grid>
      <Grid xs={12}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={currentTab} onChange={handleChangeTab}>
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                label={tab.label}
                icon={tab.icon}
                value={tab.value}
              />
            ))}
          </Tabs>
        </Box>
      </Grid>
      <Grid xs={12}>
        {currentTab === "measure" && <MeasurementListView pointId={id} />}
        {currentTab === "orderact" && <DetailOrderAct pointId={id} />}
      </Grid>
    </Grid>
  );
}

PointDetailsGeneral.propTypes = {
  id: PropTypes.string,
};
