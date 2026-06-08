"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import { Box, Collapse } from "@mui/material";
import Container from "@mui/material/Container";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

import { paths } from "src/routes/paths";
import { useBoolean } from "src/hooks/use-boolean";
import { useSettingsContext } from "src/components/settings";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";

import axiosInstance, { endpoints } from "src/utils/axios";

import { useGetConstantsForStatus, useGetNumbers } from "src/api/constant";

import Iconify from "src/components/iconify";
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

import NumberTableRow from "../number-table-row";
import NumberNewEditForm from "../number-new-edit-form";
import NumberTableToolbar from "../number-table-toolbar";
import { useGetNetWorksForDropDown } from "src/api/measurement";
import { useGetUnitsFordropdown } from "src/api/unit";
import NumberTableStatusBar from "../number-table-status";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Дугаар" },
  { id: "network", label: "Сүлжээ" },
  { id: "unit", label: "Харъяа" },
  { id: "is_user", label: "Байгуулсан" },
  { id: "user", label: "Үүсгэсэн" },
  { id: "" },
];

const defaultFilters = {
  parent: "",
};

export default function NumberListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "key",
    defaultRowsPerPage: 10,
  });

  const menuPermissions = useMenuPermissions({ content: "number" });
  const form = useBoolean();
  const [filters, setFilters] = useState(defaultFilters);
  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage]
  );
  const {
    numbers,
    numbersEmpty,
    numbersMutation,
    numbersLoading,
    numbersCount,
  } = useGetNumbers(requestBody);

  const { networks } = useGetNetWorksForDropDown({ pagination: false });
  const { units } = useGetUnitsFordropdown({ pagination: false });
  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prevState) => ({
        ...prevState,
        [name]: value,
      }));
    },
    [table]
  );
  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);
  const canReset = !isEqual(defaultFilters, filters);
  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(
          endpoints.number.delete(id)
        );
        if (response?.status === 204) {
          numbersMutation();
          enqueueSnackbar(`Дугаарлалт амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(
          error?.message || "Дугаарлалтыг устгах үед алдаа гарлаа",
          {
            variant: error?.message ? "warning" : "error",
          }
        );
      }
    },
    [numbersMutation, enqueueSnackbar]
  );

  const { constants: OWNER_TYPES = [] } = useGetConstantsForStatus(
    "GEODETIC_NETWORK_NUMBER"
  );
  const renderTableStatus = (
    <NumberTableStatusBar
      filters={filters}
      onFilters={handleFilters}
      STATUSES={OWNER_TYPES}
    />
  );

  const renderTableToolbar = (
    <NumberTableToolbar
      filters={filters}
      units={units}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = numbers?.map((row, index) => (
    <NumberTableRow
      key={row.id}
      units={units}
      networks={networks}
      row={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={numbersMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
    />
  ));
  const renderTableEmpty = <TableNoData notFound={numbersEmpty} />;
  return (
    <Container maxWidth={settings.themeStretch ? false : "xxl"}>
      <CustomBreadcrumbs
        heading="Дугаарлалтын жагсаалт"
        links={[
          {
            name: "Дугаарлалт",
            href: paths.dashboard.constant.root,
          },
          {
            name: "Жагсаалт",
          },
        ]}
        action={
          menuPermissions?.create && (
            <Button
              color="primary"
              variant="contained"
              onClick={form.onToggle}
              endIcon={
                <Iconify
                  icon="mingcute:down-line"
                  sx={{
                    transition: (theme) => theme.transitions.create("all"),
                    ...(form.value && {
                      transform: "rotate(-180deg)",
                    }),
                  }}
                />
              }
            >
              Дугаар авах
            </Button>
          )
        }
        sx={{ mb: { xs: 3, md: 1 } }}
      />

      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: { xs: 3, md: 1 } }}>
          <NumberNewEditForm
            networks={networks}
            units={units}
            onCloseForm={form.onFalse}
            refetch={numbersMutation}
          />
        </Box>
      </Collapse>

      <Card>
        {renderTableStatus}
        {renderTableToolbar}
        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {numbersLoading && renderTableRowsSkeleton}
                {!numbersLoading && numbers?.length > 0 && renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
        <TablePaginationCustom
          count={numbersCount}
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
