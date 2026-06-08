import PropTypes from "prop-types";
import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Stack,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import axiosInstance, { endpoints } from "src/utils/axios";
import Iconify from "src/components/iconify";

export default function GroupDetailDialog({
  open, onClose, group, onEdit, menuPermissions
}) {
  const [featureDetails, setFeatureDetails] = useState({});
  const [styleDetails, setStyleDetails] = useState({});
  const [loading, setLoading] = useState(false);

  const { id, name, items } = group || {};
  const itemsCount = items?.length || 0;

  useEffect(() => {
    if (!open || !items || items.length === 0) return;

    const fetchDetails = async () => {
      setLoading(true);
      try {
        const featureIds = [
          ...new Set(items.map((item) => item.feature).filter(Boolean)),
        ];
        const styleIds = [
          ...new Set(items.map((item) => item.style).filter(Boolean)),
        ];

        const featurePromises = featureIds.map(async (featureId) => {
          try {
            const response = await axiosInstance.get(
              endpoints.geoserver.layer.details(featureId)
            );
            return { id: featureId, data: response.data };
          } catch (error) {
            console.error(`Error fetching feature ${featureId}:`, error);
            return { id: featureId, data: null };
          }
        });

        const stylePromises = styleIds.map(async (styleId) => {
          try {
            const response = await axiosInstance.get(
              endpoints.geoserver.style.details(styleId)
            );
            return { id: styleId, data: response.data };
          } catch (error) {
            console.error(`Error fetching style ${styleId}:`, error);
            return { id: styleId, data: null };
          }
        });

        const [featureResults, styleResults] = await Promise.all([
          Promise.all(featurePromises),
          Promise.all(stylePromises),
        ]);

        const featuresMap = {};
        featureResults.forEach((result) => {
          featuresMap[result.id] = result.data;
        });

        const stylesMap = {};
        styleResults.forEach((result) => {
          stylesMap[result.id] = result.data;
        });

        setFeatureDetails(featuresMap);
        setStyleDetails(stylesMap);
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, items]);

  const renderFeatureInfo = (feature) => {
    if (!feature)
      return (
        <Typography variant="body2" color="text.secondary">
          Мэдээлэл байхгүй
        </Typography>
      );

    return (
      <Stack spacing={1}>
        <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Нэр:
            </Typography>
            <Typography variant="body2">
              {feature.title || feature.name || "-"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Хүснэгт:
            </Typography>
            <Typography variant="body2">
              {feature.table?.name || "-"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Store:
            </Typography>
            <Typography variant="body2">{feature.store || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              URL:
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {feature.url ? (
                <a href={feature.url} target="_blank" rel="noopener noreferrer">
                  {feature.url.length > 30
                    ? `${feature.url.substring(0, 30)}...`
                    : feature.url}
                </a>
              ) : (
                "-"
              )}
            </Typography>
          </Box>
        </Box>
        {feature.description && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Тайлбар:
            </Typography>
            <Typography variant="body2">{feature.description}</Typography>
          </Box>
        )}
      </Stack>
    );
  };
  const renderStyleInfo = (style) => {
    if (!style)
      return (
        <Typography variant="body2" color="text.secondary">
          Мэдээлэл байхгүй
        </Typography>
      );

    return (
      <Stack spacing={1}>
        <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Style нэр:
            </Typography>
            <Typography variant="body2">{style.style_name || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Layer:
            </Typography>
            <Typography variant="body2">{style.layer || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Төрөл:
            </Typography>
            <Typography variant="body2">{style.type || "-"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Формат:
            </Typography>
            <Typography variant="body2">{style.format || "-"}</Typography>
          </Box>
        </Box>
        {style.sld_body && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              SLD:
            </Typography>
            <Box
              sx={{
                p: 1,
                bgcolor: "grey.100",
                borderRadius: 1,
                maxHeight: 150,
                overflow: "auto",
                fontFamily: "monospace",
                fontSize: "0.75rem",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {style.sld_body.substring(0, 500)}
                {style.sld_body.length > 500 ? "..." : ""}
              </pre>
            </Box>
          </Box>
        )}
      </Stack>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Layer Group: {name}</Typography>
          <IconButton onClick={onClose} size="small">
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Group Information */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                Групын мэдээлэл
              </Typography>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    ID:
                  </Typography>
                  <Typography variant="body2">{id}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Нэр:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {name}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Layer тоо:
                  </Typography>
                  <Chip label={itemsCount} size="small" color="primary" />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Layer Items */}
          {items && items.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" color="primary" gutterBottom>
                  Давхаргын жагсаалт ({itemsCount})
                </Typography>
                <Stack spacing={2}>
                  {items.map((item, index) => {
                    const feature = featureDetails[item.feature];
                    const style = styleDetails[item.style];

                    return (
                      <Accordion key={index} variant="outlined">
                        <AccordionSummary
                          expandIcon={
                            <Iconify icon="eva:chevron-down-outline" />
                          }
                          sx={{
                            bgcolor: alpha("#1976d2", 0.04),
                            "&:hover": {
                              bgcolor: alpha("#1976d2", 0.08),
                            },
                          }}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            width="100%"
                          >
                            <Chip
                              label={`#${index + 1}`}
                              size="small"
                              color="primary"
                            />
                            <Typography variant="subtitle2" fontWeight="medium">
                              {feature?.title ||
                                feature?.name ||
                                `Layer ${item?.layer?.title || ''}`}
                            </Typography>
                            <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
                              <Chip
                                label={
                                  item.visible !== false
                                    ? "Харагдах"
                                    : "Нуугдмал"
                                }
                                size="small"
                                color={
                                  item.visible !== false ? "success" : "error"
                                }
                                variant="outlined"
                              />
                              {item.style && (
                                <Chip
                                  label="Style"
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </Box>
                        </AccordionSummary>

                        <AccordionDetails>
                          <Stack spacing={3}>
                            {/* Basic Item Info */}
                            <Box>
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                gutterBottom
                              >
                                Үндсэн мэдээлэл
                              </Typography>
                              <Box
                                display="grid"
                                gridTemplateColumns="repeat(3, 1fr)"
                                gap={2}
                              >
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Эрэмбэ:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {item.order}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Тунгалаг байдал:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {item.opacity || 1}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    Z-Index:
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                  >
                                    {item.z_index || 0}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>

                            <Box>
                              <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                gutterBottom
                              >
                                Feature
                              </Typography>
                              <Box
                                sx={{
                                  p: 2,
                                  bgcolor: "background.neutral",
                                  borderRadius: 1,
                                }}
                              >
                                {loading ? (
                                  <Stack spacing={1}>
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="text" width="40%" />
                                    <Skeleton variant="text" width="80%" />
                                  </Stack>
                                ) : (
                                  renderFeatureInfo(feature)
                                )}
                              </Box>
                            </Box>

                            {item.style && (
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  color="text.secondary"
                                  gutterBottom
                                >
                                  Style
                                </Typography>
                                <Box
                                  sx={{
                                    p: 2,
                                    bgcolor: "background.neutral",
                                    borderRadius: 1,
                                  }}
                                >
                                  {loading ? (
                                    <Stack spacing={1}>
                                      <Skeleton variant="text" width="60%" />
                                      <Skeleton variant="text" width="40%" />
                                      <Skeleton
                                        variant="rectangular"
                                        height={100}
                                      />
                                    </Stack>
                                  ) : (
                                    renderStyleInfo(style)
                                  )}
                                </Box>
                              </Box>
                            )}
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Хаах
        </Button>
        {onEdit && menuPermissions?.update && (
          <Button
            onClick={() => {
              onClose();
              onEdit();
            }}
            variant="contained"
          >
            Засах
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

GroupDetailDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  group: PropTypes.object,
  onEdit: PropTypes.func,
};
