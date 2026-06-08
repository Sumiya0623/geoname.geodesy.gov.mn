"use client";

import PropTypes from "prop-types";
import * as Yup from "yup";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";

import {
  Box,
  Card,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Divider,
  Stack,
  Grid,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { LoadingButton } from "@mui/lab";

import Iconify from "src/components/iconify";
import FormProvider, {
  RHFUpload,
} from "src/components/hook-form";

// ----------------------------------------------------------------------

const DOCUMENT_TYPES = [
  { id: 1, name: "Акт" },
  { id: 2, name: "Тайлан" },
  { id: 3, name: "Гэрчилгээ" },
  { id: 4, name: "Паспорт" },
  { id: 5, name: "Бусад" },
];

const DOCUMENT_LABELS = [
    {
        "id": 68,
        "point": {
            "id": 50,
            "created_date": "2025-09-01",
            "modified_date": "2025-09-01",
            "last_view": "2025-09-01",
            "views": 1,
            "name": "33test",
            "number": "33",
            "geoloc": null,
            "user": null,
            "center": 182,
            "status": null,
            "nomek": [],
            "unit": []
        },
        "system": {
            "id": 199,
            "name": "ITRF2014",
            "key": "GEODETICSYSTEM",
            "parent": null,
            "desc": "",
            "code": "EPSG:7789",
            "color": "",
            "label": "Cartesian"
        },
        "network": {
            "id": 131,
            "name": "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ",
            "key": "GEODETIC_NETWORK",
            "parent": null,
            "desc": null,
            "code": "1",
            "color": null,
            "label": ""
        },
        "description": null
    },
    {
        "id": 1,
        "point": {
            "id": 50,
            "created_date": "2025-09-01",
            "modified_date": "2025-09-01",
            "last_view": "2025-09-01",
            "views": 1,
            "name": "33test",
            "number": "33",
            "geoloc": null,
            "user": null,
            "center": 182,
            "status": null,
            "nomek": [],
            "unit": []
        },
        "system": {
            "id": 199,
            "name": "ITRF2014",
            "key": "GEODETICSYSTEM",
            "parent": null,
            "desc": "",
            "code": "EPSG:7789",
            "color": "",
            "label": "Cartesian"
        },
        "network": {
            "id": 131,
            "name": "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ 2",
            "key": "GEODETIC_NETWORK",
            "parent": null,
            "desc": null,
            "code": "1",
            "color": null,
            "label": ""
        },
        "description": null
    },
    {
        "id": 12,
        "point": {
            "id": 50,
            "created_date": "2025-09-01",
            "modified_date": "2025-09-01",
            "last_view": "2025-09-01",
            "views": 1,
            "name": "33test",
            "number": "33",
            "geoloc": null,
            "user": null,
            "center": 182,
            "status": null,
            "nomek": [],
            "unit": []
        },
        "system": {
            "id": 199,
            "name": "ITRF2014 3 ",
            "key": "GEODETICSYSTEM",
            "parent": null,
            "desc": "",
            "code": "EPSG:7789",
            "color": "",
            "label": "Cartesian"
        },
        "network": {
            "id": 131,
            "name": "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ 5",
            "key": "GEODETIC_NETWORK",
            "parent": null,
            "desc": null,
            "code": "1",
            "color": null,
            "label": ""
        },
        "description": null
    },
    {
        "id": 66,
        "point": {
            "id": 50,
            "created_date": "2025-09-01",
            "modified_date": "2025-09-01",
            "last_view": "2025-09-01",
            "views": 1,
            "name": "33test",
            "number": "33",
            "geoloc": null,
            "user": null,
            "center": 182,
            "status": null,
            "nomek": [],
            "unit": []
        },
        "system": {
            "id": 199,
            "name": "ITRF2014",
            "key": "GEODETICSYSTEM22 ",
            "parent": null,
            "desc": "",
            "code": "EPSG:7789",
            "color": "",
            "label": "Cartesian"
        },
        "network": {
            "id": 131,
            "name": "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ aa",
            "key": "GEODETIC_NETWORK ",
            "parent": null,
            "desc": null,
            "code": "1",
            "color": null,
            "label": ""
        },
        "description": null
    },
    {
        "id": 55,
        "point": {
            "id": 50,
            "created_date": "2025-09-01",
            "modified_date": "2025-09-01",
            "last_view": "2025-09-01",
            "views": 1,
            "name": "33test",
            "number": "33",
            "geoloc": null,
            "user": null,
            "center": 182,
            "status": null,
            "nomek": [],
            "unit": []
        },
        "system": {
            "id": 199,
            "name": "ITRF2014",
            "key": "GEODETICSYSTEM zxc",
            "parent": null,
            "desc": "",
            "code": "EPSG:7789",
            "color": "",
            "label": "Cartesian"
        },
        "network": {
            "id": 131,
            "name": "ТРИАНГУЛЯЦИЙН  СҮЛЖЭЭ 66",
            "key": "GEODETIC_NETWORK",
            "parent": null,
            "desc": null,
            "code": "1",
            "color": null,
            "label": ""
        },
        "description": null
    },
];

// ----------------------------------------------------------------------

PointDocumentDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
};

