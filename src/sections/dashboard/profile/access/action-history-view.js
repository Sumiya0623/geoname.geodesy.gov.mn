import React, { useMemo } from 'react'
import { useGetActionChart } from 'src/api/access'
import CustomDateRangePicker, { useDateRangePicker } from 'src/components/custom-date-range-picker'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BarPlot } from '@mui/x-charts/BarChart'
import { ChartContainer } from '@mui/x-charts/ChartContainer'
import { ChartsXAxis } from '@mui/x-charts/ChartsXAxis'
import { ChartsYAxis } from '@mui/x-charts/ChartsYAxis'
import { ChartsTooltip } from '@mui/x-charts/ChartsTooltip'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function formatDateYMD(date) {
  if (!date) return ''
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy} ${mm} ${dd}`
}

function ActionHistoryView() {
  const today = useMemo(() => new Date(), [])
  const defaultFromDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    return d
  }, [today])
  const defaultToDate = useMemo(() => new Date(today), [today])

  const rangePicker = useDateRangePicker(defaultFromDate, defaultToDate)

  const from = rangePicker.startDate ? isoDate(rangePicker.startDate) : ''
  const to = rangePicker.endDate ? isoDate(rangePicker.endDate) : ''

  const { act, actLoading, actError } = useGetActionChart(
    rangePicker && rangePicker.selected ? { from, to } : {}
  )

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <div>
            <strong>Хүрээ:</strong>{' '}
            {rangePicker.startDate && rangePicker.endDate
              ? `${formatDateYMD(rangePicker.startDate)} - ${formatDateYMD(rangePicker.endDate)}`
              : rangePicker.shortLabel}
          </div>

          <Button variant="outlined" onClick={rangePicker.onOpen}>
            Огноо сонгох
          </Button>
        </Stack>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <CustomDateRangePicker
            variant="calendar"
            open={rangePicker.open}
            startDate={rangePicker.startDate}
            endDate={rangePicker.endDate}
            onChangeStartDate={rangePicker.onChangeStartDate}
            onChangeEndDate={rangePicker.onChangeEndDate}
            onClose={rangePicker.onClose}
            error={rangePicker.error}
          />
        </LocalizationProvider>
      </div>

        {!act || Object.keys(act).length === 0 ? (
          <div></div>
        ) : (
          <div>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Үйлдлийн график
            </Typography>

            {(() => {
              const keys = Object.keys(act);
              const values = keys.map((k) => Number(act[k]) || 0);

              const series = [
                {
                  type: 'bar',
                  yAxisId: 'count',
                  label: 'Тоо',
                  color: 'primary',
                  data: values,
                  highlightScope: { highlight: 'item' },
                },
              ];

              return (
                <ChartContainer
                  series={series}
                  height={300}
                  xAxis={[
                    {
                      id: 'method',
                      data: keys,
                      scaleType: 'band',
                      valueFormatter: (v) => v,
                      height: 40,
                    },
                  ]}
                  yAxis={[{ id: 'count', scaleType: 'linear', position: 'left', width: 60 }]}
                >
                  <BarPlot />
                  <ChartsXAxis label="Үйлдэл" axisId="method" />
                  <ChartsYAxis label="Тоо" axisId="count" />
                  <ChartsTooltip />
                </ChartContainer>
              );
            })()}
          </div>
        )}
    </div>
  )
}

export default ActionHistoryView