import * as Yup from "yup";
import useSWR from "swr";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useRef, useMemo, useEffect, useCallback } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Stack, Button, MenuItem, Divider } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import { toApiDate, parseApiDate } from "src/utils/format-time";
import { useGetLegalLevels } from "src/api/legal";
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
  selectedLevel = null,
  refetch,
  projectId = null,
}) {
  const { enqueueSnackbar } = useSnackbar();

  // govlevel = LEGAL_LEVELS (карт/түвшин, нэгж кодтой — «Дээд тогтоол»)
  // org      = LEGAL_ORGS  (баримтыг гаргасан байгууллага)
  // type     = ORDER_TYPES (баримтын төрөл)
  const { legalLevels } = useGetLegalLevels();
  const { constants: legalOrgs } = useGetConstantsFordropdown("LEGAL_ORGS");
  const { constants: orderTypes } = useGetConstantsFordropdown("ORDER_TYPES");

  // Түвшний ЗЗ нэгжийн шаардлага — Constant.code‑ийн ЭХНИЙ ОРНООС:
  //   0x (01, 02…) = нэгжгүй (улсын түвшин)
  //   1x (10, 11…) = аймаг/нийслэл
  //   2x (20, 21…) = аймаг + сум/дүүрэг
  // Ингэснээр үлдсэн оронг нь эрэмбэлэхэд чөлөөтэй ашиглана («01…06, 10, 20»).
  // Хуучин ганц оронтой ('1','2') код мөн адил ажиллана. Code огт байхгүй бол
  // Constant.desc‑ээс (0/1/2) уншина.
  const unitCode = (c) => {
    const first = String(c?.code ?? "").trim().charAt(0);
    if (["0", "1", "2"].includes(first)) return first;
    const d = String(c?.desc ?? "").trim();
    return ["0", "1", "2"].includes(d) ? d : "0";
  };

  // Анхны (prefill) түвшин — засах үед бичлэгийн govlevel, нэмэх үед сонгосон карт
  const initLevelObj = currentItem?.govlevel || selectedLevel;
  const initCode = unitCode(initLevelObj);

  const Schema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    govlevel: Yup.mixed().nullable(),
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
      govlevel: currentItem?.govlevel?.id || selectedLevel?.id || "",
      org: currentItem?.org?.id || "",
      type: currentItem?.type?.id || "",
      order_number: currentItem?.order_number || "",
      // «YYYY‑MM‑DD»‑ийг ОРОН НУТГИЙН шөнө дунд болгож уншина (UTC биш) —
      // эс бөгөөс цагийн бүсийн улмаас нэг хоног зөрнө.
      order_date: parseApiDate(currentItem?.order_date),
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
    [currentItem, selectedLevel?.id],
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  // Сонгосон түвшнээс (govlevel) нэгжийн шаардлага (reactive)
  const levelId = watch("govlevel");
  const levelObj =
    legalLevels.find((t) => String(t.id) === String(levelId)) || initLevelObj;
  const levelCode = unitCode(levelObj); // 0=нэгжгүй, 1=аймаг, 2=аймаг+сум
  const needAimag = levelCode === "1" || levelCode === "2";
  const needSum = levelCode === "2";
  // Байгууллага (LEGAL_ORGS) — зөвхөн нэгжтэй түвшинд (аймаг/сум). 0x кодтой
  // улсын түвшний шийдвэрт (УИХ/ЗГ/Зөвлөл…) түвшин нь өөрөө байгууллага.
  const needOrg = levelCode !== "0";

  // Аймаг солигдоход сумыг цэвэрлэх effect нь prefill‑ийг устгахгүйн тулд ref
  const aimagInitRef = useRef(true);

  // Зөвхөн өөр бичлэг рүү шилжихэд (id солигдоход) л reset хийнэ.
  useEffect(() => {
    reset(defaultValues);
    // prefill‑ийн дараа aimag өөрчлөлтийг "анхны" гэж үзэж сумыг цэвэрлэхгүй
    aimagInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem?.id, selectedLevel?.id]);

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
      if (!levelObj?.id) {
        enqueueSnackbar("Дээд тогтоол (түвшин) сонгоно уу", {
          variant: "warning",
        });
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
      fd.append("govlevel_id", levelObj.id);
      if (needOrg && data.org) fd.append("org_id", data.org);
      if (data.type) fd.append("type_id", data.type);
      if (unitId) fd.append("unit_id", unitId);
      fd.append("order_number", data.order_number || "");
      // Огноог ОРОН НУТГИЙН он/сар/өдрөөр нь илгээнэ. Өмнө нь toISOString()
      // ашигладаг байсан нь UTC руу хөрвүүлж (+8/+9) нэг хоног зөрүүлдэг байв.
      const apiDate = toApiDate(data.order_date);
      if (apiDate) fd.append("order_date", apiDate);
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
          // Үүссэн/засагдсан бичлэгийг эцэгт дамжуулна (ж: сонгогч дээр
          // шинээр бүртгээд ШУУД сонгоход хэрэглэнэ)
          refetch && refetch(response.data);
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
          {/* Дээд тогтоол (LEGAL_LEVELS) — карт сонголтгүй (таб түвшний)
              нэмэх үед гараар. Энэ нь ЗЗ нэгжийн шаардлагыг (code) заана. */}
          {!selectedLevel && !currentItem && (
            <Box sx={{ gridColumn: "1 / -1" }}>
              <RHFSelect name="govlevel" label="Дээд тогтоол (түвшин)">
                {legalLevels.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.label || t.name}
                  </MenuItem>
                ))}
              </RHFSelect>
            </Box>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <RHFTextField name="name" label="Нэр" />
          </Stack>

          <Stack flexDirection={{ xs: "column", sm: "row" }} spacing={2}>
            <RHFSelect
              name="type"
              label="Шийдвэрийн төрөл"
              sx={{ minWidth: { sm: 100 } }}
            >
              {orderTypes.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </RHFSelect>
            <RHFTextField name="order_number" label="Дугаар" />
            <RHFDatePicker
              name="order_date"
              label="Огноо"
              variant="outlined"
              format="yyyy-MM-dd"
            />
          </Stack>

          {needAimag && (
            <RHFAutocomplete
              name="aimag"
              label="Аймаг"
              options={aimagOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
            />
          )}
          {needSum && (
            <RHFAutocomplete
              name="sum"
              label="Сум"
              disabled={!aimagValue?.id}
              options={sumOptions}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
            />
          )}

          <Box sx={{ gridColumn: "1 / -1" }}>
            <RHFTextField
              name="description"
              label="Товч агуулга"
              multiline
              rows={3}
            />
          </Box>
          {/* Байгууллага + Баталсан + Файл — НЭГ мөрөнд (энэ дараалалаар).
              Байгууллага (LEGAL_ORGS) нь зөвхөн нэгжтэй түвшинд (1x=аймаг,
              2x=аймаг+сум) хэрэгтэй; 0x кодтой улсын түвшинд (УИХ, ЗГ,
              Зөвлөл…) түвшин нь өөрөө байгууллага тул сонгуулахгүй. */}
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              {needOrg && (
                <RHFSelect name="org" label="Байгууллага" sx={{ flex: 1 }}>
                  <MenuItem value="">—</MenuItem>
                  {legalOrgs.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.label || c.name}
                    </MenuItem>
                  ))}
                </RHFSelect>
              )}
              <RHFTextField
                name="signer"
                label="Баталсан /Гарын үсэг/"
                sx={{ flex: 1 }}
              />
              <Box sx={{ flex: 1 }}>
                <UploadPDFField
                  size="small"
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
            </Stack>
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
  selectedLevel: PropTypes.object,
  refetch: PropTypes.func,
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
