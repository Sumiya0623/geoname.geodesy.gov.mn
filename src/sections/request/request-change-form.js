import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import { Box, Chip, Stack, Button, Divider, Typography } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { useGetGeonames } from "src/api/request";
import axiosInstance, { endpoints } from "src/utils/axios";
import FormProvider, {
  RHFAutocomplete,
  RHFTextField,
} from "src/components/hook-form";

import RequestLocate from "./request-locate";
import { useRequestForm, RequestSharedFields } from "./request-form-core";

// ----------------------------------------------------------------------
// "Өөрчлөх" хүсэлт — өөрчлөх газар зүйн нэр заавал. Inline (toolbar доор).
// geonameId дамжуулбал тухайн нэрийн дэлгэрэнгүйг (detail serializer) татаж,
// нэр + солбицлыг урьдчилан бөглөнө.
// ----------------------------------------------------------------------

export default function RequestChangeForm({
  onClose,
  currentItem = null,
  selectedStatus = null,
  geonameId = null,
  refetch,
}) {
  const { geonames } = useGetGeonames("");
  const [seed, setSeed] = useState(null);

  // geonameId → detail serializer‑ээр татаж урьдчилан бөглөх утга бэлдэнэ.
  useEffect(() => {
    if (currentItem || !geonameId) {
      setSeed(null);
      return undefined;
    }
    let active = true;
    axiosInstance
      .get(endpoints.geoname.details(geonameId))
      .then((res) => {
        const d = res?.data;
        if (active && d) {
          setSeed({
            name: { id: d.id, name: d.name },
            lat: d.lat ?? null,
            lon: d.lon ?? null,
          });
        }
      })
      .catch(() => {
        if (active) setSeed(null);
      });
    return () => {
      active = false;
    };
  }, [geonameId, currentItem]);

  const f = useRequestForm({
    currentItem,
    selectedStatus,
    requireName: true,
    seed,
    onClose,
    refetch,
  });

  // Сонгогдсон газар зүйн нэрийн ангилал (level1/2/3) — detail‑ээс татаж
  // харуулаад, формын утгуудыг (type, lat, lon) бодитоор сетлэнэ.
  const watchedName = f.methods.watch("name");
  const [typePath, setTypePath] = useState([]);
  useEffect(() => {
    const id = watchedName?.id;
    if (!id) {
      setTypePath([]);
      return undefined;
    }
    let active = true;
    axiosInstance
      .get(endpoints.geoname.details(id))
      .then((res) => {
        if (!active) return;
        const d = res?.data || {};
        const path = d.type_path || [];
        setTypePath(path);
        const { setValue } = f.methods;
        // Ангилал (хамгийн гүн төрөл) — type cascade‑д тусгагдана
        const leaf = path.length ? path[path.length - 1].id : "";
        setValue("type", leaf || "", { shouldValidate: true });
        if (d.lat != null) setValue("lat", d.lat);
        if (d.lon != null) setValue("lon", d.lon);
      })
      .catch(() => {
        if (active) setTypePath([]);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName?.id]);

  return (
    <Box sx={{ p: 0 }}>
      <FormProvider methods={f.methods} onSubmit={f.onSubmit}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
          {f.isEdit ? "Хүсэлт засах" : "Нэр өөрчлөх хүсэлт"}
          <Typography component="span" variant="body2" color="text.secondary">
            {" · "}
            {f.statusObj?.name || "Өөрчлөх"}
          </Typography>
        </Typography>

        <Box
          gap={2}
          display="grid"
          gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)" }}
          sx={{ mb: 1 }}
        >
          <Box>
            <RHFAutocomplete
              name="name"
              label="Өөрчлөх газар зүйн нэр"
              options={geonames}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
            />
          </Box>
          <Box>
            <Stack direction="row" spacing={1}>
              <RHFTextField name="lat" label="Өргөрөг" type="number" />
              <RHFTextField name="lon" label="Уртраг" type="number" />
            </Stack>
            <RequestLocate />
          </Box>
        </Box>

        <RequestSharedFields
          currentItem={currentItem}
          photos={f.photos}
          setPhotos={f.setPhotos}
        />

        <Divider sx={{ my: 2, borderStyle: "dashed" }} />
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={onClose}>
            Буцах
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            color="primary"
            loading={f.isSubmitting}
          >
            {f.isEdit ? "Хадгалах" : "Бүртгэх"}
          </LoadingButton>
        </Stack>
      </FormProvider>
    </Box>
  );
}

RequestChangeForm.propTypes = {
  onClose: PropTypes.func,
  currentItem: PropTypes.object,
  selectedStatus: PropTypes.object,
  geonameId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  refetch: PropTypes.func,
};
