"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import { styled, useTheme } from "@mui/material/styles";
import { fNumber } from "src/utils/format-number";
import Chart, { useChart } from "src/components/chart";
import Scrollbar from "src/components/scrollbar";
import { TableHeadCustom } from "src/components/table";
import { useGetPurchaseStats } from "src/api/public";

const MONTH_LABELS = [
  "1 сар", "2 сар", "3 сар", "4 сар", "5 сар", "6 сар",
  "7 сар", "8 сар", "9 сар", "10 сар", "11 сар", "12 сар",
];

const fMNT = (v) => (v ? `${fNumber(v)}₮` : "0₮");
const fCount = (v) => {
  const n = Number(v) || 0;
  return n === 0 ? "0" : fNumber(n);
};

const StyledChart = styled(Chart)(() => ({
  "& .apexcharts-canvas, .apexcharts-inner, svg, foreignObject": {
    height: `100% !important`,
  },
}));

const cardSx = (calling) => ({
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  ...(calling && {
    background:
      "linear-gradient(135deg, rgba(137,147,182,0.4), rgba(255,255,255,0.12))",
    color: "#f1f5f9",
  }),
});

export default function AppPurchaseStat({
  year,
  calling = false,
  table: showTable,
  chart: showChart,
}) {
  const theme = useTheme();
  const { purchase, purchaseLoading } = useGetPurchaseStats(year);

  const months = purchase?.months || [];
  const networks = purchase?.networks || [];
  const displayYear = purchase?.year || year;

  const chartSeries = networks.map((n) => n.amount || 0);
  const chartLabels = networks.map((n) => n.name);

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    labels: chartLabels,
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
        formatter: (value) => fMNT(value),
        title: { formatter: (seriesName) => `${seriesName}` },
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "88%",
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: "12px",
              ...(calling && { color: "#fff" }),
            },
            value: {
              show: true,
              fontSize: "16px",
              ...(calling && { color: "#fff" }),
              formatter: (value) => fMNT(value),
            },
            total: {
              show: true,
              label: "Нийт",
              fontSize: "12px",
              ...(calling && { color: "#fff" }),
              formatter: (w) => {
                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return fMNT(sum);
              },
            },
          },
        },
      },
    },
  });

  if (purchaseLoading) return null;

  // Сарын хүснэгт
  if (showTable) {
    const cellColor = calling ? "#f1f5f9" : undefined;
    const borderColor = calling ? "rgba(241,245,249,0.12)" : undefined;
    const headSx = {
      "& .MuiTableCell-root": {
        py: 0.5,
        px: 1,
        ...(calling && {
          color: "rgba(241,245,249,0.7)",
          backgroundColor: "transparent",
          borderBottom: `1px solid ${borderColor}`,
        }),
      },
    };
    const bodySx = {
      py: 0.5,
      px: 1,
      color: cellColor,
      borderBottom: calling ? `1px solid ${borderColor}` : undefined,
    };

    return (
      <Card sx={{ ...cardSx(calling), p: 2.5 }}>
        <CardHeader
          title="Худалдан авалт (сараар)"
          subheader={`${displayYear} он`}
          sx={{ mb: 3, p: 0 }}
        />
        <TableContainer sx={{ overflow: "hidden" }}>
          <Scrollbar sx={{ "& .simplebar-content": { width: "100%" } }}>
            <Table size="small">
              <TableHeadCustom
                sx={headSx}
                headLabel={[
                  { id: "no", label: "№", width: 40 },
                  { id: "month", label: "Сар" },
                  { id: "total", label: "Нийт", align: "right" },
                  { id: "year", label: `${displayYear} он`, align: "right" },
                ]}
              />
              <TableBody>
                {months.map((m, i) => (
                  <TableRow
                    key={m.month}
                    hover
                    sx={calling ? { "&:hover td": { backgroundColor: "rgba(255,255,255,0.04)" } } : undefined}
                  >
                    <TableCell sx={bodySx}>{i + 1}</TableCell>
                    <TableCell sx={bodySx}>{MONTH_LABELS[i]}</TableCell>
                    <TableCell sx={bodySx} align="right">{fCount(m.total_count)}</TableCell>
                    <TableCell sx={bodySx} align="right">{fCount(m.year_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      </Card>
    );
  }

  // Donut chart + сүлжээний хүснэгт
  if (showChart) {
    const cellColor = calling ? "#f1f5f9" : undefined;
    const borderColor = calling ? "rgba(241,245,249,0.12)" : undefined;
    const headSx = {
      "& .MuiTableCell-root": {
        py: 0.5,
        px: 1,
        ...(calling && {
          color: "rgba(241,245,249,0.7)",
          backgroundColor: "transparent",
          borderBottom: `1px solid ${borderColor}`,
        }),
      },
    };
    const bodySx = {
      py: 0.5,
      px: 1,
      color: cellColor,
      borderBottom: calling ? `1px solid ${borderColor}` : undefined,
    };

    return (
      <Card sx={{ ...cardSx(calling), p: 2.5 }}>
        <CardHeader
          title="Худалдан авалт (сүлжээгээр)"
          subheader={`${displayYear} он`}
          sx={{ mb: 3, p: 0 }}
        />

        {networks.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "center", md: "stretch" }, flex: 1, gap: 2 }}>
            <Box sx={{ flex: { md: "0 0 40%" }, minWidth: 0, display: "flex", alignItems: "center", width: { xs: "100%", md: "auto" } }}>
              <StyledChart
                dir="ltr"
                type="donut"
                series={chartSeries}
                options={chartOptions}
                width="100%"
                height="100%"
              />
            </Box>
            <TableContainer sx={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
              <Scrollbar sx={{ "& .simplebar-content": { width: "100%" } }}>
                <Table size="small">
                  <TableHeadCustom
                    sx={headSx}
                    headLabel={[
                      { id: "name", label: "Сүлжээ" },
                      { id: "count", label: "Цэг", align: "right" },
                      { id: "amount", label: "Дүн", align: "right" },
                    ]}
                  />
                  <TableBody>
                    {networks.map((n) => (
                      <TableRow
                        key={n.name}
                        hover
                        sx={calling ? { "&:hover td": { backgroundColor: "rgba(255,255,255,0.04)" } } : undefined}
                      >
                        <TableCell sx={bodySx}>{n.name}</TableCell>
                        <TableCell sx={bodySx} align="right">{fCount(n.count)}</TableCell>
                        <TableCell sx={bodySx} align="right">{fMNT(n.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              minHeight: 180,
              p: 2,
              fontSize: 14,
              color: calling ? "rgba(241,245,249,0.7)" : "text.secondary",
            }}
          >
            Мэдээлэл алга байна
          </Box>
        )}
      </Card>
    );
  }

  return null;
}
