import * as Yup from "yup";
import { useMemo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  Box,
  Stack,
  Button,
  Divider,
  Typography,
  IconButton,
} from "@mui/material";
import { Icon } from "@iconify/react";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useGetConstantsFordropdown } from "src/api/constant";
import { RHFMultiChipAutocomplete } from "src/components/hook-form";

import RequestNameOption from "./request-name-option";
import RequestTypeCascade from "./request-type-cascade";

// ----------------------------------------------------------------------
// Хоёр форм (Өөрчлөх / Шинээр)-ийн дундын логик ба нийтлэг талбарууд.
// ----------------------------------------------------------------------

// Санал болгож буй нэр — нэг бичлэг: Санал1 (name), Санал2 (name2),
// Эх сурвалж (UI: source ↔ backend: desc)
function buildDefaultValues(currentItem) {
  const o = currentItem?.options?.[0];
  const c = currentItem?.contacts?.[0];
  return {
    name: currentItem?.name || null,
    age: currentItem?.age?.id || "",
    type: currentItem?.type?.id || "",
    purpose: currentItem?.purpose || [],
    description: currentItem?.description || "",
    lat: currentItem?.lat ?? "",
    lon: currentItem?.lon ?? "",
    option: {
      name: o?.name || "",
      name2: o?.name2 || "",
      source: o?.desc || "",
    },
    contact: {
      register: c?.register || "",
      person: c?.person || "",
      first_name: c?.first_name || "",
      last_name: c?.last_name || "",
      address: c?.address || "",
      phone: c?.phone || "",
      email: c?.email || "",
    },
  };
}

// Хоёр форм хоёулаа ашиглах hook — useForm, schema, submit, ижил state.
export function useRequestForm({
  currentItem,
  selectedStatus,
  requireName = false,
  seed = null,
  onClose,
  refetch,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = !!currentItem;
  const statusObj = currentItem?.status || selectedStatus;

  const [photos, setPhotos] = useState([]); // оруулах зургууд (File[])

  const Schema = Yup.object().shape({
    name: requireName
      ? Yup.mixed().nullable().required("Өөрчлөх газар зүйн нэрийг сонгоно уу")
      : Yup.mixed().nullable(),
    age: Yup.mixed().nullable(),
    type: Yup.mixed().nullable(),
    purpose: Yup.array().nullable(),
    description: Yup.string().nullable(),
    lat: Yup.mixed().nullable(),
    lon: Yup.mixed().nullable(),
    option: Yup.object({
      name: Yup.string().required("Санал 1 нэрийг оруулна уу"),
    }),
    contact: Yup.object().nullable(),
  });

  const defaultValues = useMemo(() => {
    const dv = buildDefaultValues(currentItem);
    // Шинээр үүсгэх үед идэвхтэй нэр / солбицлыг урьдчилан бөглөнө (seed).
    if (!currentItem && seed) {
      if (seed.name) dv.name = seed.name;
      if (seed.lat !== undefined && seed.lat !== null) dv.lat = seed.lat;
      if (seed.lon !== undefined && seed.lon !== null) dv.lon = seed.lon;
    }
    return dv;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, seed?.name?.id, seed?.lat, seed?.lon]);

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id, seed?.name?.id, seed?.lat, seed?.lon]);

  const onSubmit = handleSubmit(
    async (data) => {
      if (!statusObj?.id) {
        enqueueSnackbar("Төлөв тодорхойгүй байна", { variant: "warning" });
        return;
      }
      // Нэг санал — Санал1/Санал2/Эх сурвалж (UI: source → backend: desc)
      const o = data.option || {};
      const options =
        o.name || o.name2
          ? [{ name: o.name || "", name2: o.name2 || "", desc: o.source || "" }]
          : [];
      // Холбоо барих — 1 (хүсэлтийн түвшинд)
      const c = data.contact || {};
      const hasContact = c.person || c.register || c.phone;
      const contacts = hasContact
        ? [
            {
              person: c.person || "",
              first_name: c.first_name || "",
              last_name: c.last_name || "",
              register: c.register || "",
              address: c.address || "",
              phone: c.phone || "",
              email: c.email || "",
            },
          ]
        : [];
      const payload = {
        status_id: statusObj.id,
        name_id: data.name?.id || null,
        age_id: data.age || null,
        type_id: data.type || null,
        purpose_ids: (data.purpose || []).map((p) => p.id),
        description: data.description || "",
        lat: data.lat === "" ? null : Number(data.lat),
        lon: data.lon === "" ? null : Number(data.lon),
        options,
        contacts,
      };
      const method = isEdit ? "patch" : "post";
      const URL = isEdit
        ? endpoints.request.edit(currentItem.id)
        : endpoints.request.create;
      try {
        const res = await axiosInstance[method](URL, payload);
        if (res.status === 200 || res.status === 201) {
          // Зураг хавсаргасан бол хүсэлт үүссэний дараа upload‑оор илгээнэ
          const reqId = isEdit ? currentItem.id : res?.data?.id;
          if (reqId && photos.length) {
            const fd = new FormData();
            photos.forEach((p) => fd.append("photos", p));
            try {
              await axiosInstance.post(endpoints.request.upload(reqId), fd);
            } catch (e) {
              enqueueSnackbar("Зураг хадгалахад алдаа гарлаа", {
                variant: "warning",
              });
            }
          }
          enqueueSnackbar(
            `Хүсэлт амжилттай ${isEdit ? "өөрчлөгдлөө" : "бүртгэгдлээ"}`,
          );
          reset();
          setPhotos([]);
          onClose && onClose();
          refetch && refetch();
        }
      } catch (error) {
        const d = error?.response?.data;
        const msg =
          d?.detail ||
          (d && typeof d === "object" && JSON.stringify(d)) ||
          error?.message ||
          "Алдаа гарлаа";
        enqueueSnackbar(msg, { variant: "error" });
      }
    },
    (errors) => {
      const first = Object.values(errors || {})[0];
      enqueueSnackbar(first?.message || "Талбаруудыг гүйцэт бөглөнө үү", {
        variant: "warning",
      });
    },
  );

  return {
    methods,
    onSubmit,
    isSubmitting,
    isEdit,
    statusObj,
    photos,
    setPhotos,
  };
}

