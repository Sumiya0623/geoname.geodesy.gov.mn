import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { isEqual } from 'lodash';

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import { Box, LinearProgress } from '@mui/material';

import AccessCard from './access-card'
import RequestChart from './request-chart'
import MethodCard from './method-card'
import Iconify from 'src/components/iconify'
import Scrollbar from 'src/components/scrollbar';
import { useGetActionChart, useGetRequests, useGetUserChart } from 'src/api/access'
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import RequestTableRow from './request-table-row';
import RequestTableToolbar from './request-table-toolbar';
import RequestDetailsDialog from './request-details-dialog';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: '', label: 'Nº', width: 10 },
  { id: 'user__first_name', label: 'Хэрэглэгч' },
  { id: 'url', label: 'URL' },
  { id: 'remote_ip', label: 'IP хаяг' },
  { id: 'datetime', label: 'Огноо' },
  { id: 'method', label: 'Үйлдэл' },
  { id: 'status_code', label: 'Статус' },
  { id: 'data', label: 'Өгөгдөл' },
];

const defaultFilters = {
  user__first_name: '',
  url: '',
  method: '',
  status_code: '',
};

function AccessHistoryView() {
  const table = useTable({
    defaultDense: true,
    defaultOrder: 'desc',
    defaultOrderBy: 'id',
    defaultRowsPerPage: 10,
  });

  const [filters, setFilters] = useState(defaultFilters);
  const [inputValues, setInputValues] = useState({
    user__first_name: '',
    url: '',
  });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prevFilters => ({
        ...prevFilters,
        user__first_name: inputValues.user__first_name,
        url: inputValues.url,
      }));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputValues.user__first_name, inputValues.url]);

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === 'desc' ? '-' : ''}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage]
  );

  const { requests, requestsEmpty, requestsLoading, requestsCount, requestsValidating } = useGetRequests(requestBody);
  const { act } = useGetActionChart({search:''})
  const { chart } = useGetUserChart({});

  const isLoading = requestsLoading || requestsValidating;

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      
      if (name === 'user__first_name' || name === 'url') {
        setInputValues(prev => ({
          ...prev,
          [name]: value,
        }));
      } else if (name === 'method') {
        setFilters((prevState) => ({
          ...prevState,
          [name]: value,
        }));
        setSelectedMethod(value ? value.toLowerCase() : '');
      } else {
        setFilters((prevState) => ({
          ...prevState,
          [name]: value,
        }));
      }
    },
    [table]
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setInputValues({
      user__first_name: '',
      url: '',
    });
    setSelectedMethod('');
  }, []);

  const canReset = !isEqual(defaultFilters, filters) || inputValues.user__first_name !== '' || inputValues.url !== '' || selectedMethod !== '';

  const handleViewDetails = useCallback((request) => {
    setSelectedRequest(request);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedRequest(null);
  }, []);

  const handleMethodCardClick = useCallback((method) => {
    const methodLower = method.toLowerCase();
    const newMethod = selectedMethod === methodLower ? '' : methodLower;
    setSelectedMethod(newMethod);
    
    setFilters(prevFilters => ({
      ...prevFilters,
      method: newMethod ? newMethod.toUpperCase() : '',
    }));
  }, [selectedMethod]);

  const handleChartMethodChange = useCallback((method) => {
    setSelectedMethod(method ? method.toLowerCase() : '');
  }, []);

  const renderTableToolbar = (
    <RequestTableToolbar
      filters={{ ...filters, ...inputValues }}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
      loading={isLoading}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map((_, index) => (
    <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  ));

  const renderTableRows = requests?.map((row, index) => (
    <RequestTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      onViewDetails={handleViewDetails}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={requestsEmpty} />;

  return (
    <Container maxWidth="xxl" sx={{ pt: 2 }}>
      {act && (
        <Grid container spacing={2} sx={{ mb: 3 }} id="access-tour1">
          {Object.entries(act)
            .filter(([method]) => method.toLowerCase() !== 'put')
            .map(([method, count]) => (
            <Grid item xs={6} sm={4} md={3} key={method}>
              <MethodCard 
                method={method} 
                value={count} 
                onClick={handleMethodCardClick}
                isSelected={selectedMethod === method.toLowerCase()}
              />
            </Grid>
          ))}
        </Grid>
      )}
      <Box id="access-tour2" sx={{ mt: 3, mb: 3 }}>
        <RequestChart 
          selectedMethod={selectedMethod}
          onMethodChange={handleChartMethodChange}
        />
      </Box>

      <Grid id="access-tour3" container spacing={2} sx={{ mt: 1.5 }} alignItems="stretch">
        <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
          <AccessCard
            title="Нийт нэвтэрсэн"
            subtitle="Хэрэглэгчдийн тоо"
            value={chart?.total || 0}
            icon={<Iconify icon="solar:login-3-bold-duotone" width={32} />}
            gradient={['#0BA5EC', '#2563EB']}
            sx={{ height: '100%', width: '100%' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
          <AccessCard
            title="Нэвтэрсэн хэрэглэгч"
            subtitle="Өнөөдрийн байдлаар"
            value={chart?.today || 0}
            icon={<Iconify icon="solar:users-group-rounded-bold-duotone" width={32} />}
            gradient={['#10B981', '#059669']}
            sx={{ height: '100%', width: '100%' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
          <AccessCard
            title="Энэ сар нэвтэрсэн"
            subtitle="Хэрэглэгчдийн тоо"
            value={chart?.this_month || 0}
            icon={<Iconify icon="fluent:calendar-month-16-regular" width={32} />}
            gradient={['#bcf916ff', '#99970fff']}
            sx={{ height: '100%', width: '100%' }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex' }}>
          <AccessCard
            title="Энэ жил нэвтэрсэн"
            subtitle="Хэрэглэгчдийн тоо"
            value={chart?.this_year || 0}
            icon={<Iconify icon="iwwa:year" width={32} />}
            gradient={['#dea1e4ff', '#c962e9ff']}
            sx={{ height: '100%', width: '100%' }}
          />
        </Grid>
      </Grid>

      <Card sx={{ mt: 3, position: 'relative' }}>
        {renderTableToolbar}

        {isLoading && (
          <Box sx={{ width: '100%', position: 'absolute', zIndex: 1 }}>
            <LinearProgress />
          </Box>
        )}

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} id="access-tour4" sx={{ minWidth: 1200 }}>
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {requestsLoading && renderTableRowsSkeleton}

                {!requestsLoading && requests?.length > 0 && renderTableRows}

                {!isLoading && renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={requestsCount}
          page={table.page}
          onPageChange={table.onChangePage}
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          dense={table.dense}
          onChangeDense={table.onChangeDense}
          disabled={isLoading}
        />
      </Card>

      <RequestDetailsDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        request={selectedRequest}
      />
    </Container>
  )
}

export default AccessHistoryView