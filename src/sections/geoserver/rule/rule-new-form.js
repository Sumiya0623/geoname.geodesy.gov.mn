import * as Yup from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo, useEffect, memo } from "react";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import LoadingButton from "@mui/lab/LoadingButton";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { getAxiosErrorMessage } from "src/utils/error-snack";

import FormProvider from "src/components/hook-form";

import { useGetStyleFields } from "src/api/map";
import FilterBuilder from "./blocks/filterbuilder";

// ---------------------------------------------------
// Хурдан (filter-only) дүрэм нэмэх/засах форм.
// layerId нь nameclass leaf id (GEONAME_TYPES Constant id).
// ---------------------------------------------------

export default memo(function RuleQuickForm({
  onCloseForm,
  refetch,
  currentRule,
  layerId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { fields } = useGetStyleFields({ layerId });

  const RuleSchema = Yup.object().shape({
    filters: Yup.array().of(
      Yup.object().shape({
        field: Yup.string().required("Талбар сонгоно уу"),
        operator: Yup.string().required("Нөхцөл сонгоно уу"),
        value: Yup.string().when("operator", {
          is: (op) => !["isnull", "isnotnull"].includes(op),
          then: (schema) => schema.required("Утга шаардлагатай"),
          otherwise: (schema) => schema.notRequired(),
        }),
      })
    ),
  });

  const defaultValues = useMemo(
    () => ({
      filters: currentRule?.filters || [],
      filtersLogic: currentRule?.join_op || "AND",
    }),
    [currentRule]
  );

  const methods = useForm({
    resolver: yupResolver(RuleSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    criteriaMode: "firstError",
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentRule) {
      reset(defaultValues);
    }
  }, [currentRule, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const cleanedFilters = (data.filters || [])
      .filter((f) => f?.field && f?.operator)
      .map((f) => ({
        field: String(f.field),
        operator: String(f.operator).toLowerCase(),
        value: f?.value ?? "",
      }));

    const request_body = {
      layer_id: layerId,
      join_op: data.filtersLogic || "AND",
      filters: cleanedFilters,
    };

    const method = currentRule ? "patch" : "post";
    const URL = currentRule
      ? endpoints.geoserver.style.rule.edit(currentRule?.id)
      : endpoints.geoserver.style.rule.create;

    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Дүрэм амжилттай ${currentRule ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(getAxiosErrorMessage(error), {
        variant: "warning",
      });
    }
  });

  const renderInputs = (
    <Card sx={{ mb: 1 }}>
      <Stack sx={{ p: 2 }}>
        <FilterBuilder fields={fields} disabled={isSubmitting} />
      </Stack>
    </Card>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      {renderInputs}

      <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
        <Button variant="outlined" color="inherit" onClick={onCloseForm}>
          Хаах
        </Button>
        <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
          {currentRule ? "Хадгалах" : "Үүсгэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
});
