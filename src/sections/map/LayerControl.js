import React, { useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Popover,
  Avatar,
  Radio,
  RadioGroup,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
} from "@mui/material";
import {
  Map as MapIcon,
  Satellite as SatelliteIcon,
  Terrain as TerrainIcon,
  Public as PublicIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
} from "@mui/icons-material";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useGetBaseLayers } from "src/api/map";
import OpacityController from "src/components/map/OpacityController";

// ----------------------------------------------------------------------
// Чирж эрэмбэлэх нэг мөр. Жагсаалтын ДЭЭД нь газрын зураг дээр ч ДЭЭР
// зурагдана (эрэмбэ = zIndex).
// ----------------------------------------------------------------------
const SortableOverlayRow = ({
  oc,
  checked,
  onToggle,
  opacity,
  onOpacityChange,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: oc.key });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderRadius: 1,
        ...(isDragging
          ? { opacity: 0.7, bgcolor: "action.hover", position: "relative", zIndex: 1 }
          : {}),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box
          {...attributes}
          {...listeners}
          title="Чирж эрэмбэлэх"
          sx={{
            display: "flex",
            color: "text.disabled",
            cursor: "grab",
            touchAction: "none",
            "&:active": { cursor: "grabbing" },
            "&:hover": { color: "text.primary" },
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <FormControlLabel
          sx={{ ml: 0, flex: 1 }}
          control={
            <Checkbox checked={checked} onChange={onToggle} />
          }
          label={oc.label || oc.key}
        />
      </Box>
      {checked && onOpacityChange && (
        <Box onClick={(e) => e.stopPropagation()}>
          <OpacityController
            value={opacity}
            onChange={onOpacityChange}
            color={oc.color || "#607d8b"}
            label="Ил тод байдал"
            showLabel={false}
            showValue
            sx={{ px: 4, pb: 1, pt: 0.5, opacity: 0.85 }}
          />
        </Box>
      )}
    </Box>
  );
};

