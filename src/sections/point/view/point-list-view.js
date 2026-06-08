"use client";

import isEqual from "lodash/isEqual";
import { useState, useCallback, useMemo } from "react";

import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";

import { useBoolean } from "src/hooks/use-boolean";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

import { ConfirmDialog } from "src/components/custom-dialog";
import { useSettingsContext } from "src/components/settings";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import PointTableToolbar from "../point-table-toolbar";
import PointTableStatusBar from "../point-table-status";

import { useGetPoints } from "src/api/point";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";
import PointTableRow from "../point-table-row";
import { Table, TableBody, TableContainer } from "@mui/material";
import Scrollbar from "src/components/scrollbar";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "point__name", label: "Нэр" },
  { id: "measurements__measured_date", label: "Байгуулсан" },
  { id: "count", label: "Сүлжээний утга" },
  { id: "status", label: "Байршил" },
  { id: "nomek100", label: "Нэрлэвэр" },
  { id: "" },
];

const defaultFilters = {
  parent: "",
  status_in: [],
  measurement_class_in: [],
};
export default function PointListView({ user }) {
  const menuPermissions = useMenuPermissions({ content: "point" });
  const { enqueueSnackbar } = useSnackbar();
  const settings = useSettingsContext();
  const confirmRows = useBoolean();

  const table = useTable({
    defaultOrderBy: "id",
    defaultDense: true,
    defaultRowsPerPage: 10,
  });

  const { constants: STATUS_OPTIONS } =
    useGetConstantsFordropdown("POINTSTATUS");

  const [filters, setFilters] = useState(defaultFilters);
  const [networkTab, setNetworkTab] = useState("");

  const baseBody = useMemo(() => ({ ...filters }), [filters]);

  const networkTabBody = useMemo(
    () => (networkTab ? { measurement_network_in: [networkTab] } : {}),
    [networkTab]
  );

  const requestBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...baseBody,
      ...networkTabBody,
    }),
    [
      baseBody,
      networkTabBody,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
    ]
  );

  const handleNetworkTabChange = useCallback(
    (v) => {
      table.onResetPage();
      setNetworkTab(v);
    },
    [table]
  );

  const {
    points,
    pointsLoading,
    pointsError,
    pointsEmpty,
    pointsCount,
    pointsMutation,
  } = useGetPoints(requestBody);

  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const canReset = !isEqual(defaultFilters, filters);
  const handleFilters = useCallback((name, value) => {
    setFilters((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  }, []);

  const handleSelectRow = useCallback((id) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAllRows = useCallback(
    (checked) => {
      setSelectedRowIds(checked ? (points || []).map((p) => p.id) : []);
    },
    [points]
  );

  const handleResetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(endpoints.point.delete(id));
        if (response?.status === 204) {
          pointsMutation();
          enqueueSnackbar(`Цэг тэмдэгтийг амжилттай устгалаа`);
        }
      } catch (error) {
        enqueueSnackbar(
          error?.message || "Цэг тэмдэгтийг устгах үед алдаа гарлаа",
          {
            variant: error?.message ? "warning" : "error",
          }
        );
      }
    },
    [pointsMutation, enqueueSnackbar]
  );

  const handleDeleteRows = useCallback(async () => {
    if (!selectedRowIds?.length) return;
    try {
      await axiosInstance.delete(endpoints.point.bulkDelete, {
        data: { ids: selectedRowIds },
      });
      enqueueSnackbar("Сонгосон мөрүүд устлаа", { variant: "success" });
      await pointsMutation();
      setSelectedRowIds([]);
    } catch (error) {
      enqueueSnackbar(error?.message || "Олон мөр устгах үед алдаа гарлаа", {
        variant: error?.message ? "warning" : "error",
      });
    }
  }, [selectedRowIds, pointsMutation, enqueueSnackbar]);

  const renderTableToolbar = (
    <>
      <PointTableToolbar
        filters={filters}
        onFilters={handleFilters}
        statusOptions={STATUS_OPTIONS}
        canReset={canReset}
        onReset={handleResetFilters}
      />
      <Stack
        spacing={1}
        flexGrow={1}
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
      >
        {!!selectedRowIds.length && (
          <Button
            size="small"
            color="error"
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
            onClick={confirmRows.onTrue}
          >
            Устгах ({selectedRowIds.length})
          </Button>
        )}
      </Stack>
    </>
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const handleAddToCartRow = async (measurementItem) => {
    try {
      const measurementId =
        typeof measurementItem === "object"
          ? measurementItem.id
          : measurementItem;

      const response = await axiosInstance.post(endpoints.order.add, {
        point_id: measurementId,
      });
      if (response?.status === 200 || response?.status === 201) {
        enqueueSnackbar(`Сагсанд амжилттай нэмэгдлээ`);
      }
    } catch (error) {
      enqueueSnackbar(error?.message || "Сагсанд нэмэх үед алдаа гарлаа", {
        variant: error?.message ? "warning" : "error",
      });
    }
  };

  const renderTableRows = points?.map((row, index) => (
    <PointTableRow
      key={row.id}
      currentPoint={row}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      menuPermissions={menuPermissions}
      refetch={pointsMutation}
      onDeleteRow={() => handleDeleteRow(row.id)}
      handleAddToCartRow={handleAddToCartRow}
      selected={selectedRowIds.includes(row.id)}
      onSelectRow={() => handleSelectRow(row.id)}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={pointsEmpty} />;

  const content = (
    <Card>
      <PointTableStatusBar
        value={networkTab}
        onChange={handleNetworkTabChange}
        baseBody={baseBody}
      />
      {renderTableToolbar}
      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table
            size={table.dense ? "small" : "medium"}
            sx={{ minWidth: 800 }}
            id="service-table"
          >
            <TableHeadCustom
              headLabel={TABLE_HEAD}
              order={table.order}
              onSort={table.onSort}
              orderBy={table.orderBy}
              rowCount={points?.length || 0}
              numSelected={selectedRowIds.length}
              onSelectAllRows={handleSelectAllRows}
            />

            <TableBody>
              {pointsLoading && renderTableRowsSkeleton}

              {!pointsLoading && points?.length > 0 && renderTableRows}

              {renderTableEmpty}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <TablePaginationCustom
        count={pointsCount}
        page={table.page}
        onPageChange={table.onChangePage}
        rowsPerPage={table.rowsPerPage}
        onRowsPerPageChange={table.onChangeRowsPerPage}
        dense={table.dense}
        onChangeDense={table.onChangeDense}
      />
    </Card>
  );

  const containerNeeded = !user;

  return (
    <>
      {containerNeeded ? (
        <Container
          maxWidth={settings.themeStretch ? false : "xxl"}
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <CustomBreadcrumbs
            heading="Цэг тэмдэгтийн жагсаалт"
            links={[
              {
                name: "Цэг тэмдэгт",
                href: paths.dashboard.point.root,
              },
              { name: "Жагсаалт" },
            ]}
          />
          {content}
        </Container>
      ) : (
        content
      )}

      <ConfirmDialog
        open={confirmRows.value}
        onClose={confirmRows.onFalse}
        title="Анхааруулга"
        content={
          <>
            Та сонгосон
            <strong> {selectedRowIds.length} </strong> цэгийг устгахдаа итгэлтэй
            байна уу?.
          </>
        }
        action={
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={() => {
              handleDeleteRows();
              confirmRows.onFalse();
            }}
          >
            Устгах
          </Button>
        }
      />
    </>
  );
}
