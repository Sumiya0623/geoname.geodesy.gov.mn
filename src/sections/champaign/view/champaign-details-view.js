"use client";

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import { useSettingsContext } from "src/components/settings";
import { useParams } from "next/navigation";
import { Box, Card, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import Iconify from "src/components/iconify";
import React, { useCallback, useState, useEffect } from "react";
import { useGetChampaign } from "src/api/champaign";
import BeltgelView from "./beltgel-view";
import SuurinView from "./suurin-view";
import HeerView from "./heer-view";
import { MayagtView } from "src/sections/mayagt/view";
import ProjectDetailsContent from "../champaign-details-content";

import { useNextStep } from "nextstepjs";

// Төслийн ажлын дараалал — таб биш, ПРОЦЕССЫН АЛХАМ хэлбэрээр
const STEPS = [
  {
    value: "beltgel",
    label: "Бэлтгэл ажил",
    icon: "solar:clipboard-list-bold",
  },
  {
    value: "suurin",
    label: "Суурин судалгаа",
    icon: "solar:documents-bold",
  },
  {
    value: "heer",
    label: "Хээрийн тодруулалт",
    icon: "solar:map-point-wave-bold",
  },
  {
    value: "bolowsruulalt",
    label: "Суурин боловсруулалт",
    icon: "solar:settings-bold",
  },
  {
    value: "result",
    label: "Маягтууд",
    icon: "solar:file-check-bold",
  },
];

// Алхмын дугаарын хэмжээ — холбогч зураас ЯГ ҮҮНИЙ голд таарна
const STEP_ICON_SIZE = 28;

function StepIcon({ active, completed, icon, step }) {
  return (
    <Box
      sx={{
        width: STEP_ICON_SIZE,
        height: STEP_ICON_SIZE,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        transition: "all .2s",
        // Дууссан — ногоон (success), идэвхтэй — цэнхэр (primary), бусад — саарал
        bgcolor: (t) =>
          completed
            ? t.palette.success.main
            : active
              ? t.palette.primary.main
              : alpha(t.palette.text.disabled, 0.12),
        color: (t) => (completed || active ? "#fff" : t.palette.text.disabled),
      }}
    >
      <Iconify
        icon={completed ? "solar:check-circle-bold" : step.icon}
        width={STEP_ICON_SIZE - 6}
      />
    </Box>
  );
}
StepIcon.propTypes = {
  active: PropTypes.bool,
  completed: PropTypes.bool,
  icon: PropTypes.node,
  step: PropTypes.object,
};

export default function ChampaignDetailsView() {
  const settings = useSettingsContext();
  const { id } = useParams();
  const { champaign } = useGetChampaign(id);
  const [currentTab, setCurrentTab] = useState("beltgel");
  const { currentStep, currentTour } = useNextStep();

  const handleChangeTab = useCallback((newValue) => {
    setCurrentTab(newValue);
  }, []);

  useEffect(() => {
    if (currentTour === "agreement-dynamic") {
      if (currentStep < 5) {
        setCurrentTab("beltgel");
      }
    }
  }, [currentStep, currentTour]);

  const activeIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.value === currentTab),
  );

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <Card sx={{ p: 2, mb: 2 }}>
        <ProjectDetailsContent project={champaign} />

        {/* Үе шатууд — дугаарууд хооронд ХОЛБОГЧ ЗУРААС, доор нь шошго.
            MUI Stepper‑ийн байрлал 44px icon‑д тохирдоггүй тул энгийн flex
            мөрөөр өөрсдөө байрлуулав (зураас нь дугаарын голд, 22px). */}
        <Stack
          direction="row"
          alignItems="flex-start"
          sx={{ mt: 3, px: { xs: 1, md: 4 } }}
        >
          {STEPS.map((step, i) => (
            <React.Fragment key={step.value}>
              {i > 0 && (
                // Холбогч — icon‑той ЯГ ИЖИЛ өндөртэй хайрцаг дотор босоо
                // голлуулсан тул зураас нь icon‑ы дунд түвшинд таарна
                // (шошгыг тооцохгүй). Төгсгөлд нь чиглэлийн сум.
                <Box
                  sx={{
                    flex: 1,
                    height: STEP_ICON_SIZE,
                    mx: 1,
                    display: "flex",
                    alignItems: "center",
                    color: (t) =>
                      i < activeIndex
                        ? t.palette.success.main
                        : i === activeIndex
                          ? t.palette.primary.main
                          : t.palette.divider,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 3,
                      borderRadius: 1,
                      bgcolor: "currentColor",
                    }}
                  />
                  <Iconify
                    icon="eva:arrow-ios-forward-fill"
                    width={18}
                    sx={{ ml: -0.75, flexShrink: 0 }}
                  />
                </Box>
              )}
              <Box
                onClick={() => handleChangeTab(step.value)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  minWidth: 110,
                }}
              >
                <StepIcon
                  step={step}
                  icon={i + 1}
                  active={i === activeIndex}
                  completed={i < activeIndex}
                />
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    textAlign: "center",
                    fontWeight: i === activeIndex ? 700 : 500,
                    color:
                      i === activeIndex
                        ? "primary.main"
                        : i < activeIndex
                          ? "success.main"
                          : "text.disabled",
                  }}
                >
                  {step.label}
                </Typography>
              </Box>
            </React.Fragment>
          ))}
        </Stack>
      </Card>

      {/* Алхмын контент — lazy (идэвхтэй алхам л mount хийгдэнэ) */}
      {currentTab === "beltgel" && <BeltgelView projectId={id} />}
      {currentTab === "suurin" && <SuurinView projectId={id} />}
      {currentTab === "heer" && <HeerView projectId={id} />}
      {currentTab === "result" && <MayagtView projectId={id} />}
    </Container>
  );
}
