import React, { useEffect } from "react";
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
} from "@mui/icons-material";
import { useGetBaseLayers } from "src/api/map";
import OpacityController from "./OpacityController";

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
  overlayBasemap = false,
  onToggleBasemap,
  overlayNomencl = false,
  onToggleNomencl,
}) => {
  const { baseLayers } = useGetBaseLayers();

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
          size="small"
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
              {[
                "CRV",
                "OSM",
                "GMS",
                "ESRI",
                "TOPO",
                "M100k",
                "M100kGeoName",
              ].map((key) => {
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
                const selected = baseMap === key;
                const color = colorMap[key] || "#607d8b";

                return (
                  <Box key={key}>
                    <FormControlLabel
                      value={key}
                      control={
                        <Radio
                          size="small"
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
                            {labelMap[key] || key}
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
                    size="small"
                    checked={recountVisible}
                    onChange={() => onToggleRecount && onToggleRecount()}
                  />
                }
                label="Тодруулалт (төслийн нэрс)"
              />
            )}

            <FormControlLabel
              sx={{ ml: 0, display: "flex" }}
              control={
                <Checkbox
                  size="small"
                  checked={overlayBasemap}
                  onChange={() => onToggleBasemap && onToggleBasemap()}
                />
              }
              label="Суурь зураг"
            />
            <FormControlLabel
              sx={{ ml: 0, display: "flex" }}
              control={
                <Checkbox
                  size="small"
                  checked={overlayNomencl}
                  onChange={() => onToggleNomencl && onToggleNomencl()}
                />
              }
              label="Нэрлэвэр"
            />
          </Box>
        </Box>
      </Box>
    </Popover>
  );
};

export default LayerControl;