export default function PointDocumentDialog({ open, onClose, onSubmit }) {
  const DocumentSchema = Yup.object().shape({
    // acts: Yup.array().of(
    //   Yup.object().shape({
    //     labels: Yup.array().min(1, "Наад зах нь нэг шошго сонгоно уу"),
    //     note: Yup.string(),
    //     file: Yup.mixed().required("Файл оруулна уу"),
    //   })
    // ),
    // reports: Yup.array().of(
    //   Yup.object().shape({
    //     labels: Yup.array().min(1, "Наад зах нь нэг шошго сонгоно уу"),
    //     note: Yup.string(),
    //     file: Yup.mixed().required("Файл оруулна уу"),
    //   })
    // ),
  });

  const defaultValues = {
    acts: [{ labels: [], file: null }],
    reports: [{ labels: [], file: null }],
  };

  const methods = useForm({
    resolver: yupResolver(DocumentSchema),
    defaultValues,
  });

  const {
    reset,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const { fields: actFields, append: appendAct, remove: removeAct } = useFieldArray({
    control,
    name: "acts",
  });

  const { fields: reportFields, append: appendReport, remove: removeReport } = useFieldArray({
    control,
    name: "reports",
  });

  const handleAddAct = () => {
    appendAct({ labels: [], file: null });
  };

  const handleAddReport = () => {
    appendReport({ labels: [], file: null });
  };

  const onFormSubmit = async (data) => {
    try {
      if (onSubmit) {
        await onSubmit(data);
      }
      reset();
      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  const renderDocumentForm = (type, fields, remove, add) => {
    const isAct = type === 'acts';
    const title = isAct ? 'Акт' : 'Тайлан';
    
    return (
      <Card sx={{ p: 1.5, mb: 2, overflow: 'auto' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2">{title}</Typography>
        </Stack>
        
        {fields.map((field, index) => (
          <Box key={field.id} sx={{ mb: 1.5 }}>
            {index > 0 && (
              <Divider sx={{ my: 1, borderStyle: "dashed" }} />
            )}
            
            <Stack spacing={1.5}>
              <Controller
                name={`${type}.${index}.labels`}
                control={control}
                render={({ field, fieldState: { error } }) => (
                  <>
                    <Grid container spacing={1}>
                      {DOCUMENT_LABELS.map((doc) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={doc.id}>
                          <Card 
                            onClick={() => {
                              const isSelected = field.value.includes(doc.id);
                              let newLabels = [...field.value];
                              
                              if (isSelected) {
                                newLabels = newLabels.filter(id => id !== doc.id);
                              } else {
                                newLabels.push(doc.id);
                              }
                              
                              field.onChange(newLabels);
                            }}
                            sx={{ 
                              p: 1, 
                              cursor: 'pointer',
                              border: (theme) => `1px solid ${
                                field.value.includes(doc.id) 
                                  ? theme.palette.primary.main 
                                  : theme.palette.divider
                              }`,
                              bgcolor: (theme) => 
                                field.value.includes(doc.id)
                                  ? alpha(theme.palette.primary.main, 0.08) 
                                  : 'background.paper',
                              '&:hover': {
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                              }
                            }}
                          >
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Box 
                                sx={{ 
                                  width: 16, 
                                  height: 16, 
                                  borderRadius: '50%',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: field.value.includes(doc.id) 
                                    ? 'primary.main' 
                                    : 'action.disabled',
                                  color: 'common.white'
                                }}
                              >
                                {field.value.includes(doc.id) && 
                                  <Iconify icon="eva:checkmark-fill" width={10} />
                                }
                              </Box>
                              
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  flexGrow: 1, 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {doc.system.name}, {doc.network.name}
                              </Typography>
                            </Stack>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    
                    {error && (
                      <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }}>
                        {error.message}
                      </Typography>
                    )}
                  </>
                )}
              />
              
              <Stack direction="row" spacing={1} alignItems="center">
                {fields.length > 1 && (
                  <IconButton 
                    size="small"
                    onClick={() => remove(index)}
                    sx={{ color: 'error.main', p: 0.5 }}
                  >
                    <Iconify icon="eva:trash-2-outline" width={14} />
                  </IconButton>
                )}
                
                <Box sx={{ flexGrow: 1 }}>
                  <RHFUpload
                    name={`${type}.${index}.file`}
                    accept={{
                      "application/pdf": [".pdf"],
                      "application/msword": [".doc"],
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                    }}
                  />
                </Box>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Card>
    );
  };

  return (
    <Dialog
      open={open} 
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'background.paper' : 'background.default',
          backgroundImage: (theme) => 
            `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          boxShadow: (theme) => `0 24px 48px -12px ${alpha(theme.palette.primary.main, 0.18)}`,
          overflow: 'auto',
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 2, 
        pt: 3,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="mdi:file-document-multiple" color="primary.main" width={28} height={28} />
          <Typography variant="h6">Хэмжилттэй холбогдох баримт бичиг</Typography>
        </Stack>
        
        <IconButton onClick={onClose}>
          <Iconify icon="eva:close-fill" />
        </IconButton>
      </DialogTitle>
      
      <FormProvider methods={methods} onSubmit={handleSubmit(onFormSubmit)}>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={3}>
            {renderDocumentForm('acts', actFields, removeAct, handleAddAct)}
            {renderDocumentForm('reports', reportFields, removeReport, handleAddReport)}
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            variant="outlined" 
            onClick={onClose}
            startIcon={<Iconify icon="eva:close-fill" />}
          >
            Цуцлах
          </Button>
          <LoadingButton 
            type="submit"
            variant="contained" 
            loading={isSubmitting}
            startIcon={<Iconify icon="eva:save-fill" />}
          >
            Хадгалах
          </LoadingButton>
        </DialogActions>
      </FormProvider>
    </Dialog>
  );
}
