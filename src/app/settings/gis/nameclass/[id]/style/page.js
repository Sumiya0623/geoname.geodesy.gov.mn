"use client";

import dynamic from "next/dynamic";

import { Box } from "@mui/material";

// GeoStyler нь antd дээр client‑side тул SSR‑гүй dynamic ачаална.
const GeoStylerEditor = dynamic(
  () => import("src/sections/geoserver/geostyler/geostyler-editor"),
  { ssr: false }
);

// ----------------------------------------------------------------------
// Дэвсгэр нэрийн (nameclass leaf) style засвар. «Дэвсгэр нэр» цэс (843) path-гүй болсон тул
// /dashboard/nameclass/... AuthGuard-аар хаагдаж байв → GIS цэсний (/settings/gis/) дор байрлуулав.

export default function NameClassStylePage({ params }) {
  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <GeoStylerEditor layerId={params?.id} />
    </Box>
  );
}
