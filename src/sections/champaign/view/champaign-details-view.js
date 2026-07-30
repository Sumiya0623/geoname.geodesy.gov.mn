"use client";

import PropTypes from "prop-types";
import Container from "@mui/material/Container";
import { useSettingsContext } from "src/components/settings";
import { useParams } from "next/navigation";
import {
  Box,
  Card,
  Step,
  Stepper,
  StepButton,
  StepConnector,
  Typography,
  stepConnectorClasses,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import Iconify from "src/components/iconify";
import { useCallback, useState, useEffect } from "react";
import { useGetChampaign } from "src/api/champaign";
import { BeltgelListView } from "src/sections/beltgel/view";
import { SuurinListView } from "src/sections/suurin/view";
import { HeerView } from "src/sections/heer/view";
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
    label: "Хээрийн судалгаа",
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

// Алхмуудын хооронд — өнгөт холбогч зураас (өнгөрсөн алхам нь дүүрсэн)
function StepLine(props) {
  return (
    <StepConnector
      {...props}
      sx={{
        top: 22,
        [`& .${stepConnectorClasses.line}`]: {
          borderTopWidth: 3,
          borderRadius: 1,
          borderColor: (t) => t.palette.divider,
        },
        [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
          borderColor: (t) => t.palette.primary.main,
        },
        [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
          borderColor: (t) => t.palette.primary.main,
        },
      }}
    />
  );
}

function StepIcon({ active, completed, icon, step }) {
  return (
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        transition: "all .2s",
        bgcolor: (t) =>
          completed || active
            ? t.palette.primary.main
            : alpha(t.palette.text.disabled, 0.12),
        color: (t) =>
          completed || active ? "#fff" : t.palette.text.disabled,
        boxShadow: (t) =>
          active ? `0 0 0 4px ${alpha(t.palette.primary.main, 0.2)}` : "none",
      }}
    >
      <Iconify
        icon={completed ? "solar:check-circle-bold" : step.icon}
        width={completed ? 26 : 24}
      />
      {/* Алхмын дугаар — доод баруун булангийн жижиг тэмдэг */}
      <Box
        sx={{
          position: "absolute",
          right: -2,
          bottom: -2,
          minWidth: 18,
          height: 18,
          px: 0.5,
          borderRadius: "9px",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.paper",
          color: (t) =>
            completed || active
              ? t.palette.primary.main
              : t.palette.text.disabled,
          border: (t) =>
            `1px solid ${
              completed || active
                ? t.palette.primary.main
                : t.palette.divider
            }`,
        }}
      >
        {icon}
      </Box>
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

        <Stepper
          nonLinear
          alternativeLabel
          activeStep={activeIndex}
          connector={<StepLine />}
          sx={{ mt: 3, pt: 1, px: { xs: 1, md: 4 } }}
        >
          {STEPS.map((step, i) => (
            <Step key={step.value} completed={i < activeIndex}>
              <StepButton
                onClick={() => handleChangeTab(step.value)}
                icon={i + 1}
                sx={{ py: 1, borderRadius: 1 }}
                StepIconComponent={(props) => (
                  <StepIcon {...props} step={step} />
                )}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: i === activeIndex ? 700 : 500,
                    color:
                      i === activeIndex
                        ? "primary.main"
                        : i < activeIndex
                          ? "text.primary"
                          : "text.disabled",
                  }}
                >
                  {step.label}
                </Typography>
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Card>

      {/* Алхмын контент — lazy (идэвхтэй алхам л mount хийгдэнэ) */}
      {currentTab === "beltgel" && <BeltgelListView projectId={id} />}
      {currentTab === "suurin" && <SuurinListView projectId={id} />}
      {currentTab === "heer" && <HeerView projectId={id} />}
      {currentTab === "result" && <MayagtView projectId={id} />}
    </Container>
  );
}
