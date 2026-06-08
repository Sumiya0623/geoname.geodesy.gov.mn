'use client';

import { isEqual } from 'lodash';
import { useMemo, useState, useCallback } from 'react';
import { Card, Container, Table, TableBody, TableContainer } from '@mui/material';

import { useSnackbar } from 'src/components/snackbar';
import axiosInstance, { endpoints } from 'src/utils/axios';

import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';
import Scrollbar from 'src/components/scrollbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { useGetMailLogs, useGetMailLogStatus } from 'src/api/mail-log';
import NotificationTableRow from '../notification-table-row';
import NotificationTableToolbar from '../notification-table-toolbar';
import NotificationTableStatusBar from '../notification-table-status';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: '', label: 'Nº', width: 10 },
  { id: 'category', label: 'Ангилал' },
  { id: 'to_email', label: 'Хүлээн авагч' },
  { id: 'subject', label: 'Гарчиг' },
  { id: 'status', label: 'Төлөв' },
  { id: 'created_at', label: 'Огноо' },
  { id: '', label: '', width: 100 },
];

const defaultFilters = {};

// ----------------------------------------------------------------------

export default function NotificationListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: 'desc',
    defaultOrderBy: 'created_at',
    defaultRowsPerPage: 10,
  });

  const [filters, setFilters] = useState(defaultFilters);

  const handleFilters = useCallback(
    (key, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [table]
  );

  const handleResetFilters = () => setFilters(defaultFilters);

  const requestBody = useMemo(() => {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    return {
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === 'desc' ? '-' : ''}${table.orderBy}`,
      ...cleaned,
    };
  }, [filters, table.order, table.orderBy, table.page, table.rowsPerPage]);

  const { mailLogs, mailLogsEmpty, mailLogsCount, mailLogsLoading, mailLogsMutation } =
    useGetMailLogs(requestBody);
  const { statuses = [], statusesMutation } = useGetMailLogStatus();

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(endpoints.maillog.delete(id));
        if (response?.status === 204) {
          enqueueSnackbar('Мэдэгдлийг амжилттай устгалаа');
          mailLogsMutation();
          statusesMutation();
        }
      } catch (error) {
        enqueueSnackbar(
          error?.response?.data?.detail || error?.message || 'Устгах үед алдаа гарлаа',
          { variant: 'error' }
        );
      }
    },
    [mailLogsMutation, statusesMutation, enqueueSnackbar]
  );

  const renderTableRows = mailLogs?.map((row, index) => (
    <NotificationTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      onDeleteRow={() => handleDeleteRow(row.id)}
    />
  ));

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Мэдэгдэл"
        links={[{ name: 'Мэдэгдэл' }, { name: 'Илгээсэн имэйл' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <NotificationTableStatusBar filters={filters} onFilters={handleFilters} STATUSES={statuses} />
        <NotificationTableToolbar
          filters={filters}
          onFilters={handleFilters}
          onReset={handleResetFilters}
          canReset={!isEqual(defaultFilters, filters)}
        />

        <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
          <Scrollbar>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 900 }}>
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {mailLogsLoading ? (
                  Array.from({ length: table.rowsPerPage }).map((_, i) => (
                    <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                  ))
                ) : mailLogs?.length > 0 ? (
                  renderTableRows
                ) : (
                  <TableNoData notFound={mailLogsEmpty} />
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={mailLogsCount}
          page={table.page}
          onPageChange={table.onChangePage}
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>
    </Container>
  );
}
