"use client";

import PropTypes from "prop-types";
import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Grid,
  Chip,
  Stack,
  Container,
  Typography,
  CardActionArea,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { paths } from "src/routes/paths";
import { useGetWorkspaceTree } from "src/api/workspace";

import CustomBreadcrumbs from "src/components/custom-breadcrumbs";

import WorkspaceViewsTable from "./workspace-views-table";
import WorkspaceLayersTable from "./workspace-layers-table";
import WorkspaceLayerGroups from "./workspace-layergroups";

// ----------------------------------------------------------------------

export default function WorkspaceListView({ embedded = false }) {
  const [selectedId, setSelectedId] = useState(null);

  // Үндсэн workspace‑ууд (WORKSPACES, parent байхгүй) — картууд (зөвхөн харах)
  const {
    workspaces: roots,
    workspacesLoading: rootsLoading,
  } = useGetWorkspaceTree({ key: "WORKSPACES" });

  const selectedRoot = useMemo(
    () => roots.find((t) => t.id === selectedId) || null,
    [roots, selectedId]
  );

  const handleSelect = useCallback(
    (id) => setSelectedId((prev) => (prev === id ? null : id)),
    []
  );

  return (
    <Container
      maxWidth={embedded ? false : "xxl"}
      disableGutters={embedded}
    >
      {!embedded && (
        <CustomBreadcrumbs
          heading="GeoServer"
          links={[
            { name: "Дашбоард", href: paths.dashboard.root },
            { name: "GeoServer" },
          ]}
          sx={{ mb: { xs: 3, md: 3 } }}
        />
      )}

      {/* Workspace картууд (зөвхөн харах — нэмэх/засах/устгах байхгүй) */}
      {rootsLoading ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {roots.map((ws) => {
            const active = ws.id === selectedId;
            return (
              <Grid key={ws.id} item xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    boxShadow: active
                      ? (theme) => theme.customShadows?.primary
                      : undefined,
                    transition: "all 0.2s ease",
                  }}
                >
                  <CardActionArea
                    onClick={() => handleSelect(ws.id)}
                    sx={{ p: 2.5 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "common.white",
                          bgcolor: ws.color || "primary.main",
                          flexShrink: 0,
                        }}
                      >
                        <Icon icon="mdi:database-outline" width={26} />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle1" noWrap>
                          {ws.name}
                        </Typography>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1}
                          sx={{ mt: 0.5 }}
                        >
                          <Chip
                            variant="soft"
                            color={ws.gs_exists ? "success" : "warning"}
                            label={ws.gs_exists ? "Холбогдсон" : "Холбогдоогүй"}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {ws.view_count ?? 0} view
                          </Typography>
                        </Stack>
                      </Box>
                      <Icon
                        icon={active ? "mdi:chevron-up" : "mdi:chevron-down"}
                        width={22}
                      />
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
          {roots.length === 0 && (
            <Grid item xs={12}>
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Workspace алга байна.
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Сонгосон workspace — geoname бол нэрийн төрлийн view‑ийн баялаг
          хүснэгт; бусад (raster, basemap, ...) бол GeoServer layer жагсаалт */}
      {selectedRoot &&
        (selectedRoot.name === "geoname" ? (
          <WorkspaceViewsTable
            workspaceId={selectedRoot.id}
            workspaceName={selectedRoot.name}
          />
        ) : (
          <>
            <WorkspaceLayersTable
              workspaceId={selectedRoot.id}
              workspaceName={selectedRoot.name}
            />
            <WorkspaceLayerGroups
              workspaceId={selectedRoot.id}
              workspaceName={selectedRoot.name}
            />
          </>
        ))}
    </Container>
  );
}

WorkspaceListView.propTypes = {
  embedded: PropTypes.bool,
};
