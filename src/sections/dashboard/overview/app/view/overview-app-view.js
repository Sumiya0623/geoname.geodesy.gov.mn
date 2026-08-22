"use client";

import Grid from "@mui/material/Unstable_Grid2";
import AppWelcome from "../app-welcome";
import { useState } from "react";

// ----------------------------------------------------------------------

export default function OverviewAppView({ calling = false }) {
  const year = "Бүгд";
  const [selectedyear, setYear] = useState(year);
  return (
    <Grid
      container
      spacing={3}
      padding={0}
      margin={
        calling
          ? "calc(var(--Grid-rowSpacing) / -2) calc(var(--Grid-columnSpacing) / -2)"
          : 0
      }
    >
      {!calling && (
        <Grid xs={12} md={12}>
          <AppWelcome
            title="Системд тавтай морилно уу 👋"
            description=""
            selectedYear={selectedyear}
            onYearChange={setYear}
          />
        </Grid>
      )}

    </Grid>
  );
}
