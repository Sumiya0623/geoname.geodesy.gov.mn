import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";
import FormControlLabel from "@mui/material/FormControlLabel";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { useGetConstantsFordropdown } from "src/api/constant";

import FormProvider, {
  RHFSelect,
  RHFSwitch,
} from "src/components/hook-form";
import { Button } from "@mui/material";
import { getAxiosErrorMessage } from "src/utils/error-snack";

export default function LayerNewEditForm({
  onCloseForm,
  refetch,
  currentLayer,
  stId
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { constants: tables } = useGetConstantsFordropdown("GeomDatas");
  const { constants: stores } = useGetConstantsFordropdown("STORES");
  const NewLayerSchema = Yup.object().shape({
    is_published: Yup.boolean(),
    is_raster: Yup.boolean(),
    table: Yup.mixed().required("Давхарга"),
    store: Yup.mixed().required("Store"),
  });

  const defaultValues = useMemo(() => {
    return {
      is_published: currentLayer?.is_published,
      is_raster: currentLayer?.is_raster,
      table: currentLayer?.table?.id || "",
      store: currentLayer?.store?.id || stId || "",
    };
  }, [currentLayer]);

  const methods = useForm({
    resolver: yupResolver(NewLayerSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    criteriaMode: "firstError",
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
    watch
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    const { id, ...rest } = data;
    const request_body = { ...rest };
    const method = currentLayer ? "patch" : "post";
    const URL = currentLayer
      ? endpoints.geoserver.layer.edit(currentLayer?.id)
      : endpoints.geoserver.layer.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Давхарга амжилттай ${currentLayer ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (error) {
      enqueueSnackbar(getAxiosErrorMessage(error), {
        variant: "warning", // эсвэл "error" – таны UX-с хамаарна
      });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Typography
        variant="subtitle2"
        sx={{ color: "text.primary", fontWeight: 600 }}
      >
        Давхаргын мэдээлэл
      </Typography>
      <Box
        gap={3}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
        }}
      >
        <RHFSelect name="store" label="Store" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>

          <Divider sx={{ borderStyle: "dashed" }} />

          {stores.map((layer) => (
            <MenuItem key={layer.id} value={`${layer.id}`}>
              {layer.name}
            </MenuItem>
          ))}
        </RHFSelect>
        <RHFSelect name="table" label="Table" variant="filled">
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            None
          </MenuItem>
          <Divider sx={{ borderStyle: "dashed" }} />
          {tables.map((layer) => (
            <MenuItem key={layer.id} value={`${layer.id}`}>
              {layer.name}
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
        <FormControlLabel
          control={<RHFSwitch name="is_raster" />}
          label="Raster"
          sx={{ ml: 0 }}
        />

        <FormControlLabel
          control={<RHFSwitch name="is_published" />}
          label="Идэвхитэй эсэх"
          sx={{ ml: 0 }}
        />
      </Stack>
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
          {currentLayer ? "Өөрчлөх" : "Нэмэх"}
        </LoadingButton>
      </Stack>
    </FormProvider>
  );
}

LayerNewEditForm.propTypes = {
  currentLayer: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
};
