import * as Yup from "yup";
import PropTypes from "prop-types";
import { useForm } from "react-hook-form";
import { useMemo, useEffect, useState, useCallback } from "react";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  Box,
  Button,
  MenuItem,
  Stack,
  Chip,
  Autocomplete,
  TextField,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";

import { requiredMsg } from "src/utils/regex";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import Iconify from "src/components/iconify";
import FormProvider, {
  RHFSelect,
  RHFTextField,
} from "src/components/hook-form";
import { useGetMenus } from "src/api/constant";

export default function SubLevelInlineForm({
  currentConstant,
  initialValues = null,
  parentId,
  onCancel,
  onSaved,
  iconOptions = [],
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { menus } = useGetMenus();

  const Schema = Yup.object().shape({
    key: Yup.string().required(requiredMsg),
    name: Yup.string().required(requiredMsg),
    code: Yup.string().nullable(),
    desc: Yup.string().nullable(),
    color: Yup.string().nullable(),
  });

  const defaultValues = useMemo(() => {
    if (currentConstant) {
      const currentParent =
        typeof currentConstant.parent === "object"
          ? currentConstant.parent?.id
          : currentConstant.parent;

      return {
        id: currentConstant.id || "",
        key: "SUBMENUS",
        name: currentConstant?.name || "",
        desc: currentConstant?.desc || "",
        code: currentConstant?.code || "",
        color: currentConstant?.color || "",
        parent: currentParent ?? parentId ?? "",
      };
    }
    if (initialValues) {
      const initialParent =
        typeof initialValues.parent === "object"
          ? initialValues.parent?.id
          : initialValues.parent;

      return {
        id: "",
        key: "SUBMENUS",
        name: initialValues.name || "",
        desc: initialValues.desc || "",
        code: initialValues.code || "",
        color: initialValues.color || "",
        parent: initialParent ?? parentId ?? "",
      };
    }
    return {
      id: "",
      key: "SUBMENUS",
      name: "",
      desc: "",
      code: "",
      color: "",
      parent: parentId || "",
    };
  }, [currentConstant, initialValues, parentId]);

  const methods = useForm({
    resolver: yupResolver(Schema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const { id, parent, ...rest } = data;
    const effectiveParent = parent || parentId || null;
    const request_body = { ...rest, parent_id: effectiveParent };
    const method = currentConstant ? "put" : "post";
    const URL = currentConstant
      ? endpoints.constant.edit(id)
      : endpoints.constant.create;
    try {
      const response = await axiosInstance[method](URL, request_body);
      if (response.status === 200 || response.status === 201) {
        enqueueSnackbar(
          `Цэс амжилттай ${currentConstant ? "өөрчлөгдлөө" : "нэмэгдлээ"}`,
        );
        onSaved && onSaved(response.data);
        reset();
      }
    } catch (error) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.response?.data?.results ||
        error?.message;

      const message =
        detail ||
        `Цэс ${currentConstant ? "өөрчлөх" : "үүсгэх"} үед алдаа гарлаа`;

      enqueueSnackbar(message, {
        variant: status && status < 500 ? "warning" : "error",
      });
    }
  });

  return (
    <>
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Box
          gap={2}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm: "repeat(1, 1fr)",
            md: "repeat(5, 1fr)",
          }}
          sx={{ mb: 1 }}
        >
          <RHFTextField name="name" label="Нэр" variant="filled" />
          <RHFSelect name="parent" label="Харъяа" variant="filled">
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              None
            </MenuItem>

            {menus.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </RHFSelect>
          <RHFTextField name="desc" label="Path" variant="filled" />
          <RHFTextField name="code" label="Эрэмбэ" variant="filled" />
          <RHFSelect name="color" label="Icon" variant="filled">
            <MenuItem
              value=""
              sx={{ fontStyle: "italic", color: "text.secondary" }}
            >
              None
            </MenuItem>

            {iconOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    component="img"
                    src={option.src}
                    alt={`${option.label} icon`}
                    sx={{ width: 24, height: 24 }}
                  />
                  {option.label}
                </Stack>
              </MenuItem>
            ))}
          </RHFSelect>
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-start">
          <LoadingButton
            type="submit"
            size="small"
            color="primary"
            variant="contained"
            loading={isSubmitting}
            disabled={!isDirty}
          >
            {currentConstant ? "Өөрчлөх" : "Нэмэх"}
          </LoadingButton>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={onCancel}
          >
            Буцах
          </Button>
        </Stack>
      </FormProvider>

      {/* Action удирдлага — зөвхөн дэд цэс (SUBMENUS) засах үед */}
      {currentConstant?.id && currentConstant?.key === "SUBMENUS" && (
        <SubmenuActions submenuId={currentConstant.id} />
      )}
    </>
  );
}

SubLevelInlineForm.propTypes = {
  currentConstant: PropTypes.object,
  initialValues: PropTypes.object,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
  onCancel: PropTypes.func,
  onSaved: PropTypes.func,
  iconOptions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      src: PropTypes.string.isRequired,
    }),
  ),
};

