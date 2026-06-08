import * as Yup from "yup";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo, useState, useEffect, useCallback, memo, useRef } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Unstable_Grid2";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";

import { AnimatePresence, m } from "framer-motion";

import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import FormProvider, {
  RHFSelect,
  RHFTextField,
} from "src/components/hook-form";
import { Button } from "@mui/material";

const createTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default memo(function GroupNewEditForm({
  onCloseForm,
  refetch,
  currentGroup,
}) {
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [stylesForFeatures, setStylesForFeatures] = useState({});
  const [collapsedItems, setCollapsedItems] = useState(() => new Set());

  const { enqueueSnackbar } = useSnackbar();

  const fetchStylesForFeature = useCallback(
    async (featureId) => {
      if (!featureId || stylesForFeatures[featureId])
        return stylesForFeatures[featureId] || [];

      try {
        const response = await axiosInstance.get(
          endpoints.geoserver.style.list(`layer=${featureId}`),
        );
        const styles = response.data.results || response.data;

        setStylesForFeatures((prev) => ({
          ...prev,
          [featureId]: styles,
        }));

        return styles;
      } catch (error) {
        console.error("Error fetching styles for layer:", error);
        return [];
      }
    },
    [stylesForFeatures],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const featuresResponse = await axiosInstance.get(
          endpoints.geoserver.layer.list(""),
        );
        setAvailableFeatures(
          featuresResponse.data.results || featuresResponse.data,
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const LayerGroupSchema = Yup.object().shape({
    name: Yup.string().required("Группын нэр шаардлагатай"),
    items: Yup.array().of(
      Yup.object().shape({
        layer_id: Yup.mixed().required("Давхарга сонгоно уу"),
        // style: Yup.number().nullable(),
        order: Yup.number().min(0, "Эрэмбэ 0-ээс дээш байх ёстой"),
        visible: Yup.boolean(),
        // opacity: Yup.number().min(0).max(1, "Opacity 0-1 хооронд байх ёстой"),
        // z_index: Yup.number(),
      }),
    ),
  });

  const defaultValues = useMemo(() => {
    return {
      name: currentGroup?.name || "",
      items:
        currentGroup?.items?.map((item, index) => ({
          id: item.id,
          layer_id: item?.layer?.id,
          // style: item.style,
          order: typeof item.order === "number" ? item.order : index,
          visible: item.visible !== false,
          // opacity: item.opacity || 1.0,
          // z_index: item.z_index || 0,
          uid: item.id ? `persist-${item.id}` : createTempId(),
        })) || [],
    };
  }, [currentGroup]);

  const methods = useForm({
    resolver: yupResolver(LayerGroupSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });
  const {
    control,
    reset,
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting, errors },
    trigger,
  } = methods;

  const {
    fields,
    append,
    remove: removeField,
    swap,
  } = useFieldArray({
    control,
    name: "items",
  });

  const hasInitializedCollapse = useRef(false);

  const handleFeatureChange = useCallback(
    async (itemIndex, featureId) => {
      setValue(`items.${itemIndex}.layer_id`, featureId);

      // setValue(`items.${itemIndex}.style`, null);

      if (featureId) {
        await fetchStylesForFeature(featureId);
      }
    },
    [fetchStylesForFeature, setValue],
  );
  const itemsData = watch("items");

  const allCollapsed = useMemo(() => {
    const total = fields.length;
    if (total === 0) {
      return false;
    }
    return collapsedItems.size === total;
  }, [collapsedItems, fields.length]);

  useEffect(() => {
    if (currentGroup) {
      reset(defaultValues);
    }
    hasInitializedCollapse.current = false;
  }, [currentGroup, defaultValues, reset]);

  useEffect(() => {
    if (currentGroup?.items) {
      const featureIds = [
        ...new Set(
          currentGroup.items.map((item) => item.layer_id).filter(Boolean),
        ),
      ];
      featureIds.forEach((featureId) => {
        fetchStylesForFeature(featureId);
      });
    }
  }, [currentGroup, fetchStylesForFeature]);

  useEffect(() => {
    const existingUids = new Set(
      fields
        .map((field, index) => {
          const item = itemsData?.[index] || field;
          return (
            item?.uid ||
            field?.uid ||
            (item?.id ? `persist-${item.id}` : field?.id || null)
          );
        })
        .filter(Boolean),
    );

    setCollapsedItems((prev) => {
      if (existingUids.size === prev.size) {
        let identical = true;
        prev.forEach((uid) => {
          if (!existingUids.has(uid)) {
            identical = false;
          }
        });
        if (identical) {
          return prev;
        }
      }

      const next = new Set();
      existingUids.forEach((uid) => {
        if (prev.has(uid)) {
          next.add(uid);
        }
      });
      return next;
    });
  }, [fields, itemsData]);

  useEffect(() => {
    if (hasInitializedCollapse.current) {
      return;
    }

    const initialUids = fields
      .map((field, index) => {
        const item = itemsData?.[index] || field;
        return (
          item?.uid ||
          field?.uid ||
          (item?.id ? `persist-${item.id}` : field?.id || null)
        );
      })
      .filter(Boolean);

    if (initialUids.length === 0) {
      return;
    }

    hasInitializedCollapse.current = true;
    setCollapsedItems(new Set(initialUids));
  }, [fields, itemsData]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const { name, items } = data;

      const method = currentGroup ? "put" : "post";
      const URL = currentGroup
        ? endpoints.geoserver.group.edit(currentGroup?.id)
        : endpoints.geoserver.group.create;

      const response = await axiosInstance[method](URL, {
        name,
        items: items.map((item, idx) => ({
          id: item.id,
          layer_id: item.layer_id,
          // style: item.style || null,
          order: idx,
          visible: item.visible,
          // opacity: item.opacity,
          // z_index: item.z_index,
        })),
      });

      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Layer Group амжилттай ${currentGroup ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        d?.detail ||
        d?.error ||
        d?.error?.message ||
        d?.result ||
        (typeof d?.errors === "string"
          ? d.errors
          : Array.isArray(d?.errors)
            ? d.errors.join("\n")
            : err.message || "Алдаа гарлаа");

      enqueueSnackbar(msg, {
        variant: err?.response?.status === 400 ? "error" : "warning",
      });
    }
  });

  const handleAddItem = () => {
    append(
      {
        layer_id: "",
        visible: true,
        uid: createTempId(),
      },
      { shouldFocus: false },
    );
  };

  const handleRemoveItem = (index) => {
    const currentItems = itemsData || [];
    const itemToRemove = currentItems[index];
    removeField(index);
    if (itemToRemove?.uid || itemToRemove?.id) {
      const targetUid = itemToRemove?.uid || `persist-${itemToRemove.id}`;
      setCollapsedItems((prev) => {
        if (!prev.has(targetUid)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
    }
  };

  const handleMoveItemUp = (index) => {
    if (index === 0) return;
    swap(index, index - 1);
  };

  const handleMoveItemDown = (index) => {
    if (index === fields.length - 1) return;
    swap(index, index + 1);
  };

  const toggleItemCollapse = (uid) => {
    if (!uid) return;
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    const allUids = fields
      .map((field, index) => {
        const item = itemsData?.[index] || field;
        return (
          item?.uid ||
          field?.uid ||
          (item?.id ? `persist-${item.id}` : field?.id || null)
        );
      })
      .filter(Boolean);
    if (allCollapsed) {
      setCollapsedItems(new Set());
    } else {
      setCollapsedItems(new Set(allUids));
    }
  };

  const renderGroupDetails = (
    <Card>
      <Stack spacing={3} sx={{ p: 3 }}>
        <Typography
          variant="h6"
          sx={{ color: "text.primary", fontWeight: 600 }}
        >
          Layer Group мэдээлэл
        </Typography>
        <RHFTextField
          name="name"
          label="Групын нэр"
          variant="filled"
          required
        />
      </Stack>
    </Card>
  );

  const renderLayerItems = (
    <Card>
      <Stack spacing={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h6"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            Layer Items
          </Typography>
          <Stack direction="row" spacing={1}>
            {fields.length > 0 && (
              <Button
                variant="outlined"
                startIcon={
                  <Iconify
                    icon={
                      allCollapsed
                        ? "eva:expand-outline"
                        : "eva:collapse-outline"
                    }
                  />
                }
                onClick={handleCollapseAll}
              >
                {allCollapsed ? "Бүгдийг нээх" : "Бүгдийг хаах"}
              </Button>
            )}
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={handleAddItem}
            >
              нэмэх
            </Button>
          </Stack>
        </Box>

        {fields.length > 0 ? (
          <Stack spacing={2}>
            <AnimatePresence initial={false}>
              {fields.map((field, index) => {
                const item = itemsData?.[index] || field;
                const itemUid =
                  item?.uid ||
                  field?.uid ||
                  (item?.id
                    ? `persist-${item.id}`
                    : field?.id || `item-${index}`);
                const isCollapsed = collapsedItems.has(itemUid);
                const matchedFeature = item
                  ? availableFeatures?.find(
                      (f) => String(f.id) === String(item.layer_id),
                    )
                  : null;
                const featureLabel = item
                  ? matchedFeature?.title ||
                    matchedFeature?.table?.name ||
                    (item.layer_id ? `Feature ${item.layer_id}` : "No Feature")
                  : "No Feature";

                return (
                  <m.div
                    key={itemUid}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      },
                      duration: 0.2,
                    }}
                  >
                    <Card variant="outlined" sx={{ overflow: "hidden" }}>
                      <Box sx={{ p: 2 }}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box display="flex" alignItems="center" gap={1}>
                            <Stack direction="row" spacing={0.5}>
                              <IconButton
                                size="small"
                                onClick={() => handleMoveItemUp(index)}
                                disabled={index === 0}
                                sx={{
                                  bgcolor:
                                    index === 0
                                      ? "grey.100"
                                      : "primary.lighter",
                                  "&:hover": {
                                    bgcolor:
                                      index === 0
                                        ? "grey.100"
                                        : "primary.light",
                                  },
                                }}
                              >
                                <Iconify icon="eva:arrow-up-fill" width={16} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleMoveItemDown(index)}
                                disabled={index === fields.length - 1}
                                sx={{
                                  bgcolor:
                                    index === fields.length - 1
                                      ? "grey.100"
                                      : "primary.lighter",
                                  "&:hover": {
                                    bgcolor:
                                      index === fields.length - 1
                                        ? "grey.100"
                                        : "primary.light",
                                  },
                                }}
                              >
                                <Iconify
                                  icon="eva:arrow-down-fill"
                                  width={16}
                                />
                              </IconButton>
                            </Stack>
                            <Button
                              size="small"
                              onClick={() => toggleItemCollapse(itemUid)}
                              startIcon={
                                <Iconify
                                  icon={
                                    isCollapsed
                                      ? "mingcute:eye-line"
                                      : "mingcute:eye-close-line"
                                  }
                                  width={16}
                                />
                              }
                              sx={{
                                borderRadius: "999px",
                                px: 1.5,
                                py: 0.25,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                lineHeight: 1.2,
                                textTransform: "none",
                                background: (theme) =>
                                  isCollapsed
                                    ? theme.palette.primary.lighter
                                    : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.main} 100%)`,
                                color: (theme) =>
                                  isCollapsed
                                    ? theme.palette.primary.darker
                                    : theme.palette.common.white,
                                boxShadow: (theme) =>
                                  isCollapsed ? "none" : theme.shadows[4],
                                transition: "all 0.3s ease",
                                "&:hover": {
                                  background: (theme) =>
                                    isCollapsed
                                      ? theme.palette.primary.light
                                      : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.info.dark} 100%)`,
                                  boxShadow: (theme) =>
                                    isCollapsed
                                      ? theme.shadows[1]
                                      : theme.shadows[6],
                                },
                              }}
                            >
                              {isCollapsed ? "Дэлгэрэнгүй" : "Хураангуй"}
                            </Button>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                            >
                              Item #{index + 1}
                            </Typography>
                            {/* Show layer_id info when collapsed */}
                            {isCollapsed && item && (
                              <Box
                                sx={{
                                  ml: 2,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Chip
                                  label={featureLabel}
                                  size="small"
                                  color={item.layer_id ? "primary" : "default"}
                                  variant="outlined"
                                />
                                {item.style && (
                                  <Chip
                                    label={
                                      stylesForFeatures[item.layer_id]?.find(
                                        (s) =>
                                          String(s.id) === String(item.style),
                                      )?.style_name || `Style ${item.style}`
                                    }
                                    size="small"
                                    color="secondary"
                                    variant="outlined"
                                  />
                                )}
                                <Chip
                                  label={
                                    item.visible !== false
                                      ? "Харагдах"
                                      : "Харагдахгүй"
                                  }
                                  size="small"
                                  color={
                                    item.visible !== false ? "success" : "error"
                                  }
                                  variant="filled"
                                  sx={{ minWidth: 60 }}
                                />
                              </Box>
                            )}
                          </Box>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Iconify icon="mingcute:delete-2-line" width={16} />
                          </IconButton>
                        </Box>

                        <Collapse in={!isCollapsed} timeout="auto">
                          <Box sx={{ mt: 2 }}>
                            <Stack spacing={2}>
                              <Box
                                gap={2}
                                display="grid"
                                gridTemplateColumns={{
                                  xs: "repeat(1, 1fr)",
                                  sm: "repeat(2, 1fr)",
                                }}
                              >
                                <RHFSelect
                                  name={`items.${index}.layer_id`}
                                  label="Feature"
                                  variant="filled"
                                  required
                                  onChange={(e) => {
                                    handleFeatureChange(index, e.target.value);
                                  }}
                                >
                                  <MenuItem
                                    value=""
                                    sx={{
                                      fontStyle: "italic",
                                      color: "text.secondary",
                                    }}
                                  >
                                    Feature сонгоно уу
                                  </MenuItem>
                                  <Divider sx={{ borderStyle: "dashed" }} />
                                  {availableFeatures?.map((layer_id) => (
                                    <MenuItem
                                      key={layer_id.id}
                                      value={layer_id.id}
                                    >
                                      {layer_id.title ||
                                        layer_id.table?.name ||
                                        `Feature ${layer_id.id}`}
                                    </MenuItem>
                                  ))}
                                </RHFSelect>

                                {/* <RHFSelect
                              name={`items.${index}.style`}
                              label="Style"
                              variant="filled"
                              disabled={!watch(`items.${index}.layer_id`)}
                            >
                              <MenuItem
                                value=""
                                sx={{
                                  fontStyle: "italic",
                                  color: "text.secondary",
                                }}
                              >
                                {!watch(`items.${index}.layer_id`)
                                  ? "Эхлээд layer_id сонгоно уу"
                                  : "Style сонгоно уу (сонголт)"}
                              </MenuItem>
                              <Divider sx={{ borderStyle: "dashed" }} />
                              {stylesForFeatures[
                                watch(`items.${index}.layer_id`)
                              ]?.map((style) => (
                                <MenuItem key={style.id} value={style.id}>
                                  {style.style_name || `Style ${style.id}`}
                                </MenuItem>
                              ))}
                            </RHFSelect> */}
                              </Box>

                              <Box
                                gap={2}
                                display="grid"
                                gridTemplateColumns={{
                                  xs: "repeat(1, 1fr)",
                                  sm: "repeat(2, 1fr)",
                                }}
                              >
                                {/* <RHFTextField
                              name={`items.${index}.order`}
                              label="Эрэмбэ"
                              type="number"
                              variant="filled"
                              inputProps={{ min: 0 }}
                              value={index}
                              disabled
                            /> */}

                                {/* <Box>
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                Opacity: {watch(`items.${index}.opacity`) || 1}
                              </Typography>
                              <Slider
                                name={`items.${index}.opacity`}
                                value={watch(`items.${index}.opacity`) || 1}
                                onChange={(_, value) =>
                                  setValue(`items.${index}.opacity`, value)
                                }
                                min={0}
                                max={1}
                                step={0.1}
                                marks
                                valueLabelDisplay="auto"
                              />
                            </Box> */}

                                {/* <RHFTextField
                              name={`items.${index}.z_index`}
                              label="Z-Index"
                              type="number"
                              variant="filled"
                            /> */}
                              </Box>

                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={
                                      watch(`items.${index}.visible`) !== false
                                    }
                                    onChange={(e) =>
                                      setValue(
                                        `items.${index}.visible`,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                }
                                label="Харагдах"
                              />
                            </Stack>
                          </Box>
                        </Collapse>
                      </Box>
                    </Card>
                  </m.div>
                );
              })}
            </AnimatePresence>
          </Stack>
        ) : (
          <Box
            sx={{
              p: 4,
              textAlign: "center",
              color: "text.secondary",
              bgcolor: "grey.50",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">
              Layer items байхгүй байна. Нэмэх товчийг дарж нэмнэ үү.
            </Typography>
          </Box>
        )}

        <Stack direction="row" justifyContent="flex-end" spacing={2}>
          <Button variant="outlined" color="inherit" onClick={onCloseForm}>
            Буцах
          </Button>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={isSubmitting}
            color="primary"
          >
            {!currentGroup ? "Үүсгэх" : "Хадгалах"}
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid xs={12}>{renderGroupDetails}</Grid>
        <Grid xs={12}>{renderLayerItems}</Grid>
      </Grid>
    </FormProvider>
  );
});
