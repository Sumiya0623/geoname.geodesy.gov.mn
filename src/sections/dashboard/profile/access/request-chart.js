import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
} from "@mui/material";
import { format, parseISO } from "date-fns";
import { useGetRequestsChart } from "src/api/access";
import Chart from "react-apexcharts";
import { getMethodColor, getMethodGradientColors } from "./method-colors";

// ----------------------------------------------------------------------

const INTERVAL_OPTIONS = [
  { value: "hour", label: "Цаг" },
  { value: "day", label: "Өдөр" },
  { value: "month", label: "Сар" },
  { value: "year", label: "Жил" },
];

const METHOD_OPTIONS = [
  { value: "", label: "Бүгд" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Бүгд" },
  { value: "200", label: "200" },
  { value: "201", label: "201" },
  { value: "400", label: "400" },
  { value: "401", label: "401" },
  { value: "403", label: "403" },
  { value: "404", label: "404" },
  { value: "500", label: "500" },
];

export default function RequestChart({ selectedMethod, onMethodChange }) {
  const theme = useTheme();
  const [filters, setFilters] = useState({
    interval: "day",
    status_code: "",
  });

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      method: selectedMethod ? selectedMethod.toUpperCase() : "",
    }),
    [filters, selectedMethod]
  );

  const { reqCharts, reqChartsLoading, reqChartsError } =
    useGetRequestsChart(effectiveFilters);

  const handleFilterChange = useCallback(
    (name, value) => {
      if (name === "method") {
        onMethodChange?.(value);
      } else {
        setFilters((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    },
    [onMethodChange]
  );

  const chartData = useMemo(() => {
    if (!reqCharts || !Array.isArray(reqCharts)) {
      return { labels: [], data: [] };
    }

    const formatPeriod = (period, interval) => {
      if (!period) return "";
      try {
        const date = parseISO(period);
        switch (interval) {
          case "hour":
            return format(date, "MM/dd HH:mm");
          case "day":
            return format(date, "MM/dd");
          case "month":
            return format(date, "yyyy/MM");
          case "year":
            return format(date, "yyyy");
          default:
            return format(date, "MM/dd");
        }
      } catch (error) {
        return String(period);
      }
    };

    const labels = [];
    const data = [];

    reqCharts.forEach((item) => {
      if (!item) return;
      const label = formatPeriod(item.period, filters.interval);
      if (!label) return;
      labels.push(label);
      data.push(
        typeof item.count === "number" ? item.count : Number(item.count) || 0
      );
    });

    return { labels, data };
  }, [reqCharts, filters.interval]);

  const renderFilters = (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Интервал</InputLabel>
          <Select
            value={filters.interval}
            label="Интервал"
            onChange={(e) => handleFilterChange("interval", e.target.value)}
          >
            {INTERVAL_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth size="small">
          <InputLabel>Үйлдэл</InputLabel>
          <Select
            // Dropdown дээр үргэлж uppercase утга харуулах
            value={effectiveFilters.method}
            label="Үйлдэл"
            onChange={(e) => handleFilterChange("method", e.target.value)}
            sx={{
              ...(effectiveFilters.method && {
                backgroundColor: "action.hover",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "primary.main",
                },
              }),
            }}
          >
            {METHOD_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );

  const chartOptions = {
    chart: {
      type: "line",
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      zoom: { enabled: true },
      selection: {
        enabled: true,
        type: "x",
        fill: {
          color: getMethodColor(effectiveFilters.method),
          opacity: 0.1,
        },
        stroke: {
          width: 1,
          dashArray: 3,
          color: getMethodColor(effectiveFilters.method),
          opacity: 0.4,
        },
      },
    },
    stroke: {
      width: 3,
      curve: "smooth",
    },
    fill: {
      type: "gradient",
      gradient: {
        shade: "dark",
        type: "vertical",
        shadeIntensity: 0.5,
        gradientToColors: getMethodGradientColors(effectiveFilters.method),
        inverseColors: false,
        opacityFrom: 0.8,
        opacityTo: 0.2,
        stops: [0, 100],
      },
    },
    colors: [getMethodColor(effectiveFilters.method)],
    xaxis: {
      type: "category",
      categories: chartData.labels,
      labels: {
        style: {
          colors: theme.palette.text.secondary,
          fontSize: "12px",
        },
      },
    },
    yaxis: {
      title: {
        text: "Тоо",
        style: {
          color: theme.palette.text.secondary,
        },
      },
      labels: {
        style: {
          colors: theme.palette.text.secondary,
        },
      },
      min: 0,
      max: chartData.data.length
        ? Math.max(...chartData.data) * 1.1
        : undefined,
    },
    grid: {
      borderColor: theme.palette.divider,
      strokeDashArray: 3,
    },
    tooltip: {
      theme: theme.palette.mode,
      y: {
        formatter: (value) => `${value} хүсэлт`,
      },
    },
    legend: {
      show: false,
    },
  };

  const renderChart = () => {
    if (reqChartsLoading) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      );
    }

    if (!reqCharts && reqChartsError) {
      return (
        <Alert severity="error" sx={{ my: 2 }}>
          Графикийн өгөгдөл ачаалахад алдаа гарлаа
        </Alert>
      );
    }

    return (
      <Chart
        type="area"
        series={[
          {
            name: "Хүсэлтийн тоо",
            data: chartData.data.length ? chartData.data : [0],
          },
        ]}
        options={chartOptions}
        height={300}
      />
    );
  };

  return (
    <Card sx={{ p: "0!important" }}>
      <CardHeader
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h6">Хүсэлтийн статистик</Typography>
          </Box>
        }
        subheader="Хүсэлтийн тоо цаг хугацааны дагуу"
      />
      <CardContent>
        {renderFilters}
        {renderChart()}
      </CardContent>
    </Card>
  );
}

RequestChart.propTypes = {
  selectedMethod: PropTypes.string,
  onMethodChange: PropTypes.func,
};
