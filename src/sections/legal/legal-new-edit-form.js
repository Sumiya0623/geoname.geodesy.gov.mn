import * as Yup from "yup";
import useSWR from "swr";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useRef, useMemo, useEffect, useCallback } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  Box,
  Stack,
  Button,
  MenuItem,
  Typography,
  Divider,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import { useGetLegalTypes } from "src/api/legal";
import { useGetConstantsFordropdown } from "src/api/constant";
import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFSelect,
  RHFTextField,
  RHFDatePicker,
  RHFAutocomplete,
  UploadPDFField,
} from "src/components/hook-form";

// ----------------------------------------------------------------------
// AdminUnit dropdown — түвшнээр шүүнэ:
//   level='aimag' → Аймаг/Нийслэл
//   level='sum'   → Сум/Дүүрэг (parent=сонгосон аймаг)
// ----------------------------------------------------------------------

function useUnitDropdown(level, parentId, enabled) {
  const params = new URLSearchParams({ level });
  if (parentId) params.append("parent", parentId);
  const URL = endpoints.legal.units(params.toString());
  const { data, isLoading } = useSWR(
    enabled ? [URL, axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return { units: data?.results || [], unitsLoading: isLoading };
}

// ----------------------------------------------------------------------

export default function LegalNewEditForm({
  onClose,
  currentItem = null,
  selectedType = null,
  refetch,
  projectId = null,
}) {
  const { enqueueSnackbar } = useSnackbar();

  // org = LEGAL_TYPES (карт/ангилал, нэгж кодтой), type = ORDER_TYPES (баримтын төрөл)
  const { legalTypes } = useGetLegalTypes();
  const { constants: orderTypes } = useGetConstantsFordropdown("ORDER_TYPES");

  // Анхны (prefill) ангилал — засах үед бичлэгийн org, нэмэх үед сонгосон карт
  const initOrgObj = currentItem?.org || selectedType;
  const initCode = String(initOrgObj?.code ?? "0");

  const Schema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    org: Yup.mixed().nullable(),
    type: Yup.mixed().nullable(),
    order_number: Yup.string().nullable(),
    order_date: Yup.mixed().nullable(),
    signer: Yup.string().nullable(),
    description: Yup.string().nullable(),
    aimag: Yup.mixed().nullable(),
    sum: Yup.mixed().nullable(),
    document: Yup.mixed().nullable(),
  });

  // Засах үед unit‑аас аймаг/сумыг сэргээх (code: 1=аймаг, 2=аймаг+сум)
  const initialUnit = currentItem?.unit || null;
  const initNeedAimag = initCode === "1" || initCode === "2";
  const initNeedSum = initCode === "2";
  const defaultValues = useMemo(
    () => ({
      name: currentItem?.name || "",
      org: currentItem?.org?.id || selectedType?.id || "",
      type: currentItem?.type?.id || "",
      order_number: currentItem?.order_number || "",
      order_date: currentItem?.order_date
        ? new Date(currentItem.order_date)
        : null,
      signer: currentItem?.signer || "",
      description: currentItem?.description || "",
      aimag:
        initNeedSum && initialUnit?.parent
          ? { id: initialUnit.parent, unit: initialUnit.parent_unit || "" }
          : initNeedAimag && initialUnit
            ? { id: initialUnit.id, unit: initialUnit.unit }
            : null,
      sum:
        initNeedSum && initialUnit
          ? { id: initialUnit.id, unit: initialUnit.unit }
          : null,
      document: currentItem?.document || null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentItem, selectedType?.id],
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  // Сонгосон ангиллаас (org) нэгжийн шаардлага (reactive)
  const orgId = watch("org");
  const orgObj =
    legalTypes.find((t) => String(t.id) === String(orgId)) || initOrgObj;
  const orgCode = String(orgObj?.code ?? "0"); // 0=нэгжгүй, 1=аймаг, 2=аймаг+сум
  const needAimag = orgCode === "1" || orgCode === "2";
  const needSum = orgCode === "2";

  // Аймаг солигдоход сумыг цэвэрлэх effect нь prefill‑ийг устгахгүйн тулд ref
  const aimagInitRef = useRef(true);

  // Зөвхөн өөр бичлэг рүү шилжихэд (id солигдоход) л reset хийнэ.
  useEffect(() => {
    reset(defaultValues);
    // prefill‑ийн дараа aimag өөрчлөлтийг "анхны" гэж үзэж сумыг цэвэрлэхгүй
    aimagInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id, selectedType?.id]);

  const aimagValue = watch("aimag");

  // Аймаг/Нийслэл ба Сум/Дүүрэг (parent=сонгосон аймаг) сонголтын жагсаалт
  const { units: aimagOptions } = useUnitDropdown(
    "Аймаг/Нийслэл",
    null,
    needAimag,
  );
  const { units: sumOptions } = useUnitDropdown(
    "Сум/Дүүрэг",
    aimagValue?.id,
    needSum && !!aimagValue?.id,
  );

  // Аймаг солигдоход сумыг цэвэрлэнэ — гэхдээ анхны ачаалал (prefill) дээр биш.
  useEffect(() => {
    if (aimagInitRef.current) {
      aimagInitRef.current = false;
      return;
    }
    if (needSum) setValue("sum", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimagValue?.id]);

  const handleDropDocument = useCallback(
    (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) {
        setValue(
          "document",
          Object.assign(file, { preview: URL.createObjectURL(file) }),
          {
            shouldValidate: true,
          },
        );
      }
    },
    [setValue],
  );

  const onSubmit = handleSubmit(
    async (data) => {
      if (!orgObj?.id) {
        enqueueSnackbar("Ангилал сонгоно уу", { variant: "warning" });
        return;
      }
      if (needAimag && !data.aimag?.id) {
        enqueueSnackbar("Аймаг/нийслэл сонгоно уу", { variant: "warning" });
        return;
      }
      if (needSum && !data.sum?.id) {
        enqueueSnackbar("Сум/дүүрэг сонгоно уу", { variant: "warning" });
        return;
      }
      // Хадгалах unit: code 2 → сум, code 1 → аймаг, code 0 → байхгүй
      const unitId = needSum ? data.sum?.id : needAimag ? data.aimag?.id : null;

      const fd = new FormData();
      fd.append("name", data.name || "");
      fd.append("org_id", orgObj.id);
      if (data.type) fd.append("type_id", data.type);
      if (unitId) fd.append("unit_id", unitId);
      fd.append("order_number", data.order_number || "");
      if (data.order_date) {
        const d = new Date(data.order_date);
        fd.append("order_date", d.toISOString().slice(0, 10));
      }
      fd.append("signer", data.signer || "");
      fd.append("description", data.description || "");
      // Бэлтгэл табаас нэмэхэд тухайн төсөлд холбоно
      if (projectId && !currentItem) fd.append("project", projectId);
      if (data.document instanceof File) fd.append("document", data.document);

      const method = currentItem ? "patch" : "post";
      const URL = currentItem
        ? endpoints.legal.edit(currentItem.id)
        : endpoints.legal.create;
      try {
        const response = await axiosInstance[method](URL, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (response.status === 200 || response.status === 201) {
          enqueueSnackbar(
            `Амжилттай ${currentItem ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
          );
          reset();
          onClose();
          refetch && refetch();
        }
      } catch (error) {
        const d = error?.response?.data;
        const msg =
          d?.detail ||
          (d && typeof d === "object" && Object.values(d)?.[0]) ||
          error?.message ||
          "Алдаа гарлаа";
        enqueueSnackbar(Array.isArray(msg) ? msg[0] : msg, {
          variant: "error",
        });
      }
    },
    (errors) => {
      // Validation унавал чимээгүй өнгөрөхгүй — ямар талбар дутууг харуулна
      const first = Object.values(errors || {})[0];
      enqueueSnackbar(first?.message || "Талбаруудыг гүйцэт бөглөнө үү", {
        variant: "warning",
      });
    },
  );

  return (
    <Box
      sx={{
        pl: 2,
        pr: 1.5,
        py: 1.5,
        borderLeft: "4px solid",
        borderColor: "success.main",
        bgcolor: "background.neutral",
        borderRadius: 1,
      }}
    >
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Box
          gap={2}
          display="grid"
          gridTemplateColumns={{ xs: "repeat(1, 1fr)", sm: "repeat(2, 1fr)" }}
          sx={{ pt: 1 }}
        >
          {/* Ангилал (LEGAL_TYPES) — карт сонголтгүй (таб түвшний) нэмэх үед гараар */}
          {!selectedType && !currentItem && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <RHFSelect name="org" label="Ангилал (төрөл)">
                {legalTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.label || t.name}
                  </MenuItem>
                ))}
              </RHFSelect>
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <RHFTextField name="name" label="Нэр" />
            <RHFSelect name="type" label="Төрөл" sx={{ minWidth: { sm: 100 } }}>
              {orderTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </RHFSelect>
          </Stack>

          <Stack flexDirection={{ xs: "column", sm: "row" }} spacing={2}>
            <RHFTextField name="order_number" label="Дугаар" />
            <RHFDatePicker
              name="order_date"
              label="Огноо"
              variant="outlined"
              format="yyyy-MM-dd"
            />
            <RHFTextField name="signer" label="Гарын үсэг (батлагч)" />
          </Stack>

          {needAimag && (
            <RHFAutocomplete
              name="aimag"
              label="Аймаг / Нийслэл"
              options={aimagOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
            />
          )}
          {needSum && (
            <RHFAutocomplete
              name="sum"
              label="Сум / Дүүрэг"
              disabled={!aimagValue?.id}
              options={sumOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
            />
          )}

          <Box sx={{ gridColumn: "1 / -1" }}>
            <RHFTextField
              name="description"
              label="Тайлбар"
              multiline
              rows={3}
            />
          </Box>

          <Box sx={{ gridColumn: "1 / -1" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}></Typography>

            <UploadPDFField
              name="document"
              label="Файл"
              maxSize={20971520}
              accept={{
                "application/pdf": [],
                "image/*": [],
                "application/msword": [],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                  [],
              }}
              onDrop={handleDropDocument}
              onDelete={() => setValue("document", null)}
            />
          </Box>
        </Box>

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
            {currentItem ? "Хадгалах" : "Нэмэх"}
          </LoadingButton>
        </Stack>
      </FormProvider>
    </Box>
  );
}

LegalNewEditForm.propTypes = {
  onClose: PropTypes.func,
  currentItem: PropTypes.object,
  selectedType: PropTypes.object,
  refetch: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
