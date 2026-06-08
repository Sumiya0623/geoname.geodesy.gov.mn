import PropTypes from "prop-types";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { fNumber } from "src/utils/format-number";
import Chart from "src/components/chart";

// ----------------------------------------------------------------------

export default function AppWidgetSummary({
  title,
  total,
  chart,
  sx,
  calling = false,
  ...other
}) {
  const theme = useTheme();

  // --- Chart props: colors / series / options / labels (optional) ---
  const {
    colors = [theme.palette.primary.light, theme.palette.primary.main],
    series = [],
    labels: propLabels = [], // 👈 нэрсийг эндээс авч болно
    options,
  } = chart || {};

  // --- normalize: series нь [number] эсвэл [{name, value}] байж болно ---
  //    data: [1,2,3]
  //    labels: ['A','B','C']
  let data = [];
  let labels = [];

  if (series.length && typeof series[0] === "number") {
    // [number, number, ...]
    data = series.map((n) => Number(n) || 0);
    labels = Array.isArray(propLabels) ? propLabels : [];
  } else if (series.length && typeof series[0] === "object") {
    // [{ name, value }] эсвэл [{ name, data: [value] }]
    data = series.map((s) => {
      if (Array.isArray(s?.data)) return Number(s.data[0]) || 0;
      return Number(s?.value) || 0;
    });
    // priority: chart.labels -> series[].name
    if (Array.isArray(propLabels) && propLabels.length) {
      labels = propLabels;
    } else {
      labels = series.map((s) => (s?.name ? String(s.name) : ""));
    }
  } else {
    data = [];
    labels = Array.isArray(propLabels) ? propLabels : [];
  }

  // --- colors ---
  const gradientStart = Array.isArray(colors[0]) ? colors[0][0] : colors[0];
  const gradientEnd = Array.isArray(colors[0])
    ? colors[0][1]
    : (colors[1] ?? colors[0]);
  const chartColors = colors.map((c) => (Array.isArray(c) ? c[1] : c));

  const chartOptions = {
    colors: chartColors,
    fill: {
      type: "gradient",
      gradient: {
        colorStops: [
          { offset: 0, color: gradientStart, opacity: 1 },
          { offset: 100, color: gradientEnd, opacity: 1 },
        ],
      },
    },
    chart: { sparkline: { enabled: true } },
    plotOptions: {
      bar: { columnWidth: "68%", borderRadius: 2 },
    },
    xaxis: {
      categories: labels,
      labels: { show: false },
      tooltip: { enabled: false },
    },
    tooltip: {
      x: {
        show: true,
        formatter: (val, opts) => {
          const i = opts?.dataPointIndex ?? -1;
          return labels[i] || "";
        },
      },
      y: {
        formatter: (value) => fNumber(value),
        title: { formatter: () => "" },
      },
      marker: { show: false },
    },
    ...(calling && {
      dataLabels: { enabled: false },
    }),
    ...options,
  };

  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        p: 1.5,
        background: calling
          ? "linear-gradient(145deg, rgba(168, 85, 247, 0.08), rgba(236, 72, 153, 0.06), rgba(255, 255, 255, 0.03))"
          : undefined,
        border: calling ? "1px solid rgba(168, 85, 247, 0.15)" : undefined,
        backdropFilter: calling ? "blur(20px)" : undefined,
        boxShadow: calling ? "0 8px 32px rgba(168, 85, 247, 0.1)" : undefined,
        ...sx,
      }}
      {...other}
    >
      <Typography
        variant="caption"
        noWrap
        title={title}
        sx={{
          lineHeight: 1.2,
          color: calling ? "#f1f5f9" : "text.secondary",
          mb: 0.5,
          textTransform: "uppercase",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", color: calling ? "#f1f5f9" : "text.primary" }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>{fNumber(total) || 0}</Typography>
        <Chart
          dir="ltr"
          type="bar"
          series={[{ data }]}
          options={chartOptions}
          width={60}
          height={32}
        />
      </Box>
    </Card>
  );
}

AppWidgetSummary.propTypes = {
  chart: PropTypes.object,
  sx: PropTypes.object,
  title: PropTypes.string,
  total: PropTypes.number,
};
