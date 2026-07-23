"use client";

import Container from "@mui/material/Container";
import { useSettingsContext } from "src/components/settings";
import { useParams } from "next/navigation";
import { Card, Tab, Tabs } from "@mui/material";
import Iconify from "src/components/iconify";
import { useCallback, useState, useEffect } from "react";
import { useGetChampaign } from "src/api/champaign";
import { BeltgelListView } from "src/sections/beltgel/view";
import { SuurinListView } from "src/sections/suurin/view";
import { HeerView } from "src/sections/heer/view";
import { MayagtView } from "src/sections/mayagt/view";
import ProjectDetailsContent from "../champaign-details-content";

import { useNextStep } from "nextstepjs";

export default function ChampaignDetailsView() {
  const settings = useSettingsContext();
  const { id } = useParams();
  const { champaign } = useGetChampaign(id);
  const [currentTab, setCurrentTab] = useState("beltgel");
  const { currentStep, currentTour } = useNextStep();

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
  }, []);

  useEffect(() => {
    if (currentTour === "agreement-dynamic") {
      if (currentStep < 5) {
        setCurrentTab("beltgel");
      }
    }
  }, [currentStep, currentTour]);

  const TABS = [
    {
      value: "beltgel",
      label: "Бэлтгэл ажил",
      icon: <Iconify icon="solar:user-id-bold" width={24} />,
    },
    {
      value: "suurin",
      label: "Суурин судалгаа",
      icon: <Iconify icon="solar:user-id-bold" width={24} />,
    },
    {
      value: "heer",
      label: "Хээрийн судалгаа",
      icon: <Iconify icon="solar:bell-bing-bold" width={24} />,
    },
    {
      value: "bolowsruulalt",
      label: "Суурин боловсруулалт",
      icon: <Iconify icon="solar:bell-bing-bold" width={24} />,
    },
    {
      value: "result",
      label: "Маягтууд",
      icon: <Iconify icon="solar:bell-bing-bold" width={24} />,
    },
  ];

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <Card sx={{ p: 2, mb: 2 }}>
        <ProjectDetailsContent project={champaign} />
        <Tabs value={currentTab} onChange={handleChangeTab}>
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              label={tab.label}
              icon={tab.icon}
              value={tab.value}
            />
          ))}
        </Tabs>
      </Card>

      {/* Табын контент — lazy (идэвхтэй таб л mount хийгдэнэ) */}
      {currentTab === "beltgel" && <BeltgelListView projectId={id} />}
      {currentTab === "suurin" && <SuurinListView projectId={id} />}
      {currentTab === "heer" && <HeerView projectId={id} />}
      {currentTab === "result" && <MayagtView projectId={id} />}
    </Container>
  );
}
