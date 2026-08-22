"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";

import CollapseCard from "src/components/collapse-card";

import RasterListView from "src/sections/champaign/raster/view/raster-list-view";

// ----------------------------------------------------------------------
// БЭЛТГЭЛ АЖИЛ — төслийн дэлгэрэнгүйн таб (хуудас).
//   • Зургийн сан (хэвлэлийн эх) — sections/raster
// Эрх зүйн баримт бичиг (тогтоол, шийдвэр) нь ЭНД БАЙХГҮЙ: нэмэх/сангаас
// холбох/засах/хасах бүх үйлдлийг «Суурин судалгаа» табын «Эрх зүйн баримт
// бичиг» карт руу нэгтгэсэн (өмнө нь 2 газар давхардаж байсан).
// Энэ үе шатанд багийн бүрэлдэхүүн байхгүй.
// ----------------------------------------------------------------------

export default function BeltgelView({ projectId }) {
  const [rasterCount, setRasterCount] = useState(0);

  if (!projectId) return null;

  return (
    <Box>
      <CollapseCard
        icon="solar:map-bold"
        title="Зургийн сан"
        count={rasterCount}
      >
        <RasterListView embedded onCount={setRasterCount} />
      </CollapseCard>
    </Box>
  );
}

BeltgelView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
