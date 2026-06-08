import React, { useMemo } from 'react';
import { Grid, Card, CardHeader, CardContent, Box, Typography } from '@mui/material';
import { useGetStatuses } from 'src/api/constant';
import Chart from 'src/components/chart/chart';
import ActCardView from 'src/sections/champaign/act/view/act-card-view';
import { CountListView } from './count/view';

function DetailOrderAct({ pointId }) {
  const { statuses, statusesLoading } = useGetStatuses('PAYMENT_STATUS', pointId);

  const chartData = useMemo(() => {
    if (!statuses?.length) return { series: [], labels: [] };
    
    return {
      series: statuses.map(status => status?.count || ''),
      labels: statuses.map(status => status?.name || '')
    };
  }, [statuses]);

  const chartOptions = {
    chart: {
      type: 'pie',
      height: 350,
    },
    legend: {
      position: 'bottom',
    },
    tooltip: {
      y: {
        formatter: (value) => `${value} захиалга`
      }
    },
    colors: statuses.map(status => {
      switch (status?.color) {
        case 'success': return '#10B981';
        case 'error': return '#EF4444';
        case 'warning': return '#F59E0B';
        case 'primary': return '#3B82F6';
        default: return '#6B7280';
      }
    }),
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 200
        },
        legend: {
          position: 'bottom'
        }
      }
    }],
    labels: statuses.map(status => status.name)
  };

  return (
    <Grid container spacing={3} id='service-access'>
      <Grid item xs={12} lg={5}>
        <Card sx={{ height: 'fit-content' }}>
          <CardHeader 
            title="Худалдан авалт" 
            subheader="Захиалгын төлбөрийн төлөв байдал"
          />
          <CardContent>
            <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {statusesLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Диаграм ачаалж байна...
                </Typography>
              ) : chartData.series.length > 0 ? (
                <Chart
                  type="pie"
                  series={chartData.series}
                  options={chartOptions}
                  height={350}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Өгөгдөл байхгүй байна
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} lg={7}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Акт" 
              />
              <CardContent sx={{ minHeight: 475 }}>
                <ActCardView pointId={pointId} maxDisplay={6} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>
          
      <Grid item xs={12}>
        <CountListView pointId={pointId} />
      </Grid>
    </Grid>
  );
}

export default DetailOrderAct;