// Хоёр форм хоёулаа харуулах нийтлэг талбарууд (type cascade, зорилго,
// тайлбар, координат, нэрлэвэр + холбоо барих, "ижил" toggle).
export function RequestSharedFields({ currentItem, photos = [], setPhotos }) {
  const { constants: purposes } =
    useGetConstantsFordropdown("REQUEST_PURPOSES");

  const handlePickPhotos = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length && setPhotos) setPhotos((prev) => [...prev, ...files]);
    e.target.value = ""; // дахин ижил файл сонгох боломжтой
  };

  const removePhoto = (idx) =>
    setPhotos && setPhotos((prev) => prev.filter((_, i) => i !== idx));

  return (
    <>
      <Box
        gap={2}
        display="grid"
        gridTemplateColumns={{ xs: "1fr", sm: "repeat(1, 2fr)" }}
        sx={{ pt: 1 }}
      >
        <RequestTypeCascade currentName={currentItem?.type?.name} />

        <RHFMultiChipAutocomplete
          name="purpose"
          label="Шалтгаан"
          options={purposes}
          getOptionLabel={(o) => o?.name || ""}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
        Санал болгож буй нэр
      </Typography>
      <RequestNameOption />

      {/* Зураг оруулах */}
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Typography variant="subtitle2">Зураг (гэрэл зураг)</Typography>
          <Button
            component="label"
            size="small"
            startIcon={<Icon icon="solar:gallery-add-bold" />}
          >
            Зураг сонгох
            <input
              hidden
              multiple
              type="file"
              accept="image/*"
              onChange={handlePickPhotos}
            />
          </Button>
        </Stack>
        {photos.length > 0 ? (
          <Box
            gap={1}
            display="grid"
            gridTemplateColumns={{
              xs: "repeat(3, 1fr)",
              sm: "repeat(5, 1fr)",
            }}
          >
            {photos.map((file, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box
                key={idx}
                sx={{
                  position: "relative",
                  pt: "100%",
                  borderRadius: 1,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  component="img"
                  alt={file.name}
                  src={URL.createObjectURL(file)}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => removePhoto(idx)}
                  sx={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    bgcolor: "rgba(0,0,0,0.5)",
                    color: "#fff",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <Icon icon="mdi:close" width={16} />
                </IconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            1-8 ширхэг гэрэл зураг оруулах боломжтой.
          </Typography>
        )}
      </Box>
    </>
  );
}
