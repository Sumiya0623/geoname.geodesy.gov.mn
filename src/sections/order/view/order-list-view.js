"use client";

import { isEqual } from "lodash";
import { useState, useCallback, useMemo } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { paths } from "src/routes/paths";

import { isAfter } from "src/utils/format-time";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableHeadCustom,
  TablePaginationCustom,
  TableSkeleton,
} from "src/components/table";

import OrderTableRow from "../order-table-row";
import OrderTableToolbar from "../order-table-toolbar";
import { useGetOrders } from "src/api/order";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "id", label: "№" },
  { id: "user", label: "Хэрэглэгч" },
  { id: "items", label: "Цэг" },
  { id: "subtotal", label: "Төлбөр" },
  { id: "status", label: "Төлөв" },
  { id: "created_date", label: "Үүсгэсэн" },
  { id: "" },
];

const defaultFilters = {
  status: "",
};

// ----------------------------------------------------------------------

export default function OrderListView({ user }) {
  const menuPermissions = useMenuPermissions({ content: "order" });
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultOrderBy: "id", defaultDense: true });
  const settings = useSettingsContext();
  const [filters, setFilters] = useState(defaultFilters);
  const dateError = isAfter(filters.startDate, filters.endDate);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );
  const { orders, ordersEmpty, ordersMutation, ordersLoading, ordersCount } =
    useGetOrders(requestBody);

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    },
    [table],
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const canReset = !isEqual(defaultFilters, filters);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(endpoints.order.delete(id));
        if (response?.status === 204) {
          ordersMutation();
          enqueueSnackbar(`Захиалгыг амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Захиалга устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [ordersMutation, enqueueSnackbar],
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = orders?.map((row, index) => (
    <OrderTableRow
      key={row.id}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      refetch={ordersMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
      menuPermissions={menuPermissions}
    />
  ));
  const renderTableEmpty = <TableNoData notFound={ordersEmpty} />;
  const content = (
    <Card>
      <OrderTableToolbar
        filters={filters}
        onFilters={handleFilters}
        dateError={dateError}
        onReset={handleResetFilters}
        canReset={canReset}
      />

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table
            size={table.dense ? "small" : "medium"}
            sx={{ minWidth: 800 }}
            id="order-table"
          >
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              onSort={table.onSort}
              orderBy={table.orderBy}
            />

            <TableBody>
              {ordersLoading && renderTableRowsSkeleton}
              {!ordersLoading && orders?.length > 0 && renderTableRows}
              {renderTableEmpty}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>
      <TablePaginationCustom
        count={ordersCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
    </Card>
  );

  // Хэрэв profile дотор (user дамжуулсан) ашиглаж байвал,
  // давхар Container ашиглахгүй шууд card-аа буцаана.
  if (user) {
    return content;
  }

  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Худалдан авалт"
        links={[
          {
            name: "Dashboard",
            href: paths.dashboard.root,
          },
          {
            name: "Худалдан авалт",
            href: paths.dashboard.order.root,
          },
          { name: "Жагсаалт" },
        ]}
      />

      {content}
    </Container>
  );
}
