"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { paths } from "src/routes/paths";

import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import axiosInstance, { endpoints } from "src/utils/axios";

import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import LogTableRow from "../log-table-row";
import LogTableToolbar from "../log-table-toolbar";
import { useGetLogs } from "src/api/nl-log";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "conversation_id", label: "Дугаар" },
  { id: "user_query_raw", label: "Хайлт" },
  { id: "predicted_intent", label: "Ангилал" },
  { id: "predicted_slots", label: "Slots" },
  { id: "ts", label: "Огноо" },
  { id: "thumb", label: "Үнэлгээ" },
  { id: "bot_response_text", label: "Resp" },
  { id: "gold_intent", label: "Gold Intent" },
  { id: "gold_spots", label: "Gold Slots" },
  { id: "" },
];

const defaultFilters = {
  name: "",
};

export default function LogListView() {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "nl" });
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "name",
    defaultRowsPerPage: 10,
  });
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const { logs, logsEmpty, logsMutation, logsLoading, logsCount } =
    useGetLogs(requestBody);
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
        const response = await axiosInstance.delete(
          endpoints.point.nl.delete(id),
        );
        if (response?.status === 204) {
          logsMutation();
          enqueueSnackbar(`Лог амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Лог устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [logsMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <LogTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableRows = logs?.map((row, index) => (
    <LogTableRow
      key={row.id}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      row={row}
      onDeleteRow={() => handleDeleteRow(row.id)}
      menuPermissions={menuPermissions}
      refetch={logsMutation}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={logsEmpty} />;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Хандалтын жагсаалт"
        links={[
          {
            name: "Хандалт",
            href: paths.dashboard.nl.root,
          },
          {
            name: "Жагсаалт",
          },
        ]}
        action={
          menuPermissions?.create && (
            <Button
              variant="contained"
              id="nl-create"
              onClick={async () => {
                try {
                  const resp = await axiosInstance.post(
                    "/api/point/chatlog/train/",
                  );
                  if (resp.data.ok) {
                    enqueueSnackbar(
                      `Сургалт амжилттай (${resp.data.count} мөр)`,
                      { variant: "success" },
                    );
                  } else {
                    enqueueSnackbar("Сургалт бүтсэнгүй", {
                      variant: "warning",
                    });
                  }
                } catch (e) {
                  enqueueSnackbar("Сургалт эхлүүлэхэд алдаа гарлаа", {
                    variant: "error",
                  });
                }
              }}
            >
              Сургалт эхлүүлэх
            </Button>
          )
        }
      />

      <Card>
        {renderTableToolbar}
        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
              id="nl-table"
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {logsLoading && renderTableRowsSkeleton}
                {!logsLoading && logs?.length > 0 && renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={logsCount}
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
