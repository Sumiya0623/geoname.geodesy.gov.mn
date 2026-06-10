"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Box } from "@mui/material";

// GeoStyler нь antd дээр client‑side ажилладаг тул SSR‑гүй dynamic ачаална.
const GeoStylerEditor = dynamic(
  () => import("src/sections/geoserver/geostyler/geostyler-editor"),
  { ssr: false }
);

// ----------------------------------------------------------------------

function RuleEditorContent() {
  const searchParams = useSearchParams();
  const layer = searchParams.get("layer");

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <GeoStylerEditor layerId={layer} />
    </Box>
  );
}

export default function RuleEditorPage() {
  return (
    <Suspense fallback={null}>
      <RuleEditorContent />
    </Suspense>
  );
}
