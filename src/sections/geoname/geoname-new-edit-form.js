import * as Yup from "yup";
import PropTypes from "prop-types";
import { useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  Box,
  Stack,
  Chip,
  Button,
  Divider,
  Typography,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useGetConstantsFordropdown } from "src/api/constant";
import FormProvider, {
  RHFSwitch,
  RHFTextField,
} from "src/components/hook-form";

import RequestLocate from "src/sections/request/request-locate";

import GeonameMap from "./geoname-map";
import GeonameOrders from "./geoname-orders";
import GeonameCategoryCascade from "./geoname-category-cascade";

// ----------------------------------------------------------------------
// GeoName үүсгэх / засах. Ангиллын геометр төрлөөр (desc=GEOM_TYPES) газрын
// зургийн хэсэг автоматаар тохирно: Цэг → гар+зургаас, Шугам/Талбай → зурна.
// ----------------------------------------------------------------------

export default function GeonameNewEditForm({
  currentItem = null,
  defaultTypeId = null,
  onClose,
  refetch,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = !!currentItem;

  const { constants: statuses } = useGetConstantsFordropdown("GEONAME_STATUS");
  const { constants: geonameTypes } =
    useGetConstantsFordropdown("GEONAME_TYPES");

  const Schema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    type: Yup.mixed().nullable(),
    status: Yup.mixed().nullable(),
    lat: Yup.mixed().nullable(),
    lon: Yup.mixed().nullable(),
    geom: Yup.mixed().nullable(),
    is_approved: Yup.boolean(),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentItem?.name || "",
      type: currentItem?.type?.id || defaultTypeId || "",
      status: currentItem?.status?.id || "",
      lat: currentItem?.lat ?? "",
      lon: currentItem?.lon ?? "",
      geom: currentItem?.geom || null,
      orders: currentItem?.orders || [],
      is_approved: currentItem?.is_approved || false,
    }),
    [currentItem, defaultTypeId],
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id]);

  // Сонгосон ангиллын desc = геометр төрөл (Цэг/Шугам/Талбай)
  const typeId = watch("type");
  const geomType = useMemo(() => {
    const t = geonameTypes.find((x) => String(x.id) === String(typeId));
    return t?.desc || "";
  }, [geonameTypes, typeId]);
  const isPoint = geomType === "Цэг";

  // Цэг үед: гараас оруулсан lat/lon → geom (Point)
  const lat = watch("lat");
  const lon = watch("lon");
  useEffect(() => {
    if (isPoint && lat !== "" && lon !== "" && lat != null && lon != null) {
      setValue("geom", {
        type: "Point",
        coordinates: [Number(lon), Number(lat)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, isPoint]);

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      name: data.name,
      type_id: data.type || null,
      status_id: data.status || null,
      geom: data.geom || null,
      order_ids: (data.orders || []).map((o) => o.id),
      is_approved: !!data.is_approved,
    };
    const method = isEdit ? "patch" : "post";
    const URL = isEdit
      ? endpoints.geoname.edit(currentItem.id)
      : endpoints.geoname.create;
    try {
      const res = await axiosInstance[method](URL, payload);
      if (res.status === 200 || res.status === 201) {
        enqueueSnackbar(`Амжилттай ${isEdit ? "өөрчлөгдлөө" : "нэмэгдлээ"}`);
        reset();
        onClose && onClose();
        refetch && refetch();
      }
    } catch (error) {
      const d = error?.response?.data;
      enqueueSnackbar(
        d?.detail ||
          (d && typeof d === "object" && JSON.stringify(d)) ||
          "Алдаа гарлаа",
        { variant: "error" },
      );
    }
  });

  return (
    <Box
      sx={{
        p: 2,
        borderLeft: "4px solid",
        borderColor: "primary.main",
        bgcolor: "background.white",
        borderRadius: 1,
      }}
    >
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          {isEdit ? "Газар зүйн нэр засах" : "Шинэ газар зүйн нэр"}
        </Typography>

        <Box
          gap={2}
          display="grid"
          gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }}
        >
          {/* Ангилал — шаталсан сонголт (геометр төрлийг тодорхойлно) */}

          <RHFTextField name="name" label="Нэр" />
          <Stack direction="row" spacing={1.5}>
            <GeonameCategoryCascade
              grow
              rootTypeId={defaultTypeId}
              value={currentItem?.type?.id}
              onChange={(id) =>
                setValue("type", id || defaultTypeId || "", {
                  shouldValidate: true,
                })
              }
            />
          </Stack>

          {/* Геометрийн хэсэг — ангиллын төрлөөр автоматаар */}
          {geomType && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">Байршил</Typography>
                <Chip
                  size="small"
                  variant="soft"
                  color="success"
                  label={geomType}
                />
              </Stack>

              {/* Цэг — гараас оруулах + зургаас хатгах */}
              {isPoint && (
                <Box sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1}>
                    <RHFTextField
                      name="lat"
                      label="Өргөрөг"
                      type="number"
                      size="small"
                    />
                    <RHFTextField
                      name="lon"
                      label="Уртраг"
                      type="number"
                      size="small"
                    />
                  </Stack>
                  <RequestLocate />
                </Box>
              )}

              {/* Газрын зураг — Цэг: дарж тэмдэглэх; Шугам/Талбай: зурах */}
              <GeonameMap
                geomType={geomType}
                value={currentItem?.geom}
                onChange={(g) => {
                  setValue("geom", g);
                  if (g?.type === "Point") {
                    setValue("lon", g.coordinates[0]);
                    setValue("lat", g.coordinates[1]);
                  }
                }}
              />
            </Box>
          )}

          {/* Эрх зүйн баримт бичиг — төрлөөр шүүж сонгоно */}
          <GeonameOrders
            initialOrders={currentItem?.orders || []}
            currentId={currentItem?.id ?? "new"}
          />
        </Box>

        <RHFSwitch name="is_approved" label="Батлагдсан" sx={{ mt: 1 }} />

        <Divider sx={{ my: 2, borderStyle: "dashed" }} />
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={onClose}>
            Буцах
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            color="primary"
            loading={isSubmitting}
          >
            {isEdit ? "Хадгалах" : "Нэмэх"}
          </LoadingButton>
        </Stack>
      </FormProvider>
    </Box>
  );
}

GeonameNewEditForm.propTypes = {
  currentItem: PropTypes.object,
  defaultTypeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClose: PropTypes.func,
  refetch: PropTypes.func,
};