// ----------------------------------------------------------------------
// Дэд цэсний action-уудыг нэмж/хасах хэсэг (зөвхөн засах үед)

function SubmenuActions({ submenuId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [actions, setActions] = useState([]);
  const [available, setAvailable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addValue, setAddValue] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [confirmPerm, setConfirmPerm] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        endpoints.constant.submenuActions(submenuId),
      );
      setActions(res.data?.actions || []);
      setAvailable(res.data?.available || []);
    } catch (error) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [submenuId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    // Байгаа action type-ийг сонгосон бол шууд нэмнэ
    if (addValue && typeof addValue === "object" && addValue.id) {
      setBusy(true);
      try {
        await axiosInstance.post(endpoints.constant.addAction(submenuId), {
          action: addValue.id,
        });
        enqueueSnackbar("Үйлдэл нэмэгдлээ");
        setAddValue(null);
        setInputValue("");
        await load();
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || "Үйлдэл нэмэхэд алдаа гарлаа",
          { variant: "error" },
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    // Шинэ action type — латин түлхүүр + харагдах нэрийг асууна
    const typed = (inputValue || "").trim();
    if (!typed) return;
    setNewLabel(typed);
    setNewKey("");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const key = (newKey || "").trim();
    const label = (newLabel || "").trim();
    if (!key || !label) return;
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.constant.addAction(submenuId), {
        name: key,
        label,
      });
      enqueueSnackbar("Шинэ үйлдэл үүсгэж нэмлээ");
      setCreateOpen(false);
      setAddValue(null);
      setInputValue("");
      await load();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Үйлдэл үүсгэхэд алдаа гарлаа",
        { variant: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirmPerm) return;
    setBusy(true);
    try {
      await axiosInstance.post(endpoints.constant.removeAction(submenuId), {
        permission: confirmPerm.id,
      });
      enqueueSnackbar("Үйлдэл хаслаа");
      setConfirmPerm(null);
      await load();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Үйлдэл хасахад алдаа гарлаа",
        { variant: "error" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Үйлдлүүд (эрх)
      </Typography>

      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
          {actions.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Үйлдэл алга.
            </Typography>
          )}
          {actions.map((a) => (
            <Chip
              key={a.id}
              label={a.name || a.key}
              onDelete={() => setConfirmPerm(a)}
              deleteIcon={<Iconify icon="eva:close-fill" />}
              variant="outlined"
              size="small"
            />
          ))}
        </Stack>
      )}

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ maxWidth: 480 }}
      >
        <Autocomplete
          freeSolo
          fullWidth
          size="small"
          options={available}
          getOptionLabel={(o) =>
            typeof o === "string" ? o : o.label || o.name || ""
          }
          isOptionEqualToValue={(o, v) => o.id === v?.id}
          value={addValue}
          onChange={(e, v) => setAddValue(v)}
          inputValue={inputValue}
          onInputChange={(e, v) => setInputValue(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Үйлдэл нэмэх / шинээр үүсгэх"
              placeholder="Сонгох эсвэл бичих"
            />
          )}
        />
        <LoadingButton
          variant="contained"
          size="small"
          loading={busy}
          onClick={handleAdd}
          startIcon={<Iconify icon="mingcute:add-line" />}
        >
          Нэмэх
        </LoadingButton>
      </Stack>

      <Dialog
        open={!!confirmPerm}
        onClose={() => (busy ? null : setConfirmPerm(null))}
      >
        <DialogTitle>Үйлдэл хасах</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            "{confirmPerm?.name || confirmPerm?.key}" үйлдлийг энэ дэд цэснээс
            хасах уу?
          </Typography>
          {confirmPerm?.role_count > 0 && (
            <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
              Анхаар: энэ үйлдэл {confirmPerm.role_count} эрх (role)-д
              ашиглагдаж байна. Хасвал тэдгээрээс мөн хасагдана.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmPerm(null)}
            disabled={busy}
            color="inherit"
            variant="outlined"
          >
            Буцах
          </Button>
          <LoadingButton
            onClick={handleRemove}
            loading={busy}
            color="error"
            variant="contained"
          >
            Хасах
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Шинэ action type үүсгэх — латин түлхүүр + харагдах нэр */}
      <Dialog
        open={createOpen}
        onClose={() => (busy ? null : setCreateOpen(false))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Шинэ үйлдэл үүсгэх</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Түлхүүр үг (латин)"
              placeholder="create / update / approve ..."
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              helperText="Эрх шалгахад DRF үйлдлийн нэртэй (латин) таарна. Ж: create, update, delete, list, detail."
              fullWidth
            />
            <TextField
              label="Харагдах нэр (Label)"
              placeholder="Жишээ: Томилох"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={busy}
            color="inherit"
            variant="outlined"
          >
            Буцах
          </Button>
          <LoadingButton
            onClick={handleCreate}
            loading={busy}
            variant="contained"
            disabled={!newKey.trim() || !newLabel.trim()}
          >
            Үүсгэх
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

SubmenuActions.propTypes = {
  submenuId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    .isRequired,
};
