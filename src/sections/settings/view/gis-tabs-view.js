"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container, Tabs, Tab, tabsClasses, Card } from "@mui/material";

import Iconify from "src/components/iconify";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import { AdminUnitListView } from "src/sections/adminunit/view";
import WorkspaceListView from "src/sections/geoserver/workspace-list-view";
import { BaseMapLayerListView } from "src/sections/basemap/view";

// ----------------------------------------------------------------------
// Тав бүр нь өөрийн SubMenu-ийн `content` түлхүүрээр харах (`list`) эрхээ шалгана.
// Зөвхөн харах эрхтэй хэсгүүд таб болж харагдана.

export default function GisTabsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const auPerm = useMenuPermissions({ content: "au" });
  const geoserverPerm = useMenuPermissions({ content: "geoserver" });
  const basemapPerm = useMenuPermissions({ content: "basemap" });

  const TABS = useMemo(
    () => [
      {
        value: "au",
        label: "Засаг захиргаа",
        icon: <Iconify icon="solar:map-point-bold" width={24} />,
        allowed: auPerm.list,
        render: () => <AdminUnitListView embedded />,
      },
      {
        value: "geoserver",
        label: "Geoserver",
        icon: <Iconify icon="solar:server-bold" width={24} />,
        allowed: geoserverPerm.list,
        render: () => <WorkspaceListView embedded />,
      },
      {
        value: "basemap",
        label: "Газрын зургийн давхарга",
        icon: <Iconify icon="solar:layers-bold" width={24} />,
        // Тусдаа "basemap" эрх байвал түүгээр, эс бөгөөс geoserver эрхээр
        allowed: basemapPerm.list || geoserverPerm.list,
        render: () => <BaseMapLayerListView />,
      },
    ],
    [auPerm.list, geoserverPerm.list, basemapPerm.list],
  );

  const allowedTabs = useMemo(() => TABS.filter((t) => t.allowed), [TABS]);

  const requested = searchParams.get("tab");
  const fallback = allowedTabs[0]?.value || "";
  const [currentTab, setCurrentTab] = useState(
    allowedTabs.some((t) => t.value === requested) ? requested : fallback,
  );

  useEffect(() => {
    if (!allowedTabs.length) return;
    const valid = allowedTabs.some((t) => t.value === currentTab);
    if (!valid) setCurrentTab(allowedTabs[0].value);
  }, [allowedTabs, currentTab]);

  useEffect(() => {
    if (
      requested &&
      requested !== currentTab &&
      allowedTabs.some((t) => t.value === requested)
    ) {
      setCurrentTab(requested);
    }
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
    () => allowedTabs.find((t) => t.value === currentTab)?.render,
    [allowedTabs, currentTab],
  );

  return (
    <Container maxWidth="xxl">
      {allowedTabs.length > 0 ? (
        <>
          <Card sx={{ px: 2, mb: 2 }}>
            <Tabs
              value={currentTab}
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
              {allowedTabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  icon={tab.icon}
                  label={tab.label}
                />
              ))}
            </Tabs>
          </Card>
          {CurrentRender?.()}
        </>
      ) : null}
    </Container>
  );
}
