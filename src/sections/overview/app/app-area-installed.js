// AppAreaInstalled.js
'use client';

import PropTypes from 'prop-types';
import Card from '@mui/material/Card';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Chart, { useChart } from 'src/components/chart';
import { useGetReportsList } from 'src/api/public';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export default function AppAreaInstalled({
  title,
  year,
  subheader,
  chart = {},
  calling,
  ...other
}) {
  const theme = useTheme();

  // chart пропоос өнгө/опшн авна
  const {
    colors = [
      [theme.palette.primary.light, theme.palette.primary.main],
      [theme.palette.warning.light, theme.palette.warning.main],
    ],
    categories, // parent-аас ирж болох x-axis шошгууд
    options, // parent-аас ирж болох apex опшн
    series, // parent-аас ирж болох өгөгдөл (optional)
  } = chart;

  // ---------- 1) Parent-аас өгсөн series-ийг ашиглах горим ----------
  // Хүлээж буй формат (таны Stat-ийн жишээтэй таарна):
  // chart = {
  //   categories: [...12 labels...],
  //   series: [
  //     {
  //       year: '2025',
  //       data: [
  //         { name: 'Гэрээ', data: [12 тоо] },
  //         { name: 'Ажлын даалгавар', data: [12 тоо] },
  //       ],
  //     },
  //   ],
  // }
  let chartSeries = [];
  let xCategories = [];

  const hasPropSeries = Array.isArray(series) && series.length > 0 && Array.isArray(series[0].data);

  if (hasPropSeries) {
    // эхний блокийг ашиглая (year таарч байгааг шалгахыг хүсвэл энд харьцуулж болно)
    const block = series[0];
    chartSeries = block.data.map((s) => ({ name: s.name, data: s.data }));
    xCategories = Array.isArray(categories) && categories.length ? categories : MONTH_LABELS;
  }

  // ---------- 2) API-гаас татаж зурдаг горим ----------
  // Хэрвээ parent-аас series өгөөгүй бол accepted/unaccepted-ийг мөрийн графикт хөрвүүлнэ
  const shouldFetch = !hasPropSeries;

  const { reports } = useGetReportsList(shouldFetch ? { year } : null);
  // useGetReportsList hook тань параметргүй дуудлагыг дэмжихгүй бол
  // дотор нь null ирвэл fetch хийхгүй гэж бичсэн эсэхээ шалгаарай.

  function convertToLineChartData(data) {
    const accepted = (data && data.accepted) || [];
    const unaccepted = (data && data.unaccepted) || [];

    const counts = {}; // { '2025-09-01': {accepted: n, unaccepted: m}, ... }

    accepted.forEach((item) => {
      const date = item.modified_date;
      if (!counts[date]) counts[date] = { accepted: 0, unaccepted: 0 };
      counts[date].accepted += 1;
    });

    unaccepted.forEach((item) => {
      const date = item.modified_date;
      if (!counts[date]) counts[date] = { accepted: 0, unaccepted: 0 };
      counts[date].unaccepted += 1;
    });

    const dates = Object.keys(counts).sort();
    const acceptedSeries = dates.map((d) => ({ x: d, y: counts[d].accepted }));
    const unacceptedSeries = dates.map((d) => ({ x: d, y: counts[d].unaccepted }));

    return [
      { name: 'Зөвшөөрсөн', data: acceptedSeries },
      { name: 'Татгалзсан', data: unacceptedSeries },
    ];
  }

  if (!hasPropSeries && reports) {
    const converted = convertToLineChartData(reports);
    xCategories = (converted[0] && converted[0].data.map((d) => d.x)) || [];
    chartSeries = converted.map((s) => ({ name: s.name, data: s.data.map((d) => d.y) }));
  }

  // ---------- Chart Options ----------
  const chartOptions = useChart({
    colors: colors.map((c) => c[1]),
    ...(calling && {
      fill: {
        type: 'gradient',
        gradient: {
          colorStops: colors.map((c) => [
            { offset: 0, color: c[0], opacity: 1 },
            { offset: 100, color: c[1], opacity: 1 },
          ]),
        },
      },
      legend: { labels: { colors: '#fff' } },
    }),
    xaxis: {
      categories: xCategories,
    },
    ...options,
  });

  return (
    <Card
      sx={{
        ...(calling && {
          background:
            'linear-gradient(135deg, rgba(137, 147, 182, 0.4), rgba(255, 255, 255, 0.12))',
          color: '#f1f5f9',
        }),
      }}
      {...other}
    >
      <CardHeader title={title} subheader={subheader} />
      <Chart
        dir="ltr"
        type="line"
        series={chartSeries}
        options={chartOptions}
        width="100%"
        height={364}
      />
    </Card>
  );
}

AppAreaInstalled.propTypes = {
  chart: PropTypes.object,
  subheader: PropTypes.string,
  title: PropTypes.string,
  year: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  calling: PropTypes.bool,
};
