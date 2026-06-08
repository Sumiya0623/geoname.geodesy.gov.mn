import PropTypes from "prop-types";
import { useState, useEffect } from "react";

import { Box, Card, Stack, Typography, IconButton } from "@mui/material";
import {
  Close as CloseIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  PlaceOutlined as PlaceIcon,
} from "@mui/icons-material";

import NameDetailCard from "./NameDetailCard";

// ----------------------------------------------------------------------
// Газрын зураг дээр 1 байршилд олон нэр олдвол — пейжерээр (1/N + сум)
// нэг нэгээр нь гүйлгэж харна. "Дэлгэрэнгүй харах" дээр NameSidebar нээнэ.
// ----------------------------------------------------------------------

const FeatureSelector = ({ features = [], position, onSelect, onClose }) => {
  const names = features || [];
  const total = names.length;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [features]);

  const current = names[idx] || {};
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  return (
    <Card
      sx={{
        position: "absolute",
        top: Math.max(8, (position?.y ?? 0) - 10),
        left: (position?.x ?? 0) + 12,
        width: 360,
        maxWidth: "calc(100% - 24px)",
        maxHeight: "75vh",
        overflowY: "auto",
        zIndex: 1300,
        borderRadius: 2,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      {/* Толгой */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: "primary.main",
          color: "#fff",
          px: 1.5,
          py: 0.75,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <PlaceIcon fontSize="small" />
          <Typography variant="subtitle2">{total} нэр олдлоо</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: "#fff" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Пейжер */}
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

      {/* Идэвхтэй нэрийн дэлгэрэнгүй мэдээлэл (бүтнээр) */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        <NameDetailCard name={current} onSelect={onSelect} />
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
