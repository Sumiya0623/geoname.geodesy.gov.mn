import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import { Box, Button, Divider, MenuItem } from "@mui/material";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";

import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFSelect,
  RHFTextField,
} from "src/components/hook-form";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------

export default function SubUnitNewEditForm({
  currentUnit,
  onCloseForm,
  refetch,
  childunits,
}) {
  const { constants: geomtypes } =
    useGetConstantsFordropdown("GEONAME_GEOMTYPES");
  const { enqueueSnackbar } = useSnackbar();
  const NewConstantSchema = Yup.object().shape({
    name: Yup.string().required(requiredMsg),
    code: Yup.string().nullable(),
    description: Yup.string().nullable(),
    geomtype: Yup.mixed().nullable(),
    parent: Yup.mixed().nullable(),
  });
  const defaultValues = useMemo(
    () => ({
      id: currentUnit?.id || "",
      name: currentUnit?.name || "",
      code: currentUnit?.code || "",
      description: currentUnit?.description || "",
      geomtype: currentUnit?.geomtype || "",
      parent: currentUnit?.parent || null,
    }),
    [currentUnit]
  );

  const methods = useForm({
    resolver: yupResolver(NewConstantSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    if (currentUnit) {
      reset(defaultValues);
    }
  }, [currentUnit, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    const request_body = { ...rest };
    const method = currentUnit ? "patch" : "post";
    const URL = currentUnit ? endpoints.level.edit(id) : endpoints.level.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Ангилал амжилттай ${currentUnit ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(
        `Ангилалыг ${currentUnit ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        }
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
          md: "repeat(5, 1fr)",
        }}
      >
        <RHFTextField name="name" label="Нэр" variant="filled" />

        {childunits && (
          <RHFSelect name="parent" label="Харъяа" variant="filled">
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              None
            </MenuItem>

            <Divider sx={{ borderStyle: "dashed" }} />

            {childunits.map((level) => (
              <MenuItem key={level.id} value={`${level.id}`}>
                {level.name}
              </MenuItem>
            ))}
          </RHFSelect>
        )}
        <RHFTextField name="description" label="Path/Desc" variant="filled" />
        <RHFTextField name="code" label="Code" variant="filled" />
        <RHFSelect name="geomtype" label="Геометр" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>

          <Divider sx={{ borderStyle: "dashed" }} />

          {geomtypes.map((status) => (
            <MenuItem key={status.id} value={`${status.id}`}>
              {status.name}
            </MenuItem>
          ))}
        </RHFSelect>
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mt: 2 }}
        spacing={1.5}
      >
        <Button variant="outlined" color="inherit" onClick={onCloseForm}>
          Хаах
        </Button>

        <LoadingButton
          type="submit"
          color="primary"
          variant="contained"
          loading={isSubmitting}
          disabled={!isDirty}
        >
          {currentUnit ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}

SubUnitNewEditForm.propTypes = {
  currentUnit: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  childunits: PropTypes.array,
};
