"use client";

import PropTypes from "prop-types";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Tab,
  Card,
  Tabs,
  Container,
  tabsClasses,
  CircularProgress,
} from "@mui/material";

import Iconify from "src/components/iconify";
import { useGetWorkspaceTree } from "src/api/workspace";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import { NameClassListView } from "src/sections/geoname/nameclass/view";
import { AdminUnitListView } from "src/sections/settings/adminunit/view";
import { BaseMapLayerListView } from "src/sections/geoserver/basemap/view";
import WorkspaceLayersTable from "src/sections/geoserver/workspace-layers-table";
import WorkspaceLayerGroups from "src/sections/geoserver/workspace-layergroups";

// ----------------------------------------------------------------------
// GIS тохиргоо — НЭГ эгнээ таб: GeoServer workspace бүр + Суурь давхарга +
// Дэвсгэр нэр. Таб бүр нь өөрийн SubMenu-ийн `content` түлхүүрээр харах
// (`list`) эрхээ шалгана; эрхгүй хэсэг таб болж харагдахгүй.
// ----------------------------------------------------------------------

// Нэг workspace-ийн удирдлага — давхарга + layer group.
function WorkspacePanel({ ws }) {
  return (
    <>
      <WorkspaceLayersTable workspaceId={ws.id} workspaceName={ws.name} />
      <WorkspaceLayerGroups workspaceId={ws.id} workspaceName={ws.name} />
    </>
  );
}

WorkspacePanel.propTypes = { ws: PropTypes.object };

export default function GisTabsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const geoserverPerm = useMenuPermissions({ content: "geoserver" });
  const basemapPerm = useMenuPermissions({ content: "basemap" });
  const nameclassPerm = useMenuPermissions({ content: "nameclass" });
  const auPerm = useMenuPermissions({ content: "au" });

  // Workspace-уудыг backend (settings.GEOSERVER_WORKSPACES) шүүж өгдөг.
  const { workspaces, workspacesLoading } = useGetWorkspaceTree({
    key: "WORKSPACES",
  });

  const TABS = useMemo(
    () => [
      ...(geoserverPerm.list ? workspaces : []).map((ws) => ({
        value: `ws:${ws.name}`,
        label: ws.name,
        icon: <Iconify icon="solar:server-bold-duotone" width={22} />,
        render: () => <WorkspacePanel ws={ws} />,
      })),
      // DB-д `basemap` кодтой SubMenu байхгүй тул суурь давхаргыг GeoServer-ийн
      // эрхээр (эсвэл тусад нь `basemap` эрх өгвөл түүгээр) харуулна.
      ...(basemapPerm.list || geoserverPerm.list
        ? [
            {
              value: "basemap",
              label: "Суурь давхарга",
              icon: <Iconify icon="solar:layers-bold-duotone" width={22} />,
              render: () => <BaseMapLayerListView />,
            },
          ]
        : []),
      ...(nameclassPerm.list
        ? [
            {
              value: "nameclass",
              label: "Дэвсгэр нэр",
              icon: <Iconify icon="solar:folder-with-files-bold" width={22} />,
              render: () => <NameClassListView embedded />,
            },
          ]
        : []),
      ...(auPerm.list
        ? [
            {
              value: "au",
              label: "Засаг захиргаа",
              icon: <Iconify icon="solar:map-point-bold" width={22} />,
              render: () => <AdminUnitListView embedded />,
            },
          ]
        : []),
    ],
    [
      workspaces,
      geoserverPerm.list,
      basemapPerm.list,
      nameclassPerm.list,
      auPerm.list,
    ],
  );

  const requested = searchParams.get("tab");
  const [currentTab, setCurrentTab] = useState(requested || "");

  // Таб жагсаалт ачаалагдсаны дараа хүчинтэй утга руу тохируулна
  useEffect(() => {
    if (!TABS.length) return;
    if (!TABS.some((t) => t.value === currentTab)) setCurrentTab(TABS[0].value);
  }, [TABS, currentTab]);

  useEffect(() => {
    if (requested && requested !== currentTab) setCurrentTab(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  const handleChangeTab = useCallback(
    (_e, next) => {
      setCurrentTab(next);
      const q = new URLSearchParams(Array.from(searchParams.entries()));
      q.set("tab", next);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const CurrentRender = useMemo(
    () => TABS.find((t) => t.value === currentTab)?.render,
    [TABS, currentTab],
  );

  if (workspacesLoading && !TABS.length) {
    return (
      <Box sx={{ py: 5, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!TABS.length) return null;

  return (
    <Container maxWidth="xxl">
      <Card sx={{ px: 2, mb: 2 }}>
        <Tabs
          value={currentTab || TABS[0].value}
          onChange={handleChangeTab}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            [`& .${tabsClasses.flexContainer}`]: {
              pr: { md: 3 },
              justifyContent: { sm: "center", md: "flex-start" },
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
            />
          ))}
        </Tabs>
      </Card>
      {CurrentRender?.()}
    </Container>
  );
}
