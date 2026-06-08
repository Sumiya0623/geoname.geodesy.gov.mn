import * as Yup from "yup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { useParams } from "next/navigation";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Grid from "@mui/material/Unstable_Grid2";
import Typography from "@mui/material/Typography";
import LoadingButton from "@mui/lab/LoadingButton";
import FormControlLabel from "@mui/material/FormControlLabel";

import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import {
  useGetConstantsFordropdown,
  useGetConstantsForParent,
} from "src/api/constant";
import { useGetRelatedUsers } from "src/api/user";
import FormProvider, {
  RHFSelect,
  RHFUpload,
  RHFSwitch,
  RHFTextField,
  RHFDatePicker,
  UploadPDFField,
} from "src/components/hook-form";
import dayjs from "dayjs";
import { Button } from "@mui/material";
import MeasurementFindPoint from "./measurement-find-point";
import { c2geo } from "../utils/c2geo";
import { useGetMeasurement } from "src/api/measurement";

const GRAVIMETR = "ГРАВИМЕТРИЙН СҮЛЖЭЭ";
const ONDOR = "ӨНДРИЙН СҮЛЖЭЭ";

export default memo(function MeasurementNewEditForm({
  onCloseForm,
  refetch,
  currentMeasurement,
  duplicateData,
  projectId,
  pointId,
  parent,
}) {
  const params = useParams();
  const routeProjectId = params?.id || null;
  const effectiveProjectId = currentMeasurement
    ? null
    : projectId || routeProjectId || null;
  const { measurement } = useGetMeasurement(currentMeasurement?.id);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(
    currentMeasurement?.network?.parent?.id || null
  );

  const { enqueueSnackbar } = useSnackbar();
  const { constants: centerTypes } = useGetConstantsFordropdown("CENTERTYPES");
  const { constants: soiltypes } = useGetConstantsFordropdown("SOILTYPES");
  const { constants: geodeticSystems } =
    useGetConstantsFordropdown("GEODETICSYSTEM");
  const { constants: geodeticNetworks } =
    useGetConstantsFordropdown("GEODETIC_NETWORK");
  const { constants: geodeticNetworkLevel } = useGetConstantsForParent(
    selectedNetwork || null
  );
  const { constants: photoTypes } = useGetConstantsFordropdown("PHOTO_TYPES");
  const { users: engineers } = useGetRelatedUsers({ pagination: false });
  const NewMeasurementSchema = Yup.object()
    .shape({
      name: Yup.string().when("is_new", {
        is: true,
        then: (schema) => schema.required("Цэгийн нэр шаардлагатай"),
        otherwise: (schema) => schema.nullable(),
      }),
      number: Yup.string().nullable(),
      center: Yup.mixed().when("is_new", {
        is: true,
        then: (schema) => schema.required("Төвийн хэлбэр шаардлагатай"),
        otherwise: (schema) => schema.nullable(),
      }),
      pointId: Yup.mixed().when("is_new", {
        is: false,
        then: (schema) => schema.required("Цэг сонгоно уу"),
        otherwise: (schema) => schema.nullable(),
      }),
      description: Yup.string(),
      system: Yup.mixed()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .notRequired(),
      networkselect: Yup.mixed()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .notRequired(),
      network: Yup.mixed()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .notRequired(),
      line: Yup.string(),
      final_x: Yup.number()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .when("networkselect", {
          is: (val) => {
            const networkName = geodeticNetworks?.find(
              (network) => network?.id === val
            )?.name;
            return networkName !== ONDOR && networkName !== GRAVIMETR;
          },
          then: (schema) => schema.required("X координат шаардлагатай"),
          otherwise: (schema) => schema.nullable(),
        }),
      final_y: Yup.number()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .when("networkselect", {
          is: (val) => {
            const networkName = geodeticNetworks?.find(
              (network) => network?.id === val
            )?.name;
            return networkName !== ONDOR && networkName !== GRAVIMETR;
          },
          then: (schema) => schema.required("Y координат шаардлагатай"),
          otherwise: (schema) => schema.nullable(),
        }),
      final_z: Yup.number()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .when("networkselect", {
          is: (val) => {
            const networkName = geodeticNetworks?.find(
              (network) => network?.id === val
            )?.name;
            return networkName !== ONDOR && networkName !== GRAVIMETR;
          },
          then: (schema) => schema.required("Z координат шаардлагатай"),
          otherwise: (schema) => schema.nullable(),
        }),
      horht: Yup.number()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .when("networkselect", {
          is: (val) => {
            const networkName = geodeticNetworks?.find(
              (network) => network?.id === val
            )?.name;
            return networkName === ONDOR;
          },
          then: (schema) => schema.required("Орто өндөр шаардлагатай"),
          otherwise: (schema) => schema.nullable(),
        }),
      relative_gravity: Yup.number()
        .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .when("networkselect", {
          is: (val) => {
            const networkName = geodeticNetworks?.find(
              (network) => network?.id === val
            )?.name;
            return networkName === GRAVIMETR;
          },
          then: (schema) =>
            schema.required("Харьцангуй хүндийн хүч шаардлагатай"),
          otherwise: (schema) => schema.nullable(),
        }),
      // absolute_gravity: Yup.number(),
      measured_date: Yup.date()
        .transform((value, originalValue) => {
          if (originalValue && dayjs.isDayjs(originalValue)) {
            return originalValue.toDate();
          }
          return value;
        })
        .typeError("Зөв огноо оруулна уу")
        .required("Хэмжилтийн огноо шаардлагатай"),
      is_new: Yup.boolean(),
      deviceId: Yup.string(),
      // edit үед (currentMeasurement байгаа тохиолдолд) projectId шаардлагагүй
      projectId:
        currentMeasurement || effectiveProjectId
          ? Yup.mixed()
          : Yup.mixed().required("Гэрээт ажил сонгоно уу"),
      journal: Yup.mixed()
        // .nullable()
        .transform((v, o) => (o === "" ? null : v))
        .required("Хэмжилтийн журнал шаардлагатай"),
      // .when("is_new", {
      //   is: true,
      //   then: (schema) => schema.required("Хэмжилтийн журнал шаардлагатай"),
      //   otherwise: (schema) => schema.nullable(),
      // }),
      journal_engineer: Yup.mixed().when("is_new", {
        is: true,
        then: (schema) => schema.required("Хэмжсэн инженерыг сонгоно уу"),
        otherwise: (schema) => schema.required("Журналын инженерыг сонгоно уу"),
      }),
      // passport: Yup.mixed()
      //   .nullable()
      //   .transform((v, o) => (o === "" ? null : v))
      //   .when("is_new", {
      //     is: true,
      //     then: (schema) => schema.required("Хувийн хэрэг шаардлагатай"),
      //     otherwise: (schema) => schema.nullable(),
      //   }),
      // passport_engineer: Yup.mixed()
      //   .nullable()
      //   .transform((v, o) => (o === "" ? null : v))
      //   .when("is_new", {
      //     is: true,
      //     then: (schema) =>
      //       schema.required("Хувийн хэрэг хөтөлсөн инженерыг сонгоно уу"),
      //     otherwise: (schema) =>
      //       schema.required("Хувийн хэргийг хөтөлсөн инженерыг сонгоно уу"),
      //   }),
      photos: Yup.array()
        .min(4, "Бүх зургийг оруулна уу")
        .of(
          Yup.object().shape({
            type_id: Yup.string().required("Зургийн төрөл сонгоно уу"),
          })
        ),
      // .when("is_new", {
      //   is: true,
      //   then: (schema) => schema.min(1, "Дор хаяж нэг зураг шаардлагатай"),
      //   otherwise: (schema) => schema.notRequired(),
      // }),
    })
    .test(
      "mongolia-bounds",
      "Өгөгдсөн координатууд Монгол Улсын хүрээнд байх ёстой",
      function (values) {
        const { final_x, final_y, final_z, networkselect } = values;

        if (!final_x || !final_y || !final_z) {
          return true;
        }

        const networkName = geodeticNetworks?.find(
          (network) => network?.id === networkselect
        )?.name;

        if (networkName === ONDOR || networkName === GRAVIMETR) {
          return true;
        }

        try {
          const { lat, lon } = c2geo(final_x, final_y, final_z);
          const isWithinMongolia =
            lat >= 42 && lat <= 54 && lon >= 84 && lon <= 120;

          if (!isWithinMongolia) {
            return this.createError({
              path: "final_z",
              message:
                "Өгөгдсөн координатууд Монгол Улсын хүрээнд байх ёстой. Картезиан солбилцол байх ёстойг анхаарна уу.",
            });
          }
          return true;
        } catch (error) {
          console.error("Error converting coordinates:", error);
          return true;
        }
      }
    );

  const defaultValues = useMemo(() => {
    // SWR‑ээс ирсэн measurement бэлэн бол тэрийг гол эх сурвалж болгоно,
    // үгүй бол duplicateData, түүнээс ч үгүй бол currentMeasurement пропыг ашиглана
    const hasLoadedMeasurement =
      measurement && Object.keys(measurement).length > 0;
    const sourceData =
      (hasLoadedMeasurement && measurement) ||
      duplicateData ||
      currentMeasurement ||
      {};

    const currentProjectId = hasLoadedMeasurement
      ? sourceData?.project || null
      : currentMeasurement
        ? currentMeasurement?.project || null
        : effectiveProjectId || duplicateData?.project?.id || null;

    const journalEngineerId =
      sourceData?.measured_by?.id || sourceData?.journal_engineer?.id;
    // const passportEngineerId = sourceData?.passport_engineer?.id;

    const validJournalEngineerId = engineers?.some(
      (eng) => eng.id === journalEngineerId
    )
      ? journalEngineerId
      : "";
    // const validPassportEngineerId = engineers?.some(
    //   (eng) => eng.id === passportEngineerId
    // )
    //   ? passportEngineerId
    //   : "";

    return {
      description: duplicateData ? "" : sourceData?.description || "",
      name: sourceData?.point?.name || "",
      number: sourceData?.point?.number || "",
      // center, soil хоёул объект байдлаар ирдэг тул id‑г нь default болгоно
      center: sourceData?.point?.center?.id || "",
      soil: sourceData?.point?.soil?.id || "",
      pointId: sourceData?.point?.id || pointId || null,
      system: sourceData?.system?.id || null,
      networkselect: sourceData?.network?.parent?.id || null,
      network: sourceData?.network?.id || null,
      projectId: currentProjectId || null,
      line: sourceData?.line || "",
      final_x: sourceData?.coordinate_x || sourceData?.final_x || "",
      final_y: sourceData?.coordinate_y || sourceData?.final_y || "",
      final_z: sourceData?.coordinate_h || sourceData?.final_z || "",
      horht: sourceData?.horht || "",
      relative_gravity: sourceData?.relative_gravity || "",
      absolute_gravity: sourceData?.absolute_gravity || "",
      measured_date: duplicateData
        ? null
        : sourceData?.measured_date || sourceData?.measure_date || null, //
      is_new: sourceData?.is_new || false,
      deviceId: sourceData?.equipment_id || sourceData?.deviceId || "",
      journal_engineer: validJournalEngineerId || null,
      journal: duplicateData ? null : sourceData?.journal || null, //
      // passport_engineer: validPassportEngineerId,
      // passport: duplicateData ? null : sourceData?.passport || null, //
      photos: duplicateData
        ? []
        : sourceData?.measurementphotos &&
            sourceData?.measurementphotos.length > 0
          ? sourceData?.measurementphotos.map((photo) => ({
              id: photo?.id,
              photo: photo?.photo,
              type_id:
                typeof photo?.type === "object" ? photo?.type?.id : photo?.type,
            }))
          : [],
    };
  }, [
    currentMeasurement,
    duplicateData,
    projectId,
    pointId,
    engineers,
    measurement,
  ]);

  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSelectPoint = (selectedPoint) => {
    setSelectedPoint(selectedPoint);
    setValue("pointId", selectedPoint?.id || null, { shouldValidate: true });
    setOpen(false);
  };

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
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting, errors },
    trigger,
  } = methods;

  const photosData = watch("photos");
  const networkSelectValue = watch("networkselect");
  const systemValue = watch("system");
  const networkValue = watch("network");
  const journalEngineerValue = watch("journal_engineer");

  const selectedNetworkName = geodeticNetworks?.find(
    (network) => network?.id === networkSelectValue
  )?.name;

  const getAvailablePhotoTypes = (currentIndex) => {
    const selectedTypeIds = photosData
      ?.map((photo, idx) => (idx !== currentIndex ? photo?.type_id : null))
      .filter(Boolean);

    return (
      photoTypes?.filter((type) => !selectedTypeIds?.includes(type?.id)) || []
    );
  };

  useEffect(() => {
    if (currentMeasurement || measurement) {
      reset(defaultValues);
      setSelectedNetwork(
        (measurement || currentMeasurement)?.network?.parent?.id || null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMeasurement, measurement, duplicateData, engineers, reset, defaultValues]);

  useEffect(() => {
    if (networkSelectValue !== selectedNetwork) {
      setSelectedNetwork(networkSelectValue);
      setValue("network", null, { shouldValidate: true });
    }
  }, [networkSelectValue, selectedNetwork, setValue]);

  const measuredDateValue = watch("measured_date");
  useEffect(() => {
    if (measuredDateValue && errors?.measured_date) {
      trigger("measured_date");
    }
  }, [measuredDateValue, errors?.measured_date, trigger]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const {
        name,
        number,
        center,
        soil,
        pointId,
        description,
        system,
        network,
        line,
        final_x,
        final_y,
        final_z,
        horht,
        relative_gravity,
        absolute_gravity,
        measured_date,
        is_new,
        deviceId,
        projectId,
        journal_engineer,
        journal,
        // passport_engineer,
        // passport,
        photos,
      } = data;
      const formData = new FormData();
      //////////
      if (!watch("is_new") && pointId) {
        formData.append("point_id", pointId);
        // formData.append("parent_id", pointId);
      } else {
        formData.append("name", name || "");
        formData.append("number", number || "");
        formData.append("center_id", center || "");
      }

      // soil‑ийг шинээр үүсгэх болон засах үед MeasurementCreateOrUpdateSerializer‑ийн
      // write-only `soil_id` талбарт тохирохоор илгээнэ
      if (soil) {
        formData.append("soil_id", soil);
      }

      if (parent) {
        formData.append("parent_id", parent || "");
      }
      //////////
      // Project ID зөвхөн шинэ хэмжилт үүсгэх үед шаардлагатай
      if (!currentMeasurement) {
        const normalizedProjectId =
          typeof data.projectId === "object"
            ? data.projectId?.id
            : data.projectId;
        if (normalizedProjectId) {
          formData.append("projectId", normalizedProjectId);
        }
      }
      formData.append("description", description);
      if (system) {
        formData.append("system_id", system);
      }
      if (network) {
        formData.append("network_id", network);
      }

      if (line) {
        formData.append("line", line || "");
      }
      const selectedNetworkName = geodeticNetworks?.find(
        (network) => network?.id === data.networkselect
      )?.name;

      if (selectedNetworkName !== ONDOR && selectedNetworkName !== GRAVIMETR) {
        if (final_x !== null && final_x !== undefined) {
          formData.append("final_x", final_x);
        }
        if (final_y !== null && final_y !== undefined) {
          formData.append("final_y", final_y);
        }
        if (final_z !== null && final_z !== undefined) {
          formData.append("final_z", final_z);
        }
      }

      if (selectedNetworkName === ONDOR) {
        if (horht !== null && horht !== undefined) {
          formData.append("horht", horht);
        }
      }

      if (selectedNetworkName === GRAVIMETR) {
        if (relative_gravity !== null && relative_gravity !== undefined) {
          formData.append("relative_gravity", relative_gravity);
        }
      }

      // if (absolute_gravity !== null && absolute_gravity !== undefined) {
      //   formData.append("absolute_gravity", absolute_gravity);
      // }
      if (measured_date) {
        formData.append(
          "measured_date",
          dayjs(measured_date).format("YYYY-MM-DD")
        );
      }
      formData.append("is_new", is_new);
      formData.append("deviceId", deviceId);

      formData.append("journal_engineer_id", journal_engineer);
      // formData.append("passport_engineer_id", passport_engineer);
      // if (passport instanceof File) {
      //   formData.append("passport", passport);
      // }
      if (journal instanceof File) {
        formData.append("journal", journal);
      }
      // Зөвхөн шинэ upload (File) зургуудыг илгээнэ, URL-уудыг хасна
      photos
        .filter((photoObj) => photoObj.photo instanceof File)
        .forEach((photoObj) => {
          formData.append("photos", photoObj.photo);
          formData.append("type_ids", photoObj.type_id);
        });

      const method = currentMeasurement ? "put" : "post";
      const URL = currentMeasurement
        ? endpoints.measurement.edit(currentMeasurement?.id)
        : endpoints.measurement.create;

      const response = await axiosInstance[method](URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Хэмжилт амжилттай ${currentMeasurement ? "өөрчлөгдлөө" : "нэмэгдлээ"}`
        );
        reset();
        onCloseForm();
        refetch();
      }
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        d?.error ||
        d?.result ||
        d?.detail ||
        (typeof d?.errors === "string"
          ? d.errors
          : Array.isArray(d?.errors)
            ? d.errors.join("\n")
            : err.message || "Алдаа гарлаа");

      enqueueSnackbar(msg, {
        variant: "error",
        // variant: err?.response?.status === 400 ? "error" : "warning",
      });
    }
  });

  const handleDrop = useCallback(
    (acceptedFiles) => {
      const currentPhotos = photosData || [];

      const newPhotoObjects = acceptedFiles.map((file) => {
        const preview = URL.createObjectURL(file);
        return {
          photo: Object.assign(file, { preview }),
          type_id: "",
        };
      });

      setValue("photos", [...currentPhotos, ...newPhotoObjects], {
        shouldValidate: true,
      });
    },
    [setValue, photosData]
  );

  useEffect(() => {
    return () => {
      if (photosData) {
        photosData.forEach((photoObj) => {
          if (photoObj.photo?.preview) {
            URL.revokeObjectURL(photoObj.photo.preview);
          }
        });
      }
    };
  }, [photosData]);

  const handleRemoveFile = useCallback(
    (photoObject) => {
      const currentPhotos = photosData || [];
      const filteredPhotos = currentPhotos.filter(
        (item) => item.photo !== photoObject.photo
      );
      setValue("photos", filteredPhotos);
    },
    [setValue, photosData]
  );

  const handleRemoveAllFiles = useCallback(() => {
    setValue("photos", []);
  }, [setValue]);

  const handleRemoveFileFromUpload = useCallback(
    (file) => {
      const currentPhotos = photosData || [];
      const filteredPhotos = currentPhotos.filter(
        (item) => item.photo !== file
      );
      setValue("photos", filteredPhotos);
    },
    [setValue, photosData]
  );

  const renderDetails = (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      {/* {duplicateData && (
            <Box
              sx={{
                p: 1,
                mb: 1,
                bgcolor: 'info.lighter',
                borderRadius: 1,
                border: '1px dashed',
                borderColor: 'info.main'
              }}
            >
              <Typography variant="body2" color="info.darker">
                Хуулж байгаа шүү
              </Typography>
            </Box>
          )} */}
      <Typography
        variant="subtitle2"
        sx={{ color: "text.primary", fontWeight: 600 }}
      >
        Сүлжээний мэдээлэл
      </Typography>
      <Box
        gap={3}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(3, 1fr)",
        }}
      >
        <RHFSelect
          name="system"
          label="Геодезийн систем"
          variant="filled"
          InputLabelProps={{ shrink: Boolean(systemValue) }}
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
          name="networkselect"
          label="Геодезийн сүлжээ"
          variant="filled"
          InputLabelProps={{ shrink: Boolean(networkSelectValue) }}
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
        <RHFSelect
          name="network"
          label="Зэрэг"
          variant="filled"
          disabled={!selectedNetwork}
          InputLabelProps={{ shrink: Boolean(networkValue) }}
        >
          <MenuItem
            value=""
            sx={{ fontStyle: "italic", color: "text.secondary" }}
          >
            {!selectedNetwork ? "Эхлээд сүлжээ сонгоно уу" : "Сонгоно уу"}
          </MenuItem>
          <Divider sx={{ borderStyle: "dashed" }} />
          {geodeticNetworkLevel?.map((network_id) => (
            <MenuItem key={network_id?.id} value={network_id?.id}>
              {network_id?.name}
            </MenuItem>
          ))}
        </RHFSelect>
      </Box>
    </Stack>
  );

  const renderProperties = (
    <Card>
      {renderDetails}
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{ color: "text.primary", fontWeight: 600 }}
        >
          Хэмжигчийн мэдээлэл
        </Typography>
        <Box
          gap={3}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm: "repeat(3, 1fr)",
          }}
        >
          <RHFDatePicker name="measured_date" label="Хэмжилтийн огноо" />
          {!pointId && !currentMeasurement && (
            <>
              <FormControlLabel
                control={<RHFSwitch name="is_new" />}
                label="Шинээр байгуулсан"
                sx={{ ml: 0 }}
              />
              {!watch("is_new") && (
                <Button variant="contained" color="warning" onClick={handleOpen}>
                  <Iconify
                    icon="mdi:magnify"
                    style={{ marginRight: 12 }}
                    width="12"
                    height="12"
                  />
                  Цэг сонгох
                </Button>
              )}
            </>
          )}
        </Box>
        <Typography
          variant="subtitle2"
          sx={{ color: "text.primary", fontWeight: 600 }}
        >
          Бодсон солбицол
        </Typography>
        {watch("is_new") ? (
          <>
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
              <RHFSelect name="center" label="Төвийн хэлбэр" variant="filled">
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
          </>
        ) : (
          <>
            {/* Нэгэнт бүртгэгдсэн хэмжилтэд ахин цэг олох шаардлагагүй гэж үзлээ. */}

            {!watch("is_new") && errors?.pointId && (
              <Typography
                variant="caption"
                color="error"
                sx={{ display: "block", mt: 0.5 }}
              >
                {errors.pointId.message}
              </Typography>
            )}
            {selectedPoint && (
              <Box
                gap={3}
                display="grid"
                gridTemplateColumns={{
                  xs: "repeat(1, 1fr)",
                  sm: "repeat(3, 1fr)",
                }}
              >
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "text.primary", fontWeight: 600 }}
                  >
                    Цэгийн нэр
                  </Typography>
                  <Box>{selectedPoint?.name}</Box>
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "text.primary", fontWeight: 600 }}
                  >
                    Цэгийн дугаар
                  </Typography>
                  <Box>{selectedPoint?.number}</Box>
                </Box>
              </Box>
            )}
          </>
        )}
        {!(
          selectedNetworkName === ONDOR || selectedNetworkName === GRAVIMETR
        ) && (
          <>
            <Box
              gap={3}
              display="grid"
              gridTemplateColumns={{
                xs: "repeat(1, 1fr)",
                sm: "repeat(3, 1fr)",
              }}
            >
              <RHFTextField
                name="final_x"
                label="X (м)"
                type="number"
                step="any"
                variant="filled"
                placeholder="0.000"
              />
              <RHFTextField
                name="final_y"
                label="Y (м)"
                type="number"
                step="any"
                variant="filled"
                placeholder="0.000"
              />
              <RHFTextField
                name="final_z"
                label="Z (м)"
                type="number"
                step="any"
                variant="filled"
                placeholder="0.000"
              />
            </Box>
            {/* {watch('is_new') &&
            } */}
            {/*  */}
          </>
        )}

        <RHFTextField
          name="description"
          label="Байршлын тэмдэглэл"
          multiline
          rows={3}
          variant="filled"
          placeholder="Цэгийн дэлгэрэнгүй байршлын тайлбар..."
        />
        {watch("is_new") && (
          <>
            <RHFSelect name="soil" label="Хөрсний төрөл" variant="filled">
              <MenuItem
                value=""
                sx={{ fontStyle: "italic", color: "text.secondary" }}
              >
                Сонгоно уу
              </MenuItem>
              <Divider sx={{ borderStyle: "dashed" }} />
              {soiltypes?.map((centerType) => (
                <MenuItem key={centerType?.id} value={centerType?.id}>
                  {centerType?.name}
                </MenuItem>
              ))}
            </RHFSelect>
            <MeasurementFindPoint
              open={open}
              onClose={handleClose}
              onSelectPoint={handleSelectPoint}
            />
          </>
        )}
        {(selectedNetworkName === GRAVIMETR ||
          selectedNetworkName === ONDOR) && (
          <Typography
            variant="subtitle2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            Өндөр ба хүндийн хүч
          </Typography>
        )}
        <Box
          gap={3}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm:
              selectedNetworkName === GRAVIMETR || selectedNetworkName === ONDOR
                ? "repeat(2, 1fr)"
                : "repeat(3, 1fr)",
          }}
        >
          {selectedNetworkName === ONDOR && (
            <>
              <RHFTextField
                name="horht"
                label="Орто өндөр (м)"
                type="text"
                variant="filled"
                placeholder="0.000"
                inputProps={{
                  inputMode: "decimal",
                  pattern: "^[0-9]*\\.?[0-9]*$",
                  onInput: (e) => {
                    e.target.value = e.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                  },
                  onPaste: (e) => {
                    e.preventDefault();
                    const paste = (
                      e.clipboardData || window.clipboardData
                    ).getData("text");
                    const cleaned = paste
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                    e.target.value = cleaned;
                    e.target.dispatchEvent(
                      new Event("input", { bubbles: true })
                    );
                  },
                }}
              />
              <RHFTextField
                name="line"
                label="Шугамын дугаар"
                variant="filled"
                placeholder="L-001"
              />
            </>
          )}
          {selectedNetworkName === GRAVIMETR && (
            <>
              <RHFTextField
                name="relative_gravity"
                label="Харьцангуй хүндийн хүч"
                type="number"
                step="any"
                variant="filled"
                placeholder="0.000"
              />
            </>
          )}
        </Box>
        <Stack direction="row" justifyContent={"flex-end"} spacing={1.5}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Түгээх эсэх"
            sx={{ m: 0 }}
          />
          <Button variant="outlined" color="inherit" onClick={onCloseForm}>
            Хаах
          </Button>
          <LoadingButton
            onClick={onSubmit}
            variant="contained"
            loading={isSubmitting}
            sx={{
              bgcolor: "primary.main",
              "&:hover": {
                bgcolor: "primary.dark",
              },
            }}
          >
            {!currentMeasurement ? "Үүсгэх" : "Хадгалах"}
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );

  const renderDocument = (
    <Card>
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Stack spacing={0}>
          <Typography
            variant="subtitle2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            Баримт бичгүүд
          </Typography>
          <Box
            gap={3}
            display="grid"
            gridTemplateColumns={{
              xs: "repeat(1, 1fr)",
              sm: "repeat(2, 1fr)",
            }}
          >
            <Stack spacing={0.5}>
              <UploadPDFField name="journal" label="Хэмжилтийн журнал" />
              {errors?.journal && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {errors.journal.message}
                </Typography>
              )}
            </Stack>
            <Stack spacing={0.5}>
              <RHFSelect
                name="journal_engineer"
                label="Хэмжсэн инженер"
                variant="filled"
                InputLabelProps={{ shrink: Boolean(journalEngineerValue) }}
              >
                <MenuItem
                  value=""
                  sx={{ fontStyle: "italic", color: "text.secondary" }}
                >
                  Сонгоно уу
                </MenuItem>
                <Divider sx={{ borderStyle: "dashed" }} />
                {engineers?.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.full_name}
                  </MenuItem>
                ))}
              </RHFSelect>
              {/* {errors?.journal_engineer && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {errors.journal_engineer.message}
                </Typography>
              )} */}
            </Stack>

            {/* <Stack spacing={0.5}>
              <UploadPDFField
                label="Хувийн хэрэг"
                name="passport"
                maxSize={10485760}
              />
              {errors?.passport && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {errors.passport.message}
                </Typography>
              )}
            </Stack> */}
            {/* <Stack spacing={0.5}>
              <RHFSelect
                name="passport_engineer"
                label="Хувийн хэрэг хөтөлсөн"
                variant="filled"
              >
                <MenuItem
                  value=""
                  sx={{ fontStyle: "italic", color: "text.secondary" }}
                >
                  Сонгоно уу
                </MenuItem>
                <Divider sx={{ borderStyle: "dashed" }} />
                {engineers?.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.full_name}
                  </MenuItem>
                ))}
              </RHFSelect>
              {errors?.passport_engineer && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {errors.passport_engineer.message}
                </Typography>
              )}
            </Stack> */}
          </Box>
        </Stack>
        <Stack spacing={0}>
          <Typography
            variant="subtitle2"
            sx={{ color: "text.primary", fontWeight: 600 }}
          >
            Фото зургууд
          </Typography>

          <RHFUpload
            multiple
            thumbnail
            name="photos"
            maxSize={3145728}
            showOnlyInput={true}
            onDrop={handleDrop}
            onRemove={handleRemoveFileFromUpload}
            onRemoveAll={handleRemoveAllFiles}
            onUpload={() => console.info("ON UPLOAD")}
            helperText="JPG, PNG, WEBP (Max 3MB тус бүр)"
          />
          {/* {errors?.photos && (
            <Typography
              variant="caption"
              color="error"
              sx={{ display: "block", mt: 0.5 }}
            >
              {errors.photos.message}
            </Typography>
          )} */}

          {photosData && photosData.length > 0 && (
            <Stack spacing={2}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, color: "text.secondary" }}
              >
                Зургуудад төрөл оноох ({photosData.length} зураг)
              </Typography>

              <Box
                gap={2}
                display="grid"
                gridTemplateColumns={{
                  xs: "repeat(1, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(4, 1fr)",
                }}
              >
                {photosData?.map((photoObj, index) => (
                  <Card key={`photos-${index}`} sx={{ p: 2 }}>
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
                            typeof photoObj.photo === "string"
                              ? photoObj.photo
                              : photoObj.photo?.preview ||
                                URL.createObjectURL(photoObj.photo)
                          }
                          loading="lazy"
                          sx={{
                            width: 1,
                            height: 1,
                            objectFit: "cover",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            willChange: "auto",
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFile(photoObj)}
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
                        {photoObj.photo.name || `Зураг ${index + 1}`}
                      </Typography>

                      <RHFSelect
                        name={`photos.${index}.type_id`}
                        label="Зургийн төрөл"
                        variant="filled"
                        size="small"
                      >
                        <MenuItem
                          value=""
                          sx={{
                            fontStyle: "italic",
                            color: "text.secondary",
                          }}
                        >
                          Төрөл сонгоно уу
                        </MenuItem>
                        <Divider sx={{ borderStyle: "dashed" }} />
                        {getAvailablePhotoTypes(index)?.map((photoType) => (
                          <MenuItem key={photoType?.id} value={photoType?.id}>
                            {photoType?.name}
                          </MenuItem>
                        ))}
                      </RHFSelect>
                    </Stack>
                  </Card>
                ))}
              </Box>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Card>
  );

  return (
    <FormProvider methods={methods}>
      <form onSubmit={onSubmit}>
        <Grid container spacing={1.5}>
          <Grid xs={12} md={6}>
            {renderProperties}
          </Grid>

          <Grid xs={12} md={6}>
            {renderDocument}
          </Grid>
        </Grid>
      </form>
    </FormProvider>
  );
});
