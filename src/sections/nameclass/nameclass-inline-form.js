import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button, Stack, MenuItem } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useGetConstantsFordropdown } from "src/api/constant";
import FormProvider, {
  RHFSelect,
  RHFSwitch,
  RHFTextField,
} from "src/components/hook-form";

// ----------------------------------------------------------------------
// Дэвсгэр нэрийн дэд ангилал нэмэх / засах inline форм.
// level — тухайн бичлэгийн түвшин (1, 2, 3). Зөвхөн 3‑р (анхдагч) түвшинд
// геометр төрлийг (GEOM_TYPES) сонгож desc‑д хадгална. 1,2‑т зөвхөн нэр, код.
// ----------------------------------------------------------------------

export default function NameClassInlineForm({
  currentItem = null,
  parentId = null,
  parentKey = "GEONAME_TYPES",
  level = 2,
  onCancel,
  onSaved,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const showGeom = Number(level) === 3;
  const { constants: geomTypes } = useGetConstantsFordropdown("GEOM_TYPES");

  const Schema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    code: Yup.string().nullable(),
    desc: showGeom
      ? Yup.string().nullable().required("Геометр төрөл сонгоно уу")
      : Yup.string().nullable(),
  });

  const defaultValues = useMemo(
    () => ({
      id: currentItem?.id || "",
      name: currentItem?.name || "",
      code: currentItem?.code || "",
      desc: currentItem?.desc || "",
      // Level‑3 навч — GeoServer view идэвхтэй эсэх. Засахад одоогийн төлвөөр
      // (gs_exists), шинэ навчид анхдагчаар идэвхтэй.
      is_active: currentItem ? !!currentItem.gs_exists : true,
    }),
    [currentItem]
  );

  const methods = useForm({ resolver: yupResolver(Schema), defaultValues });
  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    const request_body = {
      ...rest,
      // Геометр зөвхөн 3‑р түвшинд; бусдад desc хоосон
      desc: showGeom ? data.desc : "",
      // is_active зөвхөн 3‑р түвшний навчид утгатай (GeoServer view үүсгэх/устгах)
      is_active: showGeom ? !!data.is_active : false,
      key: currentItem?.key || parentKey || "GEONAME_TYPES",
      parent_id: currentItem?.parent ?? (parentId !== null ? parentId : null),
    };
    const method = currentItem ? "patch" : "post";
    const URL = currentItem
      ? endpoints.nameclass.edit(id)
      : endpoints.nameclass.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Ангилал амжилттай ${currentItem ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        onSaved && onSaved(response.data);
        reset();
      }
    } catch (error) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.name?.[0] ||
        error?.message;
      enqueueSnackbar(
        detail || `Ангилал ${currentItem ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        { variant: status && status < 500 ? "warning" : "error" }
      );
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Box
        gap={2}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
          md: showGeom ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
        }}
        sx={{ mb: 1 }}
      >
        <RHFTextField name="name" label="Нэр" size="small" variant="filled" />
        <RHFTextField name="code" label="Код" size="small" variant="filled" />
        {showGeom && (
          <RHFSelect
            name="desc"
            label="Геометр төрөл"
            size="small"
            variant="filled"
          >
            <MenuItem value="">—</MenuItem>
            {geomTypes.map((g) => (
              <MenuItem key={g.id} value={g.name}>
                {g.name}
              </MenuItem>
            ))}
          </RHFSelect>
        )}
      </Box>
      {showGeom && (
        <RHFSwitch
          name="is_active"
          label="GeoServer view идэвхтэй (geoname workspace‑д үүсгэх)"
          sx={{ mb: 1 }}
        />
      )}
      <Stack direction="row" spacing={1} justifyContent="flex-start">
        <LoadingButton
          type="submit"
          size="small"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={!isDirty}
        >
          {currentItem ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
        <Button size="small" variant="outlined" color="inherit" onClick={onCancel}>
          Буцах
        </Button>
      </Stack>
    </FormProvider>
  );
}

NameClassInlineForm.propTypes = {
  currentItem: PropTypes.object,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  parentKey: PropTypes.string,
  level: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onCancel: PropTypes.func,
  onSaved: PropTypes.func,
};
