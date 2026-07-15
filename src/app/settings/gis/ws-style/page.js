"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  Box,
  Card,
  Stack,
  Switch,
  Collapse,
  Typography,
  FormControlLabel,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import WorkspaceBoundaryLabelForm from "src/sections/geoserver/workspace-boundary-label-form";

// GeoStyler нь antd дээр client‑side тул SSR‑гүй dynamic ачаална.
const GeoStylerEditor = dynamic(
  () => import("src/sections/geoserver/geostyler/geostyler-editor"),
  { ssr: false }
);

// ----------------------------------------------------------------------
// Workspace доторх layer‑ийн style засвар — тусдаа таб. GeoStyler‑ийн rule‑ийн
// ДООД талд (зүүн багана) "Хил дагуу нэр (OSM)" switch/collapse. Зөвхөн line ба
// polygon давхаргад харагдана. Идэвхтэй бол switch нээлттэй, форм урьдчилан дүүрнэ.
// ----------------------------------------------------------------------

export default function WorkspaceStylePage() {
  const sp = useSearchParams();
  const ws = sp.get("ws");
  const layer = sp.get("layer");
  const wsName = sp.get("ws_name") || "";

  const [state, setState] = useState(null); // boundary GET хариу
  const [open, setOpen] = useState(false);
  const sldRef = useRef(null); // GeoStyler‑ийн одоогийн SLD‑г авах

  useEffect(() => {
    if (!ws || !layer) return undefined;
    let active = true;
    (async () => {
      try {
        const res = await axiosInstance.get(
          endpoints.workspace.gsBoundaryLabelState(ws, layer)
        );
        if (!active) return;
        setState(res?.data || {});
        setOpen(!!res?.data?.active); // идэвхтэй бол нээлттэй эхэлнэ
      } catch {
        if (active) setState({});
      }
    })();
    return () => {
      active = false;
    };
  }, [ws, layer]);

  if (!ws || !layer) return null;

  // Хил дагуу нэр зөвхөн line/polygon дээр
  const canBoundary =
    state && (state.geom_type === "line" || state.geom_type === "polygon");

  const belowEditor = canBoundary ? (
    <Card sx={{ p: 2.5 }}>
      <FormControlLabel
        control={
          <Switch checked={open} onChange={(_, v) => setOpen(v)} />
        }
        label={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Iconify icon="solar:map-bold" width={22} />
            <Typography variant="subtitle1">Хил дагуу нэр (OSM)</Typography>
          </Stack>
        }
      />
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2 }}>
          <WorkspaceBoundaryLabelForm
            workspaceId={ws}
            layer={layer}
            initial={state}
            baseSldRef={sldRef}
          />
        </Box>
      </Collapse>
    </Card>
  ) : null;

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <GeoStylerEditor
        title={`Style · ${wsName ? `${wsName}:` : ""}${layer}`}
        sldUrl={endpoints.workspace.gsLayerSld(ws, layer)}
        uploadUrl={endpoints.workspace.gsUploadSymbol(ws)}
        belowEditor={belowEditor}
        hideSave={canBoundary && open}
        sldRef={sldRef}
      />
    </Box>
  );
}
