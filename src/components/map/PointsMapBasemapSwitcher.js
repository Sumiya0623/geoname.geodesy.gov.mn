import React, { useMemo, useState } from "react";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Paper,
  Avatar,
} from "@mui/material";
import {
  Layers as LayersIcon,
  Satellite as SatelliteIcon,
  Map as MapIcon,
  Terrain as TerrainIcon,
  Public as PublicIcon,
} from "@mui/icons-material";

/**
 * options проп:
 * - Хэрэв ARRAY байвал: [{ key, label?, description?, icon?, color?, preview? }, ...]
 * - Хэрэв OBJECT байвал: { CRV: { label?, description?, icon?, color?, preview? }, ... }
 *   (Map2-оос ирдэг baseMapSources шиг OpenLayers Source объект дамжсан ч болно —
 *    тэгвэл label/description/icon/color-ыг default-оор үүсгэнэ)
 */
const BasemapSwitcher = ({ baseMap, setBaseMap, options }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // default icon-ыг key-д үндэслэж сонгох жижиг туслах
  const defaultIcon = (key) => {
    if (key?.toLowerCase().includes("sat") || key === "GMS" || key === "ESRI")
      return <SatelliteIcon />;
    if (key?.toLowerCase().includes("topo") || key === "TOPO")
      return <TerrainIcon />;
    if (key === "OSM") return <PublicIcon />;
    return <MapIcon />;
  };

  // default color palette
  const defaultColor = (key) => {
    switch (key) {
      case "CRV":
        return "#1976d2";
      case "OSM":
        return "#4caf50";
      case "GMS":
        return "#ff9800";
      case "ESRI":
        return "#9c27b0";
      case "TOPO":
        return "#795548";
      default:
        return "#607d8b";
    }
  };

  // options-ыг үзүүлэлтэд нормчлох
  const basemapOptions = useMemo(() => {
    if (!options) {
      // Хэрэв options ирээгүй бол хуучин жагсаалтыг fallback болгож үлдээе
      return [
        {
          key: "CRV",
          label: "Voyager",
          description: "Clean street map",
          icon: <MapIcon />,
          color: "#1976d2",
          preview:
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/6/32/23.png",
        },
        {
          key: "OSM",
          label: "OpenStreetMap",
          icon: <PublicIcon />,
          color: "#4caf50",
          preview: "https://tile.openstreetmap.org/6/32/23.png",
        },
        {
          key: "GMS",
          label: "Satellite",
          description: "Google satellite",
          icon: <SatelliteIcon />,
          color: "#ff9800",
          preview: "https://mt1.google.com/vt/lyrs=s&x=32&y=23&z=6",
        },
        {
          key: "ESRI",
          label: "ESRI Imagery",
          description: "High resolution",
          icon: <SatelliteIcon />,
          color: "#9c27b0",
          preview:
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/23/32",
        },
        {
          key: "M100k",
          label: "Байр зүй (Local)",
          description: "1:100'000 байр зүйн зураг — локал серверээс",
          color: "#9c27b0",

          wms: {
            url: `${process.env.NEXT_PUBLIC_GEOSERVER_URL}/gwc/service/wms`,
            params: {
              LAYERS: "point:raster",
              STYLES: "",
              FORMAT: "image/png",
              TRANSPARENT: "true",
              TILED: "true",
              VERSION: "1.1.1",
              SRS: "EPSG:3857",
            },
            serverType: "geoserver",
            crossOrigin: "anonymous",
          },
        },

        {
          key: "TOPO",
          label: "Topographic",
          description: "Terrain details",
          icon: <TerrainIcon />,
          color: "#795548",
          preview: "https://tile.opentopomap.org/6/32/23.png",
        },
      ];
    }

    // ARRAY: шууд хэрэглэнэ, зүй бус талбаруудыг default-оор нөхнө
    if (Array.isArray(options)) {
      return options.map((o) => ({
        key: o.key,
        label: o.label ?? o.key,
        description: o.description ?? "",
        icon: o.icon ?? defaultIcon(o.key),
        color: o.color ?? defaultColor(o.key),
        preview: o.preview,
      }));
    }

    // OBJECT: key-үүдээр массив үүсгэнэ
    return Object.keys(options).map((key) => {
      const meta = options[key] || {};
      return {
        key,
        label: meta.label ?? key,
        description: meta.description ?? "",
        icon: meta.icon ?? defaultIcon(key),
        color: meta.color ?? defaultColor(key),
        preview: meta.preview,
      };
    });
  }, [options]);

  const current = useMemo(() => {
    return basemapOptions.find((o) => o.key === baseMap) ?? basemapOptions[0];
  }, [basemapOptions, baseMap]);

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleSelect = (key) => {
    setBaseMap(key);
    handleClose();
  };

  return (
    <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 1000 }}>
      <Tooltip title="Суурь зураг солих" arrow placement="left">
        <Paper
          elevation={3}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            backgroundColor: "white",
            "&:hover": {
              elevation: 6,
              transform: "translateY(-1px)",
              transition: "all 0.2s ease-in-out",
            },
          }}
        >
          <IconButton
            onClick={handleClick}
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              color: current?.color,
              backgroundColor: "transparent",
              "&:hover": { backgroundColor: `${current?.color}10` },
            }}
          >
            {current?.icon ?? <LayersIcon />}
          </IconButton>
        </Paper>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            width: 320,
            borderRadius: 2,
            mt: 1,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            border: "1px solid #e0e0e0",
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid #f0f0f0" }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#212121" }}>
            Суурь зураг сонгох
          </Typography>
        </Box>

        {basemapOptions.map((option) => (
          <MenuItem
            key={option.key}
            onClick={() => handleSelect(option.key)}
            selected={baseMap === option.key}
            sx={{
              p: 1.5,
              alignItems: "stretch",
              "&.Mui-selected": {
                backgroundColor: `${option.color}12`,
                borderLeft: `3px solid ${option.color}`,
              },
              "&:hover": { backgroundColor: `${option.color}08` },
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                width: "100%",
                alignItems: "center",
              }}
            >
              <Avatar
                variant="rounded"
                sx={{
                  width: 40,
                  height: 40,
                  backgroundColor: `${option.color}18`,
                  color: option.color,
                }}
              >
                {option.icon ?? defaultIcon(option.key)}
              </Avatar>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {option.label}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {option.description}
                </Typography>
              </Box>

              {option.preview && (
                <Box
                  component="img"
                  alt={`${option.label} preview`}
                  src={option.preview}
                  sx={{
                    width: 64,
                    height: 40,
                    borderRadius: 1,
                    objectFit: "cover",
                    border: "1px solid #eee",
                  }}
                />
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default BasemapSwitcher;
