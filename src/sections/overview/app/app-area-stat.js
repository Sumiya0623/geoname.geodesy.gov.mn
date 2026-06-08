"use client";

import Grid from "@mui/material/Unstable_Grid2";
import { useTheme } from "@mui/material/styles";

import { useGetStats } from "src/api/public";
import AppWidgetSummary from "./app-widget-summary";
import { AppTimelineChart } from "./app-area-implemet";
import AppPurchaseStat from "./app-purchase-stat";

export default function StatView({ year, calling = false }) {
  const theme = useTheme();
  const { stats } = useGetStats(year);
  const safeStats = Array.isArray(stats) ? stats : [];
  const colorSets = [
    [theme.palette.primary.light, theme.palette.primary.main],
    [theme.palette.info.light, theme.palette.info.main],
    [theme.palette.success.light, theme.palette.success.main],
    [theme.palette.warning.light, theme.palette.warning.main],
    [theme.palette.error.light, theme.palette.error.main],
  ];

  const displayYear = (() => {
    if (typeof year === "string") {
      const norm = year.trim().toLowerCase();
      if (norm === "бүгд" || norm === "all" || norm === "all_years") {
        return new Date().getFullYear();
      }
    }
    return year;
  })();

  return (
    <>
      {/* Сүлжээний статистик картууд - 1 мөрөнд бүгд */}
      <Grid xs={12} md={12} id="stat-all">
        <Grid container spacing={1}>
          {safeStats.length === 0 ? (
            <Grid xs={12}>
              <p style={{ textAlign: "center", margin: "1rem 0" }}>
                Мэдээлэл алга байна
              </p>
            </Grid>
          ) : (
            safeStats.map((net, index) => {
              const classes = Array.isArray(net.classes) ? net.classes : [];
              const chartSeries = classes.map((cls) => ({
                name: cls?.name || "Тодорхойгүй",
                data: [Number(cls?.count) || 0],
              }));

              const colorPair = colorSets[index % colorSets.length];
              const itemKey =
                net?.id ?? net?.uuid ?? net?.code ?? net?.name ?? index;

              const colSize =
                safeStats.length <= 4
                  ? 12 / safeStats.length
                  : safeStats.length <= 6
                    ? 2
                    : 1.5;

              return (
                <Grid key={itemKey} xs={6} sm={4} md={colSize} display="flex">
                  <AppWidgetSummary
                    title={net?.name || "Тодорхойгүй"}
                    total={Number(net?.count) || 0}
                    percent={0}
                    chart={{
                      colors: colorPair,
                      series: chartSeries,
                    }}
                    calling={calling}
                    sx={{ width: "100%", p: 2 }}
                  />
                </Grid>
              );
            })
          )}
        </Grid>
      </Grid>

      {/* Тооллого + Худалдан авалт */}
      <Grid xs={12}>
        <Grid container spacing={1} sx={{ alignItems: "stretch" }}>
          <Grid xs={12} md={6} lg={12} display="flex">
            <AppTimelineChart
              title="Тооллого / хэмжилт хугацаагаар"
              subheader={`Он: ${displayYear}`}
              calling={calling}
              year={displayYear}
            />
          </Grid>
          <Grid xs={12} md={6} lg={4} display="flex">
            <AppPurchaseStat year={displayYear} calling={calling} table />
          </Grid>
          <Grid xs={12} md={6} lg={8} display="flex">
            <AppPurchaseStat year={displayYear} calling={calling} chart />
          </Grid>
        </Grid>
      </Grid>
    </>
  );
}
