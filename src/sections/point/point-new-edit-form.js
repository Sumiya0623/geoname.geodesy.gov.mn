import * as Yup from "yup";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo, useEffect, useCallback, memo } from "react";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Unstable_Grid2";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";

import { paths } from "src/routes/paths";
import { useRouter } from "src/routes/hooks";
import { useResponsive } from "src/hooks/use-responsive";
import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetRelatedUsers } from "src/api/user";
import FormProvider, {
  RHFSelect,
  RHFUpload,
  RHFTextField,
  RHFDatePicker,
  RHFCheckbox,
} from "src/components/hook-form";

export default memo(function PointNewEditForm({ currentPoint }) {
  const router = useRouter();
  const mdUp = useResponsive("up", "md");
  const { enqueueSnackbar } = useSnackbar();

  const { constants: centerTypes } = useGetConstantsFordropdown("CENTERTYPES");
  const { constants: geodeticSystems } =
    useGetConstantsFordropdown("GEODETICSYSTEM");
  const { constants: geodeticNetworks } =
    useGetConstantsFordropdown("GEODETIC_NETWORK");
  const { constants: photoTypes } = useGetConstantsFordropdown("PHOTO_TYPES");
  const { constants: devices } = useGetConstantsFordropdown("DEVICES");
  const { users: engineers } = useGetRelatedUsers({ pagination: false });
  const NewPointSchema = useMemo(
    () =>
      Yup.object()
        .shape({
          name: Yup.string().required(requiredMsg),
          number: Yup.string(),
          center_id: Yup.number(),
          description: Yup.string(),
          soil: Yup.mixed(),
          measurements: Yup.array().of(
            Yup.object().shape({
              system: Yup.number(),
              network: Yup.number(),
              line: Yup.string(),
              final_x: Yup.number(),
              final_y: Yup.number(),
              final_z: Yup.number(),
              horht: Yup.number(),
              relative_gravity: Yup.number(),
              absolute_gravity: Yup.number(),
              measurement_date: Yup.date(),
              is_new: Yup.boolean(),
              device: Yup.string(),
              journal: Yup.object().shape({
                journal_engineer_id: Yup.number(),
                journal: Yup.mixed(),
              }),
              passport: Yup.object().shape({
                passport_engineer_id: Yup.number(),
                passport: Yup.mixed(),
              }),

              photo: Yup.array().of(
                Yup.object().shape({
                  photo: Yup.mixed(),
                  type: Yup.string(),
                })
              ),
            })
          ),
        })
        .noUnknown(true),
    []
  );

  const defaultValues = useMemo(
    () => ({
      name: currentPoint?.name || "",
      number: currentPoint?.number || "",
      center_id: currentPoint?.center?.id || currentPoint?.center || null,
      description: currentPoint?.description || "",
      soil: currentPoint?.soil?.id || "",
      measurements:
        currentPoint?.measurements?.length > 0
          ? currentPoint.measurements.map((m) => ({
              system: m?.system?.id || null,
              network: m?.network?.id || null,
              line: m?.line || "",
              final_x: m?.final_x || 0,
              final_y: m?.final_y || 0,
              final_z: m?.final_z || 0,
              horht: m?.horht || 0,
              relative_gravity: m?.relative_gravity || 0,
              absolute_gravity: m?.absolute_gravity || 0,
              measurement_date: m?.measurement_date
                ? new Date(m.measurement_date)
                : null,
              is_new: m?.is_new || false,
              device: m?.device || "",
              journal: {
                engineer_id: m?.journals?.[0]?.engineer || null,
                journal: m?.journals?.[0]?.journal || null,
              },
              passport: {
                engineer_id: m?.passports?.[0]?.engineer || null,
                passport: m?.passports?.[0]?.passport || null,
              },

              photo: m?.photo || [],
            }))
          : [
              {
                system_id: null,
                network_id: null,
                line: "",
                final_x: 0,
                final_y: 0,
                final_z: 0,
                horht: 0,
                relative_gravity: 0,
                absolute_gravity: 0,
                measurement_date: null,
                is_new: false,
                device: "",
                journal: {
                  engineer_id: null,
                  journal: null,
                },
                passport: {
                  engineer_id: null,
                  passport: null,
                },
                photo: [],
              },
            ],
    }),
    [currentPoint]
  );

  const methods = useForm({
    resolver: yupResolver(NewPointSchema),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onBlur",
    shouldUnregister: false,
    criteriaMode: "firstError",
  });

  const {
    reset,
    watch,
    control,
    setValue,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "measurements",
  });
  const photosData = watch(`measurements`);
  useEffect(() => {
    if (currentPoint) {
      reset(defaultValues);
    }
  }, [currentPoint, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const { id, ...rest } = data;
      const formData = new FormData();
      const appendToFormData = (obj, prefix = "") => {
        Object.entries(obj).forEach(([key, value]) => {
          const fieldName = prefix ? `${prefix}[${key}]` : key;
          if (value !== null && value !== undefined && value !== "") {
            if (value instanceof File || value instanceof Blob) {
              formData.append(fieldName, value);
            } else if (Array.isArray(value)) {
              value.forEach((item, index) => {
                if (typeof item === "object" && item !== null) {
                  appendToFormData(item, `${fieldName}[${index}]`);
                } else if (item !== null && item !== undefined && item !== "") {
                  formData.append(`${fieldName}[${index}]`, item);
                }
              });
            } else if (typeof value === "object" && value !== null) {
              appendToFormData(value, fieldName);
            } else {
              formData.append(fieldName, value.toString());
            }
          }
        });
      };
      const basicFields = {
        name: rest.name || "",
        number: rest.number || "",
        center_id: rest.center_id || "",
        description: rest.description || "",
      };
      Object.entries(basicFields).forEach(([key, value]) => {
        formData.append(key, value);
      });

      if (rest.measurements && rest.measurements.length > 0) {
        rest.measurements.forEach((measurement, index) => {
          const measurementFields = {
            engineer: measurement.engineer,
            operator: measurement.operator,
            checker: measurement.checker,
            system_id: measurement.system,
            network_id: measurement.network,
            line: measurement.line,
            final_x: measurement.final_x,
            final_y: measurement.final_y,
            final_z: measurement.final_z,
            horht: measurement.horht,
            relative_gravity: measurement.relative_gravity,
            absolute_gravity: measurement.absolute_gravity,
            measurement_date: measurement.measurement_date,
            device: measurement.device,
            is_new: measurement.is_new || false,
          };

          Object.entries(measurementFields).forEach(([key, value]) => {
            if (
              value !== null &&
              value !== undefined &&
              (value !== "" || key === "is_new")
            ) {
              formData.append(`measurements[${index}][${key}]`, value);
            }
          });

          const nestedObjects = ["journal", "passport"];
          nestedObjects.forEach((objName) => {
            const obj = measurement[objName];
            if (obj) {
              if (obj.engineer_id) {
                formData.append(
                  `measurements[${index}][${objName}][engineer_id]`,
                  obj.engineer_id
                );
              }
              if (obj[objName]) {
                formData.append(
                  `measurements[${index}][${objName}][${objName}]`,
                  obj[objName]
                );
              }
            }
          });

          if (measurement.photo && measurement.photo.length > 0) {
            measurement.photo.forEach((photoObj, photoIndex) => {
              Object.entries(photoObj).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== "") {
                  formData.append(
                    `measurements[${index}][photo][${photoIndex}][${key}]`,
                    value
                  );
                }
              });
            });
          }
        });
      }
      const method = currentPoint ? "put" : "post";
      const URL = currentPoint
        ? endpoints.point.edit(currentPoint?.id)
        : endpoints.point.create;
      const response = await axiosInstance[method](URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Хэмжилт амжилттай ${currentPoint ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        router.push(paths.dashboard.point.root);
      }
    } catch (error) {
      enqueueSnackbar(
        `Хэмжилт ${currentPoint ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`,
        {
          variant: "error",
        }
      );
    }
  });

  const handleDrop = useCallback(
    (index) => (acceptedFiles) => {
      const currentPhotos = photosData[index]?.photo || [];
      const newPhotoObjects = acceptedFiles.map((file) => {
        const preview = URL.createObjectURL(file);
        return {
          photo: Object.assign(file, { preview }),
          type: "",
        };
      });
      setValue(
        `measurements.${index}.photo`,
        [...currentPhotos, ...newPhotoObjects],
        {
          shouldValidate: true,
        }
      );
    },
    [setValue, photosData]
  );

  useEffect(() => {
    return () => {
      if (photosData) {
        photosData.forEach((measurement) => {
          if (measurement.photo) {
            measurement.photo.forEach((photoObj) => {
              if (photoObj.photo?.preview) {
                URL.revokeObjectURL(photoObj.photo.preview);
              }
            });
          }
        });
      }
    };
  }, [photosData]);

  const handleRemoveFile = useCallback(
    (index, photoObject) => {
      const currentPhotos = photosData[index]?.photo || [];
      const filteredPhotos = currentPhotos.filter(
        (item) => item.photo !== photoObject.photo
      );
      setValue(`measurements.${index}.photo`, filteredPhotos);
    },
    [setValue, photosData]
  );

  const handleRemoveAllFiles = useCallback(
    (index) => {
      setValue(`measurements.${index}.photo`, []);
    },
    [setValue]
  );

  const handleRemoveFileFromUpload = useCallback(
    (index, file) => {
      const currentPhotos = photosData[index]?.photo || [];
      const filteredPhotos = currentPhotos.filter(
        (item) => item.photo !== file
      );
      setValue(`measurements.${index}.photo`, filteredPhotos);
    },
    [setValue, photosData]
  );

  const handleDocumentDrop = useCallback(
    (index, fieldName) => (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        setValue(
          `measurements.${index}.${fieldName}.${fieldName}`,
          acceptedFiles[0],
          {
            shouldValidate: true,
          }
        );
      }
    },
    [setValue]
  );

  const handleDocumentRemove = useCallback(
    (index, fieldName) => () => {
      setValue(`measurements.${index}.${fieldName}.${fieldName}`, null);
    },
    [setValue]
  );

  const handleAddMeasurement = () => {
    append({
      system_id: null,
      network_id: null,
      line: "",
      final_x: 0,
      final_y: 0,
      final_z: 0,
      horht: 0,
      relative_gravity: 0,
      absolute_gravity: 0,
      measurement_date: null,
      is_new: false,
      device: "",
      journal: { engineer_id: null, journal: null },
      passport: { engineer_id: null, passport: null },
      photo: [],
    });
  };

  const handleRemoveMeasurement = (index) => {
    remove(index);
  };

  const renderDetails = (
    <>
      <Grid xs={12} md={12}>
        <Card>
          {!mdUp && <CardHeader title="Цэгийн мэдээлэл" />}

          <Stack spacing={3} sx={{ p: 3 }}>
            <Box
              gap={3}
              display="grid"
              gridTemplateColumns={{
                xs: "repeat(1, 1fr)",
                sm: "repeat(3, 1fr)",
              }}
            >
              <RHFTextField name="name" label="Цэгийн нэр" variant="filled" />
              <RHFTextField
                name="number"
                label="Цэгийн дугаар"
                variant="filled"
              />

              <RHFSelect
                name="center_id"
                label="Төвийн хэлбэр"
                variant="filled"
              >
                <MenuItem
                  value=""
                  sx={{ fontStyle: "italic", color: "text.secondary" }}
                >
                  Сонгоно уу
                </MenuItem>
                <Divider sx={{ borderStyle: "dashed" }} />
                {centerTypes?.map((centerType) => (
                  <MenuItem key={centerType?.id} value={centerType?.id}>
                    {centerType?.name}
                  </MenuItem>
                ))}
              </RHFSelect>
            </Box>

            <RHFTextField
              name="description"
              label="Байршлын тэмдэглэл"
              multiline
              rows={3}
              variant="filled"
              placeholder="Цэгийн дэлгэрэнгүй байршлын тайлбар..."
            />
          </Stack>
        </Card>
      </Grid>
    </>
  );

  const renderMeasurements = (
    <>
      <Grid xs={12} md={12}>
        <Stack spacing={3}>
          {fields.map((item, index) => (
            <Card key={item.id}>
              <CardHeader
                title={`Хэмжилт ${index + 1}`}
                action={
                  fields.length > 1 && (
                    <IconButton onClick={() => handleRemoveMeasurement(index)}>
                      <Iconify
                        icon="solar:minus-circle-bold"
                        color="error.main"
                      />
                    </IconButton>
                  )
                }
              />
              <Stack spacing={3} sx={{ p: 3 }}>
                {/* Properties */}
                <Typography variant="h6">Хэмжилтийн мэдээлэл</Typography>
                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                  }}
                >
                  <RHFSelect
                    name={`measurements.${index}.system`}
                    label="Геодезийн систем"
                    variant="filled"
                  >
                    <MenuItem
                      value=""
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    >
                      Сонгоно уу
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {geodeticSystems?.map((system_id) => (
                      <MenuItem key={system_id?.id} value={system_id?.id}>
                        {system_id?.name}
                      </MenuItem>
                    ))}
                  </RHFSelect>

                  <RHFSelect
                    name={`measurements.${index}.network`}
                    label="Геодезийн сүлжээ"
                    variant="filled"
                  >
                    <MenuItem
                      value=""
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    >
                      Сонгоно уу
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {geodeticNetworks?.map((network_id) => (
                      <MenuItem key={network_id?.id} value={network_id?.id}>
                        {network_id?.name}
                      </MenuItem>
                    ))}
                  </RHFSelect>

                  <RHFTextField
                    name={`measurements.${index}.line`}
                    label="Шугамын дугаар"
                    variant="filled"
                    placeholder="L-001"
                  />
                </Box>

                <Typography
                  variant="subtitle2"
                  sx={{ color: "text.primary", fontWeight: 600 }}
                >
                  Бодсон солбицол
                </Typography>
                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(3, 1fr)",
                  }}
                >
                  <RHFTextField
                    name={`measurements.${index}.final_x`}
                    label="X (м)"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                  <RHFTextField
                    name={`measurements.${index}.final_y`}
                    label="Y (м)"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                  <RHFTextField
                    name={`measurements.${index}.final_z`}
                    label="Z (м)"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                </Box>

                <Typography
                  variant="subtitle2"
                  sx={{ color: "text.primary", fontWeight: 600 }}
                >
                  Хэмжилтийн үр дүн
                </Typography>
                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(3, 1fr)",
                  }}
                >
                  <RHFTextField
                    name={`measurements.${index}.horht`}
                    label="Horth (м)"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                  <RHFTextField
                    name={`measurements.${index}.relative_gravity`}
                    label="Харьцангуй хүндийн хүч"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                  <RHFTextField
                    name={`measurements.${index}.absolute_gravity`}
                    label="Абсолют хүндийн хүч"
                    type="number"
                    step="any"
                    variant="filled"
                  />
                </Box>

                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                  }}
                >
                  <RHFDatePicker
                    name={`measurements.${index}.measurement_date`}
                    label="Хэмжилт хийсэн огноо"
                    variant="filled"
                  />
                  <RHFSelect
                    name={`measurements.${index}.device`}
                    label="Хэмжлийн хэрэгсэл"
                    variant="filled"
                  >
                    <MenuItem
                      value=""
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    >
                      Сонгоно уу
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {devices?.map((device) => (
                      <MenuItem key={device?.id} value={device?.name}>
                        {device?.name}
                      </MenuItem>
                    ))}
                  </RHFSelect>
                </Box>
                <RHFCheckbox
                  name={`measurements.${index}.is_new`}
                  label="Шинэ сүлжээ эсэх"
                />

                {/* Documents */}
                <Typography variant="h6">Баримт бичиг</Typography>
                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                  }}
                >
                  <RHFSelect
                    name={`measurements.${index}.journal.engineer_id`}
                    label="Журнал хөтөлсөн инженер"
                    variant="filled"
                  >
                    <MenuItem
                      value=""
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    >
                      Сонгоно уу
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {engineers?.map((engineer) => (
                      <MenuItem key={engineer?.id} value={engineer?.id}>
                        {engineer?.full_name}
                      </MenuItem>
                    ))}
                  </RHFSelect>
                  <RHFUpload
                    name={`measurements.${index}.journal.journal`}
                    onDrop={handleDocumentDrop(index, "journal")}
                    onDelete={handleDocumentRemove(index, "journal")}
                    accept={{
                      "application/pdf": [".pdf"],
                      "application/msword": [".doc"],
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                        [".docx"],
                    }}
                    helperText="PDF, DOC, DOCX (Max 10MB)"
                  />
                </Box>
                <Box
                  gap={3}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                  }}
                >
                  <RHFSelect
                    name={`measurements.${index}.passport.engineer_id`}
                    label="Хувийн хэрэг хөтөлсөн инженер"
                    variant="filled"
                  >
                    <MenuItem
                      value=""
                      sx={{ fontStyle: "italic", color: "text.secondary" }}
                    >
                      Сонгоно уу
                    </MenuItem>
                    <Divider sx={{ borderStyle: "dashed" }} />
                    {engineers?.map((engineer) => (
                      <MenuItem key={engineer?.id} value={engineer?.id}>
                        {engineer?.full_name}
                      </MenuItem>
                    ))}
                  </RHFSelect>
                  <RHFUpload
                    name={`measurements.${index}.passport.passport`}
                    onDrop={handleDocumentDrop(index, "passport")}
                    onDelete={handleDocumentRemove(index, "passport")}
                    accept={{
                      "application/pdf": [".pdf"],
                      "application/msword": [".doc"],
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                        [".docx"],
                    }}
                    helperText="PDF, DOC, DOCX (Max 10MB)"
                  />
                </Box>

                {/* Images */}
                <Typography variant="h6">Зураг</Typography>
                <RHFUpload
                  multiple
                  thumbnail
                  name={`measurements.${index}.photo`}
                  maxSize={3145728}
                  onDrop={handleDrop(index)}
                  onRemove={handleRemoveFileFromUpload.bind(null, index)}
                  onRemoveAll={handleRemoveAllFiles.bind(null, index)}
                  onUpload={() => console.info("ON UPLOAD")}
                />

                <Box
                  gap={2}
                  display="grid"
                  gridTemplateColumns={{
                    xs: "repeat(1, 1fr)",
                    sm: "repeat(2, 1fr)",
                    md: "repeat(3, 1fr)",
                  }}
                >
                  {watch(`measurements.${index}.photo`)?.map(
                    (photo, photoIndex) => (
                      <Card key={`photo-${photoIndex}`} sx={{ p: 2 }}>
                        <Stack spacing={1.5}>
                          <Box
                            sx={{
                              position: "relative",
                              borderRadius: 1,
                              overflow: "hidden",
                              bgcolor: "grey.100",
                              aspectRatio: "4/3",
                            }}
                          >
                            <Box
                              component="img"
                              src={
                                typeof photo.photo === "string"
                                  ? photo.photo
                                  : photo.photo?.preview ||
                                    URL.createObjectURL(photo.photo)
                              }
                              loading="lazy"
                              sx={{
                                width: 600,
                                height: 400,
                                objectFit: "cover",
                                position: "absolute",
                                top: 0,
                                left: 0,
                                willChange: "auto",
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveFile(photo)}
                              sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                bgcolor: "error.main",
                                color: "white",
                                "&:hover": { bgcolor: "error.dark" },
                              }}
                            >
                              <Iconify icon="mingcute:close-line" width={16} />
                            </IconButton>
                          </Box>

                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 500 }}
                            noWrap
                          >
                            {photo.photo.name || `Зураг ${index + 1}`}
                          </Typography>

                          <RHFSelect
                            key={photoIndex}
                            name={`measurements.${index}.photo.${photoIndex}.type`}
                            label={`Зураг ${photoIndex + 1}-н төрөл`}
                            variant="filled"
                          >
                            <MenuItem
                              value=""
                              sx={{
                                fontStyle: "italic",
                                color: "text.secondary",
                              }}
                            >
                              Сонгоно уу
                            </MenuItem>
                            <Divider sx={{ borderStyle: "dashed" }} />
                            {photoTypes?.map((photoType) => (
                              <MenuItem
                                key={photoType?.id}
                                value={photoType?.name}
                              >
                                {photoType?.name}
                              </MenuItem>
                            ))}
                          </RHFSelect>
                        </Stack>
                      </Card>
                    )
                  )}
                </Box>
              </Stack>
            </Card>
          ))}
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <LoadingButton
              size="large"
              color="primary"
              variant="contained"
              onClick={handleAddMeasurement}
              startIcon={<Iconify icon="solar:add-circle-bold" />}
              sx={{ alignSelf: "flex-start" }}
            >
              Хэмжилт нэмэх
            </LoadingButton>
          </Box>
        </Stack>
      </Grid>
    </>
  );

  const renderActions = (
    <>
      {mdUp && <Grid md={4} />}
      <Grid xs={12} md={8} sx={{ display: "flex", justifyContent: "flex-end" }}>
        <LoadingButton
          type="submit"
          variant="contained"
          size="large"
          loading={isSubmitting}
        >
          {!currentPoint ? "Цэг нэмэх" : "Цэг хадгалах"}
        </LoadingButton>
      </Grid>
    </>
  );

  return (
    <>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Grid container spacing={3}>
          {renderDetails}
          {renderMeasurements}
          {renderActions}
        </Grid>
      </FormProvider>
    </>
  );
});