const LayerControl = ({
  open,
  anchorEl,
  onClose,
  baseMap,
  onBaseMapChange,
  onBaseMapOpacityChange,
  baseMapOpacity = {},
  recountEnabled = false,
  recountVisible = false,
  onToggleRecount,
  overlayLegal = false,
  onToggleLegal,
  overlayOpacity = {},
  onOverlayOpacity,
  // Backend‑ээс role‑оор шүүсэн тохиргоо. baseConfigs өгвөл суурь радиог түүгээр
  // (нэр/өнгө/дараалал), overlayConfigs өгвөл зөвхөн зөвшөөрсөн overlay‑г харуулна.
  baseConfigs = null,
  overlayConfigs = null,
  // Backend‑ээс ирсэн ДУРЫН overlay (hardcoded бус) — generic checkbox‑оор.
  extraOverlays = [],
  extraOverlayOn = {},
  onToggleExtraOverlay,
  // Чирж эрэмбэ солих — шинэ дараалал (түлхүүрүүд, дээрээс доош) буцаана
  onReorderOverlays,
}) => {
  const { baseLayers } = useGetBaseLayers();

  // Чирэх мэдрэгч — 4px хөдөлсний дараа эхэлнэ (checkbox дарахад саад болохгүй)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const overlayKeys = useMemo(
    () => extraOverlays.map((o) => o.key),
    [extraOverlays],
  );
  const handleDragEnd = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id || !onReorderOverlays) return;
      const from = overlayKeys.indexOf(active.id);
      const to = overlayKeys.indexOf(over.id);
      if (from < 0 || to < 0) return;
      onReorderOverlays(arrayMove(overlayKeys, from, to));
    },
    [overlayKeys, onReorderOverlays],
  );

  useEffect(() => {
    if (baseLayers) {
      const colors = [
        "#2196f3",
        "#4caf50",
        "#ff9800",
        "#f44336",
        "#9c27b0",
        "#00bcd4",
        "#795548",
        "#607d8b",
      ];

      // colors хувьсагч нь одоогоор ашиглагдахгүй ч
      // ирээдүйд Layer group-уудын өнгө ялгахад зориулагдсан.
      void colors;
    }
  }, [baseLayers]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      PaperProps={{
        sx: {
          padding: 0,
          width: 400,
          maxHeight: "calc(100vh - 200px)",
          overflow: "auto",
          maxWidth: "calc(100vw - 80px)",
        },
      }}
      sx={{
        "& .MuiPopover-paper": {
          marginRight: "40px !important",
        },
      }}
    >
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "white",
          px: 2,
          py: 1.5,
          borderRadius: "4px 4px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <MapIcon sx={{ color: "white" }} />
          <Typography variant="h6" sx={{ m: 0, fontWeight: 600 }}>
            Cуурь зураг
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: "white",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ pt: 0.5 }}>
        <Box>
          <Box sx={{ pl: 2, py: 1 }}>
            <RadioGroup
              value={baseMap || "CRV"}
              onChange={(e) =>
                onBaseMapChange && onBaseMapChange(e.target.value)
              }
            >
              {(baseConfigs?.length
                ? baseConfigs.map((c) => c.key)
                : ["CRV", "OSM", "GMS", "ESRI", "TOPO", "M100k", "M100kGeoName"]
              ).map((key) => {
                const colorMap = {
                  CRV: "#1976d2",
                  OSM: "#4caf50",
                  GMS: "#ff9800",
                  ESRI: "#9c27b0",
                  TOPO: "#795548",
                  M100k: "#607d8b",
                  M100kGeoName: "#f44336",
                  BASEMAP: "#e91e63",
                  NOMENCLATURE: "#00bcd4",
                };
                const iconFor = (k) => {
                  if (k === "GMS" || k === "ESRI") return <SatelliteIcon />;
                  if (k === "TOPO") return <TerrainIcon />;
                  if (k === "OSM") return <PublicIcon />;
                  return <MapIcon />;
                };
                const labelMap = {
                  CRV: "Voyager",
                  OSM: "OpenStreetMap",
                  GMS: "Google Satellite",
                  ESRI: "Esri Imagery",
                  TOPO: "Topographic",
                  M100k: "Байр зүй",
                  M100kGeoName: "Нэрийн зураг",
                  BASEMAP: "Суурь зураг",
                  NOMENCLATURE: "Нэрлэвэр",
                };
                const cfg = (baseConfigs || []).find((c) => c.key === key);
                const selected = baseMap === key;
                const color = cfg?.color || colorMap[key] || "#607d8b";

                return (
                  <Box key={key}>
                    <FormControlLabel
                      value={key}
                      control={
                        <Radio
                          sx={{
                            color: color,
                            "&.Mui-checked": { color: color },
                          }}
                        />
                      }
                      label={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Avatar
                            variant="rounded"
                            sx={{
                              width: 24,
                              height: 24,
                              backgroundColor: `${color}18`,
                              color,
                            }}
                          >
                            {iconFor(key)}
                          </Avatar>
                          <Typography variant="body2">
                            {cfg?.label || labelMap[key] || key}
                          </Typography>
                        </Box>
                      }
                      sx={{
                        margin: 0,
                        borderRadius: 1,
                        border: selected
                          ? `1px solid ${color}`
                          : "1px solid transparent",
                        backgroundColor: selected
                          ? `${color}08`
                          : "transparent",
                        "&:hover": {
                          backgroundColor: `${color}12`,
                        },
                        px: 1,
                        py: 0.5,
                        mx: 1,
                        width: "90%",
                      }}
                    />
                    {selected && (
                      <Box onClick={(e) => e.stopPropagation()}>
                        <OpacityController
                          value={baseMapOpacity[key] || 1}
                          onChange={(opacity) => {
                            if (onBaseMapOpacityChange) {
                              onBaseMapOpacityChange(key, opacity);
                            }
                          }}
                          color={color}
                          label="Ил тод байдал"
                          showLabel={false}
                          showValue={true}
                          sx={{
                            px: 4,
                            pb: 1,
                            pt: 0.5,
                            opacity: 0.8,
                            "&:hover": { opacity: 1 },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </RadioGroup>
          </Box>

          {/* --- Overlay давхаргууд (checkbox) --- */}
          <Divider />
          <Box sx={{ px: 2, py: 1 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ pl: 1 }}
            >
              Давхаргууд
            </Typography>

            {recountEnabled && (
              <FormControlLabel
                sx={{ ml: 0, display: "flex" }}
                control={
                  <Checkbox
                    checked={recountVisible}
                    onChange={() => onToggleRecount && onToggleRecount()}
                  />
                }
                label="Тодруулалт (төслийн нэрс)"
              />
            )}

            {/* LEGAL — тусгай (вектор) overlay. Зөвхөн тохиргоо байвал. */}
            {overlayConfigs &&
              overlayConfigs.some((c) => c.key === "LEGAL") && (
                <FormControlLabel
                  sx={{ ml: 0, display: "flex" }}
                  control={
                    <Checkbox
                      checked={overlayLegal}
                      onChange={() => onToggleLegal && onToggleLegal()}
                    />
                  }
                  label={
                    (overlayConfigs.find((c) => c.key === "LEGAL") || {})
                      .label || "Шийдвэрийн сан"
                  }
                />
              )}

            {/* Backend‑ээс ирсэн бусад бүх overlay — чирж эрэмбэлж болно.
                Жагсаалтын дээд нь газрын зураг дээр ч дээр зурагдана. */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={overlayKeys}
                strategy={verticalListSortingStrategy}
              >
                {extraOverlays.map((oc) => (
                  <SortableOverlayRow
                    key={oc.key}
                    oc={oc}
                    checked={!!extraOverlayOn[oc.key]}
                    onToggle={() =>
                      onToggleExtraOverlay && onToggleExtraOverlay(oc.key)
                    }
                    opacity={overlayOpacity[oc.key] ?? oc?.params?.opacity ?? 1}
                    onOpacityChange={
                      onOverlayOpacity
                        ? (v) => onOverlayOpacity(oc.key, v)
                        : null
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
          </Box>
        </Box>
      </Box>

    </Popover>
  );
};

export default LayerControl;
