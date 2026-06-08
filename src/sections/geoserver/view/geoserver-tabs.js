"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Container, Tabs, Tab, tabsClasses, Card } from "@mui/material";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import Iconify from "src/components/iconify";
import { paths } from "src/routes/paths";
import GeoServerListView from "./geoserver-list-view";
import { GroupListView } from "../group/view";
import { useNextStep } from "nextstepjs";

const TABS = [
  {
    value: "geoserver",
    label: "GeoServer",
    icon: <Iconify icon="solar:user-id-bold" width={24} />,
    Component: GeoServerListView,
  },
  {
    value: "groups",
    label: "LayerGroups",
    icon: <Iconify icon="solar:users-group-rounded-bold" width={24} />,
    Component: GroupListView,
  },
];

export default function GeoServerTabsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") || "geoserver";
  const [currentTab, setCurrentTab] = useState(initialTab);

  const { currentStep, currentTour } = useNextStep();

  useEffect(() => {
    if (currentTour === "geoserver") {
      if (currentStep >= 3) {
        setCurrentTab("groups");
      } else {
        setCurrentTab("geoserver");
      }
    }
  }, [currentStep, currentTour]);

  useEffect(() => {
    const handleTabSwitch = () => {
      setCurrentTab("groups");
    };

    window.addEventListener("geoserver:switch-to-groups", handleTabSwitch);
    return () =>
      window.removeEventListener("geoserver:switch-to-groups", handleTabSwitch);
  }, []);

  // URL -> state sync (back/forward эсвэл deep-link)
  useEffect(() => {
    const sp = searchParams.get("tab");
    if (sp && sp !== currentTab) setCurrentTab(sp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleChangeTab = useCallback(
    (_e, next) => {
      setCurrentTab(next);
      const q = new URLSearchParams(Array.from(searchParams.entries()));
      q.set("tab", next);
      router.replace(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const CurrentView = useMemo(() => {
    const found = TABS.find((t) => t.value === currentTab) || TABS[0];
    return found.Component;
  }, [currentTab]);

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="GeoServer"
        links={[
          {
            name: "Тохиргоо",
            href: paths.dashboard.geoserver,
          },
          {
            name: "Жагсаалт",
          },
        ]}
      />

      <Card sx={{ px: 2, mb: 2 }}>
        <Tabs
          value={
            TABS.some((t) => t.value === currentTab) ? currentTab : "geoserver"
          }
          onChange={handleChangeTab}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            mb: 2, // ТАВ доороо зайтай байг
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
              label={tab.label}
            />
          ))}
        </Tabs>
      </Card>
      <CurrentView />
    </Container>
  );
}
