import * as Yup from 'yup';
import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import {
  Stack,
  Button,
  Dialog,
  MenuItem,
  Divider,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
} from '@mui/material';

import LoadingButton from '@mui/lab/LoadingButton';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFSelect } from 'src/components/hook-form';

import axiosInstance, { endpoints } from 'src/utils/axios';
import { Delete, FileUpload } from '@mui/icons-material';

// ----------------------------------------------------------------------

export default function UserQuickEditForm({ currentUser, refetch, open, onClose, roles }) {
  const { enqueueSnackbar } = useSnackbar();

  const NewUserSchema = Yup.object().shape({
    role: Yup.string().required('Хэрэглэгчийн эрхийг заавал сонгоно.'),
    permission_letter: Yup.mixed()
      .nullable()
      .test('fileType', 'Зөвхөн PDF файл хүлээн авна', (value) => {
        if (!value) return true;
        return value && value.type === 'application/pdf';
      }),
  });

  const defaultValues = useMemo(
    () => ({
      id: currentUser?.id || '',
      role: currentUser?.role?.id || '',
      permission_letter: currentUser?.permission_letter || null,
    }),
    [currentUser]
  );

  const methods = useForm({
    resolver: yupResolver(NewUserSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = methods;

  const permission_letter = watch('permission_letter');
  const onSubmit = handleSubmit(async (data) => {
    const { id, role, permission_letter } = data;

    const formData = new FormData();
    formData.append('role', role);

    // ✅ зөвхөн permission_letter байгаа үед л нэмнэ
    if (permission_letter instanceof File) {
      formData.append('permission_letter', permission_letter);
    }

    const method = currentUser ? 'patch' : 'post';
    const URL = currentUser ? endpoints.user.edit(id) : endpoints.user.create;

    try {
      const response = await axiosInstance[method](URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      enqueueSnackbar(`Эрх амжилттай ${currentUser ? 'өөрчлөгдлөө' : 'нэмэгдлээ'}`);
      reset();
      onClose();
      refetch();
    } catch (error) {
      console.error(error);
      enqueueSnackbar(`Эрх ${currentUser ? 'өөрчлөх' : 'үүсгэх'} үед алдаа гарлаа`, {
        variant: 'error',
      });
    }
  });

  return (
    <Dialog
      fullWidth
      maxWidth={false}
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { maxWidth: 720 } }}
    >
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <DialogTitle>Хэрэглэгчийн эрх</DialogTitle>

        <DialogContent sx={{ pt: 5 }}>
          <RHFSelect name="role" label="Эрх">
            <MenuItem value="">None</MenuItem>
            <Divider sx={{ borderStyle: 'dashed' }} />
            {roles?.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </RHFSelect>

          <Stack spacing={1.5} sx={{ mt: 3 }}>
            <Typography variant="subtitle2">
              Нууцтай танилцах эрхийн олгосон мэдэгдэл (PDF)
            </Typography>

            {!permission_letter || typeof permission_letter !== 'string' ? (
              <Button component="label" variant="outlined" startIcon={<FileUpload />}>
                PDF файл сонгох
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setValue('permission_letter', file, { shouldValidate: true });
                    }
                  }}
                />
              </Button>
            ) : (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                  {typeof permission_letter === 'string'
                    ? permission_letter.split('/').pop()
                    : permission_letter}
                </Typography>
                <Button onClick={() => setValue('permission_letter', null)} color="error">
                  <Delete />
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Буцах
          </Button>
          <LoadingButton type="submit" color="primary" variant="contained" loading={isSubmitting}>
            Тохируулах
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}

UserQuickEditForm.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  refetch: PropTypes.func,
  currentUser: PropTypes.object,
  roles: PropTypes.array,
};
