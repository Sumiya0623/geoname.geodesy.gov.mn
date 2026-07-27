import PropTypes from "prop-types";
import { useRef, useState, useEffect } from "react";

import { Box, Card, Stack, Button, Typography, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  PlaceOutlined as PlaceIcon,
  ArrowBackRounded as ArrowBackIcon,
} from "@mui/icons-material";

import NameDetailCard from "./NameDetailCard";

// ----------------------------------------------------------------------
// Газрын зураг дээр 1 байршилд олон нэр олдвол — пейжерээр (1/N + сум)
// нэг нэгээр нь гүйлгэж харна. Толгойгоос барьж дэлгэц дээр ЧИРЖ зөөнө.
// ----------------------------------------------------------------------

const FeatureSelector = ({ features = [], position, onSelect, onClose }) => {
  const names = features || [];
  const total = names.length;
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [formOpen, setFormOpen] = useState(false);
  const goBack = () => window.dispatchEvent(new Event("geoname:formBack"));
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0,
  });

  useEffect(() => {
    setIdx(0);
  }, [features]);

  // Байрлалыг position prop‑оос эхлүүлнэ (шинэ сонголт бүрт)
  useEffect(() => {
    setPos({
      top: Math.max(8, (position?.y ?? 0) - 10),
      left: (position?.x ?? 0) + 12,
    });
  }, [position]);

  const onHeaderMouseDown = (event) => {
    event.preventDefault();
    dragRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startTop: pos.top,
      startLeft: pos.left,
    };
  };

  useEffect(() => {
    const move = (event) => {
      if (!dragRef.current.dragging) return;
      setPos({
        top: dragRef.current.startTop + (event.clientY - dragRef.current.startY),
        left: dragRef.current.startLeft + (event.clientX - dragRef.current.startX),
      });
    };
    const up = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const current = names[idx] || {};
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  return (
    <Card
      sx={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: "fit-content",
        minWidth: 360,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "75vh",
        overflowY: "auto",
        zIndex: 1300,
        borderRadius: 2,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      {/* Толгой — эндээс барьж чирнэ */}
      <Box
        onMouseDown={onHeaderMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "primary.main",
          color: "#fff",
          px: 1.5,
          py: 0.75,
          cursor: "move",
          userSelect: "none",
        }}
      >
        {formOpen ? (
          <Button
            size="small"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={goBack}
            sx={{
              color: "#fff",
              textTransform: "none",
              fontWeight: 600,
              "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
            }}
          >
            Буцах
          </Button>
        ) : (
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <PlaceIcon fontSize="small" />
            <Typography variant="subtitle2">{total} нэр олдлоо</Typography>
          </Stack>
        )}
        <IconButton
          size="small"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={formOpen ? goBack : onClose}
          sx={{ color: "#fff" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Пейжер — форм нээлттэй үед нуугдана */}
      {!formOpen && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1, py: 0.25 }}
        >
          <IconButton size="small" onClick={prev} disabled={total <= 1}>
            <PrevIcon />
          </IconButton>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {idx + 1}/{total}
          </Typography>
          <IconButton size="small" onClick={next} disabled={total <= 1}>
            <NextIcon />
          </IconButton>
        </Stack>
      )}

      {/* Идэвхтэй нэрийн дэлгэрэнгүй мэдээлэл (бүтнээр) */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        <NameDetailCard
          name={current}
          onSelect={onSelect}
          onFormOpenChange={setFormOpen}
        />
      </Box>
    </Card>
  );
};

FeatureSelector.propTypes = {
  features: PropTypes.array,
  position: PropTypes.object,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
};

export default FeatureSelector;
