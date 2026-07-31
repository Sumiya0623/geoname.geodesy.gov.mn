"use client";

import PropTypes from "prop-types";
import { useState } from "react";

import Box from "@mui/material/Box";

import CollapseCard from "src/components/collapse-card";

import { LegalListView } from "src/sections/legal/view";
import RasterListView from "src/sections/raster/view/raster-list-view";

// ----------------------------------------------------------------------
// БЭЛТГЭЛ АЖИЛ — төслийн дэлгэрэнгүйн таб (хуудас).
// Дотроо 2 задардаг хэсэгт 2 бие даасан жагсаалтыг дуудна:
//   • Эрх зүйн баримт бичиг (тогтоол, шийдвэр) — sections/beltgel
//   • Зургийн сан (хэвлэлийн эх)               — sections/raster
// Энэ үе шатанд багийн бүрэлдэхүүн байхгүй.
// ----------------------------------------------------------------------

export default function BeltgelView({ projectId }) {
  const [legalCount, setLegalCount] = useState(0);
  const [rasterCount, setRasterCount] = useState(0);

  if (!projectId) return null;

  return (
    <Box>
      <CollapseCard
        icon="solar:document-text-bold"
        title="Эрх зүйн баримт бичиг"
        count={legalCount}
      >
        <LegalListView projectId={projectId} embedded onCount={setLegalCount} />
      </CollapseCard>

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
