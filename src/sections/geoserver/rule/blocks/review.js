import { useFormContext } from "react-hook-form";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return null;
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255,
    g = (int >> 8) & 255,
    b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ReviewBlock({ symbolizer }) {
  // ✔️ hook дүрмийг зөрчихгүй — зөвхөн энд нэг удаа дуудагдана
  const { watch } = useFormContext();

  // ✔️ Нэг дор бүх утгыг авна (эсвэл watch(["a","b"]) гэж массив өгч болно)
  const v = watch();

  const previewText = v.text_field || "Жишээ текст";
  const previewColor = v.text_color || "";
  const previewFontFamily = v.text_font_family || undefined;
  const previewFontStyle = v.text_font_style || undefined;
  const previewFontWeight = v.text_font_weight || undefined;
  const previewSize = v.text_size ? `${v.text_size}px` : undefined;
  const previewHaloColor = v.text_halo_color || "";
  const previewHaloOpacity = v.text_halo_opacity ?? 1;
  const previewHaloRadius = v.text_halo_radius ?? 0;
  const previewDispX = v.text_displacement_x ?? 0;
  const previewDispY = v.text_displacement_y ?? 0;
  const previewAnchor = v.text_anchor || "";

  const size = v.size || 0;

  const previewFill = v.fill_color || "";
  const previewFillOpacity = v.fill_opacity ?? 1;
  const previewStrokeColor = v.stroke_color || "";
  const previewStrokeOpacity = v.stroke_opacity ?? 1;
  const previewStrokeWidth = v.stroke_width ?? 1;
  const previewStrokeDash = v.stroke_dasharray || "";
  const previewStrokeLinecap = v.stroke_linecap || "butt";
  const previewStrokeLinejoin = v.stroke_linejoin || "miter";

  const minScale = v.min_scale_denom ?? "-";
  const maxScale = v.max_scale_denom ?? "-";

  const anchorMap = {
    "top-left": { x: 0, y: 0 },
    "top": { x: 0.5, y: 0 },
    "top-right": { x: 1, y: 0 },
    "left": { x: 0, y: 0.5 },
    "center": { x: 0.5, y: 0.5 },
    "right": { x: 1, y: 0.5 },
    "bottom-left": { x: 0, y: 1 },
    "bottom": { x: 0.5, y: 1 },
    "bottom-right": { x: 1, y: 1 },
  };

  const anchor = anchorMap[previewAnchor] || anchorMap["center"];

  const styledPreviewForText = {
    color: previewColor || undefined,
    fontFamily: previewFontFamily,
    fontStyle: previewFontStyle,
    fontWeight: previewFontWeight,
    fontSize: previewSize,
    display: "inline-block",
    whiteSpace: "nowrap",
  };

  const styledPreview = {
    ...styledPreviewForText,
    position: "absolute",
    top: "50%",
    left: "50%", 
    transform: `translate(-50%, -50%) translate(${(anchor.x - 0.5) * 100}%, ${(anchor.y - 0.5) * 100}%) translate(${previewDispX}px, ${previewDispY}px)`,
  };

  if (previewHaloColor && previewHaloRadius) {
    const rgba = hexToRgba(previewHaloColor, previewHaloOpacity || 1);
    styledPreview.textShadow = `0 0 ${previewHaloRadius}px ${rgba}`;
  }

  const iconSrc = typeof v.icon === "string" ? v.icon : v.icon?.preview;

  return (
    <Card
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(1, 1fr)", sm: "repeat(2, 1fr)" },
      }}
    >
      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Review
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Таны оруулсан утгуудыг хадгалахаас өмнө шалгана уу.
        </Typography>

        <Typography variant="body2">Name: {v.name || "-"}</Typography>
        <Typography variant="body2">
          Symbolizer: {v.symbolizer || "-"}
        </Typography>

        {iconSrc ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2">SVG preview:</Typography>
            <Box
              sx={{
                width: 80,
                height: 80,
                border: "1px solid",
                borderColor: "divider",
                mt: 0.5,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element*/}
              <img
                src={iconSrc}
                alt="svg preview"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </Box>
            {typeof v.icon === "object" && (
              <Typography variant="caption">{v.icon?.name}</Typography>
            )}
          </Box>
        ) : null}

        <Typography variant="body2">
          MinScale: {minScale} / MaxScale: {maxScale}
        </Typography>
      </Stack>

      <Stack spacing={1.5} sx={{ p: 1.5 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Жишээ текст
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <span style={styledPreviewForText}>{previewText}</span>
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Жишээ байршил
          </Typography>
          <Box 
            sx={{ 
              mt: 0.5, 
              position: "relative",
              width: 120,
              height: 60,
              border: "1px dashed",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 2,
                height: 2,
                backgroundColor: "primary.main",
                borderRadius: "50%",
                zIndex: 1,
              }}
            />
            <span style={styledPreview}>{previewText}</span>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Anchor: {previewAnchor || "center"} | Offset: ({previewDispX}, {previewDispY})px
          </Typography>
        </Box>

        {symbolizer === "point" && iconSrc ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Жишээ цэгийн загвар
            </Typography>
            <Box
              sx={{
                width: 120,
                height: 80,
                border: "1px solid",
                borderColor: "divider",
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 4,
                  height: 4,
                  backgroundColor: "primary.main",
                  borderRadius: "50%",
                  zIndex: 2,
                }}
              />
              
              <Box
                sx={{
                  height: size,
                  width: size,
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element*/}
                <img
                  src={iconSrc}
                  alt="svg preview"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </Box>
              
              <span style={styledPreview}>{previewText}</span>
            </Box>
          </Box>
        ) : null}

        {symbolizer === "polygon" ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Жишээ полигон
            </Typography>
            <Box
              sx={{
                width: 80,
                height: 80,
                border: "1px solid",
                borderColor: "divider",
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                viewBox="0 0 100 100"
                width="64"
                height="64"
                role="img"
                aria-label="polygon preview"
              >
                <polygon
                  points="10,70 50,10 90,70"
                  fill={previewFill || "transparent"}
                  fillOpacity={previewFillOpacity}
                  stroke={previewStrokeColor || "transparent"}
                  strokeOpacity={previewStrokeOpacity}
                  strokeWidth={previewStrokeWidth}
                  strokeDasharray={previewStrokeDash}
                  strokeLinecap={previewStrokeLinecap}
                  strokeLinejoin={previewStrokeLinejoin}
                />
              </svg>
            </Box>
          </Box>
        ) : null}
        {symbolizer === "line" ? (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Жишээ шугам
            </Typography>
            <Box
              sx={{
                width: 120,
                height: 80,
                border: "1px solid",
                borderColor: "divider",
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                viewBox="0 0 200 80"
                width="160"
                height="64"
                role="img"
                aria-label="line preview"
              >
                <line
                  x1="40"
                  y1="40"
                  x2="140"
                  y2="10"
                  stroke={previewStrokeColor || "black"}
                  strokeOpacity={previewStrokeOpacity}
                  strokeWidth={Math.max(1, previewStrokeWidth)}
                  strokeDasharray={previewStrokeDash || undefined}
                  strokeLinecap={previewStrokeLinecap}
                  strokeLinejoin={previewStrokeLinejoin}
                />
                <line
                  x1="10"
                  y1="10"
                  x2="40"
                  y2="40"
                  stroke={previewStrokeColor || "black"}
                  strokeOpacity={previewStrokeOpacity}
                  strokeWidth={Math.max(1, previewStrokeWidth)}
                  strokeDasharray={previewStrokeDash || undefined}
                  strokeLinecap={previewStrokeLinecap}
                  strokeLinejoin={previewStrokeLinejoin}
                />

                <line
                  x1="140"
                  y1="10"
                  x2="170"
                  y2="70"
                  stroke={previewStrokeColor || "black"}
                  strokeOpacity={previewStrokeOpacity}
                  strokeWidth={Math.max(1, previewStrokeWidth)}
                  strokeDasharray={previewStrokeDash || undefined}
                  strokeLinecap={previewStrokeLinecap}
                  strokeLinejoin={previewStrokeLinejoin}
                />
              </svg>

            </Box>
            <Typography variant="caption" color="text.secondary">
              Width: {previewStrokeWidth} | Color: {previewStrokeColor || '-'} | Dash: {previewStrokeDash || 'solid'}
            </Typography>
          </Box>
        ) : null}
      </Stack>
    </Card>
  );
}
