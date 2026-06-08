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

import FormProvider, { RHFTextField } from "src/components/hook-form";

import { useGetStyleFields } from "src/api/map";
import FilterBuilder from "./blocks/filterbuilder";

// ---------------------------------------------------

export default memo(function RuleEditForm({
  onCloseForm,
  refetch,
  currentRule,
  layer,
  stId,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { fields } = useGetStyleFields({ layerId: layer?.id });

  // yup schema
  const NewMeasurementSchema = Yup.object().shape({
    name: Yup.string().required("Нэр шаардлагатай"),
    filters: Yup.array().of(
      Yup.object().shape({
        field: Yup.string().required("Талбар сонгоно уу"),
        operator: Yup.string().required("Нөхцөл сонгоно уу"),
        value: Yup.string().when("operator", {
          is: (op) => !["isnull", "isnotnull"].includes(op),
          then: (schema) => schema.required("Утга шаардлагатай"),
          otherwise: (schema) => schema.notRequired(),
        }),
      }),
    ),
  });

  // default values
  const defaultValues = useMemo(
    () => ({
      name: currentRule?.name || "",
      filters: currentRule?.filters || [], // ✅ filter массив
    }),
    [currentRule],
  );

  const methods = useForm({
    resolver: yupResolver(NewMeasurementSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    criteriaMode: "firstError",
  });

  const {
    reset,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentRule) {
      reset(defaultValues);
    }
  }, [currentRule, defaultValues, reset]);

  // submit
  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    const request_body = { ...rest, style_id: stId };

    const method = currentRule ? "patch" : "post";
    const URL = currentRule
      ? endpoints.geoserver.style.rule.edit(rule?.id)
      : endpoints.geoserver.style.rule.create;

    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Тогтмол амжилттай ${currentRule ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
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

  // UI
  const renderInputs = (
    <Card sx={{ mb: 1 }}>
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1.5}
        sx={{ p: 2 }}
      >
        <RHFTextField name="name" label="Rule нэр (ENG)" variant="filled" />
      </Stack>
      <Stack sx={{ p: 2 }}>
        <FilterBuilder
          fields={fields}
          disabled={isSubmitting}
          setValue={setValue}
        />
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
        <LoadingButton
          type="submit"
          variant="contained"
          color="primary"
          loading={isSubmitting}
        >
          {currentRule ? "Хадгалах" : "Үүсгэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
});
