import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import { styled, useTheme } from "@mui/material/styles";
import { fNumber } from "src/utils/format-number";
import Chart, { useChart } from "src/components/chart";
import { useGetStatus, useGetTimeline } from "src/api/public";

const StyledChart = styled(Chart)(() => ({
  "& .apexcharts-canvas, .apexcharts-inner, svg, foreignObject": {
    height: `100% !important`,
  },
}));

// --- 1) Статусын хуваарилалт (donut) ---
export function AppCurrentImplement({
  title,
  subheader,
  calling,
  year,
  ...other
}) {
  const theme = useTheme();
  const { status, statusLoading } = useGetStatus(year);

  const chart = {
    series:
      !statusLoading && Array.isArray(status) && status.length > 0
        ? status.map((s) => ({
            label: s.name || "",
            value: s.count || 0,
          }))
        : [],
  };

  const { series = [] } = chart;
  const chartSeries = series.map((i) => i.value);

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    labels: series.map((i) => i.label),
    stroke: { colors: [theme.palette.background.paper] },
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "11px",
      offsetY: 4,
      itemMargin: { horizontal: 6, vertical: 0 },
      ...(calling && { labels: { colors: "#fff" } }),
    },
    tooltip: {
      fillSeriesColor: false,
      y: {
        formatter: (value) => fNumber(value),
        title: { formatter: (seriesName) => `${seriesName}` },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "90%",
          labels: {
            show: true,
            name: { show: true, ...(calling && { color: "#fff" }) },
            value: {
              show: true,
              ...(calling && { color: "#fff" }),
              formatter: (value) => fNumber(value),
            },
            total: {
              show: true,
              label: "Нийт",
              ...(calling && { color: "#fff" }),
              formatter: (w) => {
                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return fNumber(sum);
              },
            },
          },
        },
      },
    },
    ...(calling && {
      dataLabels: { enabled: true, style: { colors: ["#fff"] } },
    }),
  });

  return (
    <Card
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...(calling && {
          background:
            "linear-gradient(135deg, rgba(137, 147, 182, 0.4), rgba(255, 255, 255, 0.12))",
          color: "#f1f5f9",
        }),
      }}
      {...other}
    >
      <CardHeader title={title} subheader={subheader} titleTypographyProps={{ variant: "subtitle1" }} subheaderTypographyProps={{ variant: "caption" }} sx={{ pb: 0 }} />
      <StyledChart
        dir="ltr"
        type="donut"
        key={year}
        series={chartSeries}
        options={chartOptions}
        width="100%"
        height={180}
      />
    </Card>
  );
}

AppCurrentImplement.propTypes = {
  chart: PropTypes.object,
  subheader: PropTypes.string,
  title: PropTypes.string,
  year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  calling: PropTypes.bool,
};

// --- 2) Timeline line chart (TIMELINE API) ---
export function AppTimelineChart({ title, subheader, calling, year, ...other }) {
  const theme = useTheme();
  const { timeline, timelineLoading } = useGetTimeline(year);

  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const monthLabels = [
    "1 сар",
    "2 сар",
    "3 сар",
    "4 сар",
    "5 сар",
    "6 сар",
    "7 сар",
    "8 сар",
    "9 сар",
    "10 сар",
    "11 сар",
    "12 сар",
  ];

  const series =
    !timelineLoading && safeTimeline.length > 0
      ? safeTimeline.map((row) => ({
          name: row.status || "",
          data: monthLabels.map((_, idx) => {
            const m = row.months?.find((mm) => mm.month === idx + 1);
            return m ? Number(m.count) || 0 : 0;
          }),
        }))
      : [];

  const chartSeries = series;

  const chartOptions = useChart({
    chart: {
      stacked: false,
      toolbar: { show: true },
      zoom: { enabled: false },
    },
    stroke: { width: 2 },
    xaxis: {
      categories: monthLabels,
    },
    yaxis: {
      labels: {
        formatter: (value) => fNumber(value),
      },
    },
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "11px",
      offsetY: 4,
      itemMargin: { horizontal: 6, vertical: 0 },
      ...(calling && { labels: { colors: "#fff" } }),
      formatter: (seriesName, opts) => {
        const totals = opts?.w?.globals?.seriesTotals || [];
        const total = totals[opts.seriesIndex] || 0;
        return `${seriesName} (${fNumber(total)})`;
      },
    },
    tooltip: {
      fillSeriesColor: false,
      y: {
        formatter: (value) => fNumber(value),
        title: { formatter: (seriesName) => `${seriesName}` },
      },
    },
    ...(calling && {
      dataLabels: { enabled: true, style: { colors: ["#fff"] } },
    }),
  });

  return (
    <Card
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...(calling && {
          background:
            "linear-gradient(135deg, rgba(137, 147, 182, 0.4), rgba(255, 255, 255, 0.12))",
          color: "#f1f5f9",
        }),
      }}
      {...other}
    >
      <CardHeader title={title} subheader={subheader} titleTypographyProps={{ variant: "subtitle1" }} subheaderTypographyProps={{ variant: "caption" }} sx={{ pb: 0 }} />
      <StyledChart
        dir="ltr"
        type="line"
        key={year}
        series={chartSeries}
        options={chartOptions}
        width="100%"
        height={180}
      />
    </Card>
  );
}

AppTimelineChart.propTypes = {
  chart: PropTypes.object,
  subheader: PropTypes.string,
  title: PropTypes.string,
  year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  calling: PropTypes.bool,
};
