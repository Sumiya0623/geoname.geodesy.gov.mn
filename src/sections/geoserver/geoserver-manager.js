"use client";

import { useState, useEffect } from "react";

import { Box, Tab, Tabs, CircularProgress } from "@mui/material";

import Iconify from "src/components/iconify";
import { useGetWorkspaceTree } from "src/api/workspace";
import { BaseMapLayerListView } from "src/sections/basemap/view";

import WorkspaceLayersTable from "./workspace-layers-table";
import WorkspaceLayerGroups from "./workspace-layergroups";

// ----------------------------------------------------------------------
// Энэ төсөлд удирдах workspace-уудыг BACKEND (settings.GEOSERVER_WORKSPACES)
// шүүдэг — tree endpoint зөвшөөрсөн workspace-уудыг л буцаана. Frontend hardcode хийхгүй.

// Нэг workspace-ийн доторх удирдлага — бүх workspace ижил: давхарга + layer group.
function WorkspacePanel({ ws }) {
  return (
    <>
      <WorkspaceLayersTable workspaceId={ws.id} workspaceName={ws.name} />
      <WorkspaceLayerGroups workspaceId={ws.id} workspaceName={ws.name} />
    </>
  );
}

// Geoserver — workspace бүрд таб (дотор нь layer + layergroup) + Суурь давхарга.
export default function GeoserverManager() {
  const { workspaces, workspacesLoading } = useGetWorkspaceTree({ key: "WORKSPACES" });

  // Backend (settings.GEOSERVER_WORKSPACES) аль хэдийн шүүсэн тул шууд ашиглана.
  const shown = workspaces;

  const [tab, setTab] = useState(null);
  useEffect(() => {
    if (tab == null && shown.length) setTab(shown[0].name);
  }, [shown, tab]);

  const current = tab || shown[0]?.name || "layers";
  const activeWs = shown.find((w) => w.name === current);

  return (
    <Box>
      <Tabs
        value={current}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2, "& .MuiTab-root": { minHeight: 44 } }}
      >
        {shown.map((w) => (
          <Tab
            key={w.name}
            value={w.name}
            label={w.name}
            icon={<Iconify icon="solar:server-bold-duotone" width={20} />}
            iconPosition="start"
          />
        ))}
        <Tab
          value="layers"
          label="Суурь давхарга"
          icon={<Iconify icon="solar:layers-bold-duotone" width={20} />}
          iconPosition="start"
        />
      </Tabs>

      {workspacesLoading && !shown.length ? (
        <Box sx={{ py: 5, textAlign: "center" }}><CircularProgress /></Box>
      ) : current === "layers" ? (
        <BaseMapLayerListView />
      ) : (
        activeWs && <WorkspacePanel ws={activeWs} />
      )}
    </Box>
  );
}
