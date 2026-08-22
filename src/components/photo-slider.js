import PropTypes from "prop-types";
import { useState } from "react";

import {
  Box,
  Button,
  Dialog,
  Tooltip,
  Typography,
  IconButton,
  DialogActions,
  DialogContent,
} from "@mui/material";
import { Icon } from "@iconify/react";

// ----------------------------------------------------------------------
// Зургийн slider — нэг дор нэг зураг, сум товчоор гүйлгэнэ. Доод зүүн буланд
// зовхис (компасаар тохируулсан), доод голд дугаарлалт. Зураг дээр дарахад
// том дэлгэц (lightbox) нээгдэж, тэндээс устгана. Зураггүй үед "Зураг нэмэх"
// талбар. Дэлгэрэнгүй хуудас, газрын зургийн popup хоёуланд нэг л энэ UI.
// ----------------------------------------------------------------------

const mediaUrl = (u) =>
  u && u.startsWith("/") ? `${process.env.NEXT_PUBLIC_HOST_API}${u}` : u;

export default function PhotoSlider({
  photos,
  onAdd,
  onDelete,
  height = { xs: 240, md: 340 },
}) {
  const [i, setI] = useState(0);
  const [lightbox, setLightbox] = useState(null); // том харагдах зураг

  const addBtn = onAdd && (
    <Tooltip title="Зураг нэмэх">
      <IconButton
        onClick={onAdd}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "rgba(0,0,0,0.45)",
          color: "#fff",
          "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
        }}
      >
        <Icon icon="mingcute:add-line" width={20} />
      </IconButton>
    </Tooltip>
  );

  // Зураггүй — нэмэх талбар
  if (!photos?.length) {
    return (
      <Box
        onClick={onAdd}
        sx={{
          position: "relative",
          width: "100%",
          height,
          borderRadius: 2,
          border: "1px dashed",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          color: "text.secondary",
          cursor: onAdd ? "pointer" : "default",
        }}
      >
        <Icon icon="solar:gallery-add-bold" width={36} />
        <Typography variant="body2">Зураг нэмэх</Typography>
      </Box>
    );
  }

  const idx = i % photos.length;
  const cur = photos[idx];
  const nav = (btn) => (e) => {
    e.stopPropagation();
    setI((p) => (p + btn + photos.length) % photos.length);
  };
  return (
    <>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "grey.200",
        }}
      >
        <Box
          component="img"
          src={mediaUrl(cur.url)}
          alt="зураг"
          onClick={() => setLightbox(cur)}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            cursor: "pointer",
          }}
        />
        {addBtn}
        {cur.desc && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              left: 8,
              bgcolor: "rgba(0,0,0,0.55)",
              color: "#fff",
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Icon icon="solar:compass-bold" width={14} /> {cur.desc}
          </Box>
        )}
        {photos.length > 1 && (
          <>
            <IconButton
              onClick={nav(-1)}
              sx={{
                position: "absolute",
                top: "50%",
                left: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(0,0,0,0.45)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
              }}
            >
              <Icon icon="eva:arrow-ios-back-fill" width={22} />
            </IconButton>
            <IconButton
              onClick={nav(1)}
              sx={{
                position: "absolute",
                top: "50%",
                right: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(0,0,0,0.45)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
              }}
            >
              <Icon icon="eva:arrow-ios-forward-fill" width={22} />
            </IconButton>
            <Box
              sx={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "#fff",
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: 12,
              }}
            >
              {idx + 1}/{photos.length}
            </Box>
          </>
        )}
      </Box>

      {/* Том дэлгэц (lightbox) — устгах товчтой */}
      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0, bgcolor: "#000" }}>
          <Box
            component="img"
            src={mediaUrl(lightbox?.url)}
            alt="зураг"
            sx={{
              width: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              display: "block",
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
            {lightbox?.desc ? `Зураг авсан: ${lightbox.desc}` : ""}
          </Typography>
          <Box>
            <Button
              color="error"
              startIcon={<Icon icon="solar:trash-bin-trash-bold" width={18} />}
              onClick={() => {
                onDelete?.(lightbox.id);
                setLightbox(null);
              }}
            >
              Устгах
            </Button>
            <Button color="inherit" onClick={() => setLightbox(null)}>
              Хаах
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}

PhotoSlider.propTypes = {
  photos: PropTypes.array,
  onAdd: PropTypes.func,
  onDelete: PropTypes.func,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
};
