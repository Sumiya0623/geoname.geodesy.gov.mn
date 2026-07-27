"use client";

import { useMemo, useState, useEffect } from "react";

import { Box, Chip, Stack, Typography } from "@mui/material";

import { useGetWorkspaceTree } from "src/api/workspace";

import WorkspaceLayerGroups from "./workspace-layergroups";

// ----------------------------------------------------------------------
// LayerGroup — workspace сонгоод түүний layer group-уудыг удирдана.
export default function LayerGroupManager() {
  const { workspaces } = useGetWorkspaceTree({ key: "WORKSPACES" });
  const [wsId, setWsId] = useState(null);

  useEffect(() => {
    if (!wsId && workspaces.length) {
      const bm = workspaces.find((w) => w.name === "basemap") || workspaces[0];
      setWsId(bm.id);
    }
  }, [workspaces, wsId]);

  const ws = useMemo(() => workspaces.find((w) => w.id === wsId) || null, [workspaces, wsId]);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Workspace</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
        {workspaces.map((w) => (
          <Chip
            key={w.id}
            label={w.name}
            color={wsId === w.id ? "primary" : "default"}
            variant={wsId === w.id ? "filled" : "outlined"}
            onClick={() => setWsId(w.id)}
          />
        ))}
      </Stack>

      {ws && <WorkspaceLayerGroups workspaceId={ws.id} workspaceName={ws.name} />}
    </Box>
  );
}
