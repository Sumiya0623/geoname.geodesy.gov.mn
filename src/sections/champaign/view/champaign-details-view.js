"use client";

import Container from "@mui/material/Container";
import { useSettingsContext } from "src/components/settings";
import { useParams } from "next/navigation";
import { Card, Tab, Tabs } from "@mui/material";
import Iconify from "src/components/iconify";
import { useCallback, useState, useEffect } from "react";
import { useGetChampaign } from "src/api/champaign";
import ProjectDetailsContent from "../champaign-details-content";

import { useNextStep } from "nextstepjs";

export default function ChampaignDetailsView() {
  const settings = useSettingsContext();
  const { id } = useParams();
  const { champaign } = useGetChampaign(id);
  const [currentTab, setCurrentTab] = useState("general");
  const { currentStep, currentTour } = useNextStep();

  const handleChangeTab = useCallback((event, newValue) => {
    setCurrentTab(newValue);
  }, []);

  useEffect(() => {
    const handleSwitchToAct = () => {
      setCurrentTab("act");
    };

    window.addEventListener("agreement:switch-to-act", handleSwitchToAct);
    return () =>
      window.removeEventListener("agreement:switch-to-act", handleSwitchToAct);
  }, []);

  useEffect(() => {
    if (currentTour === "agreement-dynamic") {
      if (currentStep < 5) {
        setCurrentTab("general");
      }
    }
  }, [currentStep, currentTour]);

  const TABS = [
    {
      value: "general",
      label: "Цэг тэмдэгт",
      icon: <Iconify icon="solar:user-id-bold" width={24} />,
    },
    {
      value: "count",
      label: "Тооллого, судалгаа",
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
    </Container>
  );
}
