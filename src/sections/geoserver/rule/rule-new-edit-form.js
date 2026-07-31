"use client";

import PropTypes from "prop-types";
import { useMemo, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import Grid from "@mui/material/Unstable_Grid2";
import Stack from "@mui/material/Stack";
import LoadingButton from "@mui/lab/LoadingButton";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import {
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import { getAxiosErrorMessage } from "src/utils/error-snack";
import FormProvider, { RHFSelect } from "src/components/hook-form";

import { useGetStyleFields } from "src/api/map";

import ScaleBlock from "./blocks/scale";
import LineBlock from "./blocks/line";
import StrokeFillBlock from "./blocks/stroke";
import PointBlock from "./blocks/point";
import RasterBlock from "./blocks/raster";
import ReviewBlock from "./blocks/review";

import LabelBlock from "./rule-text";
import PolygonBlock from "./rule-polygon";
import VisibilityBlock from "./rule-visibility";

import buildSchema from "./blocks/schema";
import buildDefaults from "./blocks/defaults";

const SYMBOLIZERS = [
  { value: "point", label: "Point" },
  { value: "line", label: "Line" },
  { value: "polygon", label: "Polygon" },
  { value: "raster", label: "Raster" },
];

export default function RuleNewEditForm({
  onCloseForm,
  refetch,
  currentRule,
  layerId,
}) {
  const { enqueueSnackbar } = useSnackbar();

  // layerId нь nameclass leaf id. stylefields backend нь талбар буцааж болно,
  // буцаахгүй бол filterrow тус бүр өөрөө сонголтоо татна.
  const { fields = [] } = useGetStyleFields({ layerId });

  const Schema = useMemo(() => buildSchema(), []);
  const defaultValues = useMemo(
    () => buildDefaults(currentRule),
    [currentRule],
  );

  const methods = useForm({
    resolver: yupResolver(Schema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    criteriaMode: "firstError",
  });

  const {
    reset,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const renderMode = watch("render_mode", currentRule?.render_mode || "symbol");
  const symbolizer = watch("symbolizer", currentRule?.symbolizer || "point");

  useEffect(() => {
    reset(buildDefaults(currentRule));
    if (!currentRule?.render_mode) {
      setValue("render_mode", "symbol", { shouldDirty: false });
    }
  }, [currentRule, reset, setValue]);

  // -------- submit --------
  const onSubmit = handleSubmit(async (data) => {
    try {
      const fd = new FormData();
      const asNum = (v) => (v === "" || v == null ? "" : String(Number(v)));
      const asStr = (v) => (v == null ? "" : String(v));
      const mode = data.render_mode || "symbol"; // text | symbol | both

      // === 0) Нийтлэг талбарууд ===
      fd.append("layer_id", asStr(layerId));
      fd.append("render_mode", mode);

      // Масштаб / эрэмбэ / нэгтгэх
      fd.append("min_scale_denom", asNum(data.min_scale_denom));
      fd.append("max_scale_denom", asNum(data.max_scale_denom));
      fd.append("opacity", asNum(data.opacity));
      fd.append("z_index", asNum(data.z_index));
      fd.append("order", asNum(data.order));
      fd.append("join_op", asStr(data.filtersLogic || "AND"));
      fd.append("blend_mode", asStr(data.blend_mode || "normal"));

      // vendor_options (JSON)
      if (data.vendor_options && String(data.vendor_options).trim()) {
        fd.append("vendor_options", String(data.vendor_options));
      }

      // Фильтрүүд
      const cleanedFilters = (data.filters || [])
        .filter((f) => f?.field && f?.operator)
        .map((f) => ({
          field: String(f.field),
          operator: String(f.operator).toLowerCase(),
          value: f?.value ?? "",
        }));
      fd.append("filters", JSON.stringify(cleanedFilters));

      const appendSymbol = () => {
        const baseSym = data.symbolizer || "point";
        fd.append("symbolizer", asStr(baseSym));
        fd.append("stroke_color", asStr(data.stroke_color));
        fd.append("stroke_width", asNum(data.stroke_width));
        fd.append("stroke_opacity", asNum(data.stroke_opacity));
        fd.append("stroke_dasharray", asStr(data.stroke_dasharray));
        fd.append("stroke_linecap", asStr(data.stroke_linecap));
        fd.append("stroke_linejoin", asStr(data.stroke_linejoin));
        fd.append("fill_color", asStr(data.fill_color));
        fd.append("fill_opacity", asNum(data.fill_opacity));
        fd.append("size", asNum(data.size));
        if (data.icon instanceof File) fd.append("icon", data.icon);
        fd.append("rotation", asNum(data.rotation));
      };

      const appendText = () => {
        fd.append("text_field", asStr(data.text_field));
        fd.append("text_size", asNum(data.text_size));
        fd.append("text_color", asStr(data.text_color));
        fd.append("text_font_family", asStr(data.text_font_family));
        fd.append("text_font_style", asStr(data.text_font_style));
        fd.append("text_font_weight", asStr(data.text_font_weight));
        fd.append("text_halo_color", asStr(data.text_halo_color));
        fd.append("text_halo_radius", asNum(data.text_halo_radius));
        fd.append("text_halo_opacity", asNum(data.text_halo_opacity));
        fd.append("text_anchor", asStr(data.text_anchor));
        fd.append("text_displacement_x", asNum(data.text_displacement_x));
        fd.append("text_displacement_y", asNum(data.text_displacement_y));
        fd.append("text_rotation", asNum(data.text_rotation));
      };

      // === 1) render_mode-аас хамаарах салаалалт ===
      switch (mode) {
        case "text": {
          fd.append("symbolizer", "text");
          appendText();
          break;
        }
        case "symbol": {
          appendSymbol();
          break;
        }
        case "both":
        default: {
          appendSymbol();
          appendText();
          break;
        }
      }

      // === 2) Илгээх ===
      const method = currentRule ? "put" : "post";
      const URL = currentRule
        ? endpoints.geoserver.style.rule.edit(currentRule?.id)
        : endpoints.geoserver.style.rule.create;

      const res = await axiosInstance[method](URL, fd);
      if (res?.status === 200 || res?.status === 201) {
        enqueueSnackbar(
          `Дүрэм амжилттай ${currentRule ? "хадгалагдлаа" : "үүсгэлээ"}`,
        );
        onCloseForm?.();
        refetch?.();
      }
    } catch (err) {
      enqueueSnackbar(getAxiosErrorMessage(err), { variant: "warning" });
    }
  });

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={1.5}>
        <Grid xs={12}>
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Үндсэн мэдээлэл
            </Typography>
            <Divider sx={{ borderStyle: "dashed" }} />
            {/* CQL шүүлтийн оронд масштабын муж — муж бүрд өөр style. */}
            <Grid xs={12} spacing={1.5}>
              <ScaleBlock />
            </Grid>
            <Grid xs={12}>
              <FormControl>
                <FormLabel sx={{ mb: 1 }}>Дүрмийн төрөл</FormLabel>
                <Controller
                  name="render_mode"
                  control={methods.control}
                  defaultValue={currentRule?.render_mode || "symbol"}
                  render={({ field }) => (
                    <RadioGroup row {...field}>
                      <FormControlLabel
                        value="text"
                        control={<Radio />}
                        label="Зөвхөн Text"
                      />
                      <FormControlLabel
                        value="symbol"
                        control={<Radio />}
                        label="Зөвхөн Symbol"
                      />
                      <FormControlLabel
                        value="both"
                        control={<Radio />}
                        label="Symbol + Text"
                      />
                    </RadioGroup>
                  )}
                />
              </FormControl>
            </Grid>
            {(renderMode === "symbol" || renderMode === "both") && (
              <Grid xs={12} md={6}>
                <RHFSelect
                  name="symbolizer"
                  label="Геометрийн төрөл"
                  variant="filled"
                >
                  {SYMBOLIZERS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </RHFSelect>
              </Grid>
            )}
          </Stack>
        </Grid>

        <Grid xs={12}>
          <VisibilityBlock />
        </Grid>

        <Grid xs={12} md={6}>
          {(renderMode === "symbol" || renderMode === "both") &&
            symbolizer === "polygon" && <PolygonBlock />}
          {(renderMode === "symbol" || renderMode === "both") &&
            symbolizer === "polygon" && <StrokeFillBlock />}
          {(renderMode === "symbol" || renderMode === "both") &&
            symbolizer === "line" && <LineBlock />}
          {(renderMode === "symbol" || renderMode === "both") &&
            symbolizer === "point" && <PointBlock />}
          {(renderMode === "symbol" || renderMode === "both") &&
            symbolizer === "raster" && <RasterBlock />}
        </Grid>

        <Grid xs={12}>
          {(renderMode === "text" || renderMode === "both") && (
            <LabelBlock attributes={fields} />
          )}
        </Grid>

        <Grid
          xs={12}
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          gap={1.5}
        >
          <Button variant="outlined" color="inherit" onClick={onCloseForm}>
            Хаах
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            color="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {currentRule ? "Хадгалах" : "Үүсгэх"}
          </LoadingButton>
        </Grid>

        <Grid xs={12}>
          <ReviewBlock symbolizer={symbolizer} />
        </Grid>
      </Grid>
    </FormProvider>
  );
}

RuleNewEditForm.propTypes = {
  currentRule: PropTypes.object,
  onCloseForm: PropTypes.func,
  refetch: PropTypes.func,
  layerId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
