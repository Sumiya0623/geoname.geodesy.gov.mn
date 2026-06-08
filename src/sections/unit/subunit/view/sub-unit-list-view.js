"use client";

import { useMemo, useState, useCallback } from "react";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import Button from "@mui/material/Button";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import { paths } from "src/routes/paths";
import { useRouter, usePathname } from "src/routes/hooks";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import SubUnitTableRow from "../sub-unit-table-row";

import PropTypes from "prop-types";
import { Box, Collapse } from "@mui/material";
import SubUnitNewEditForm from "../sub-unit-new-edit-form";
import { useBoolean } from "src/hooks/use-boolean";
import { useGetUnits, useGetUnitsFordropdown } from "src/api/unit";
import { Stack } from "react-bootstrap";

// ----------------------------------------------------------------------
const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "name", label: "Нэгж" },
  { id: "code", label: "Харъяа" },
  { id: "" },
];
const defaultFilters = {
  name: "",
};
export default function SubUnitListView({ currentUnit }) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions(pathname, requiredActions);
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
      parent_unit: currentUnit?.id,
      ...filters,
    }),
    [
      filters,
      table.order,
      table.orderBy,
      table.page,
      table.rowsPerPage,
      currentUnit,
    ]
  );
  const { units, unitsEmpty, unitsMutation, unitsLoading, unitsCount } =
    useGetUnits(requestBody);

  const query = currentUnit?.id
    ? { parent_unit: currentUnit.id }
    : { parent_unit: "" };
  const { units: childunits } = useGetUnitsFordropdown(query);

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const response = await axiosInstance.delete(endpoints.unit.delete(id));
        if (response?.status === 204) {
          unitsMutation();
          enqueueSnackbar(`Ангилалыг амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Ангилалыг устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [unitsMutation, enqueueSnackbar]
  );
  const handleEditRow = useCallback(
    (id) => {
      router.push(paths.dashboard.level.edit(id));
    },
    [router]
  );
  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />
  );

  const renderTableRows = units?.map((row, index) => (
    <SubUnitTableRow
      key={row.id}
      rowQueue={{ rowsPerPage: table.rowsPerPage, page: table.page, index }}
      row={row}
      childunits={childunits}
      refetch={unitsMutation}
      onEditRow={() => handleEditRow(row.id)}
      onDeleteRow={() => handleDeleteRow(row.id)}
      tableHeadLength={TABLE_HEAD.length}
      menuPermissions={menuPermissions}
    />
  ));

  const renderTableEmpty = <TableNoData notFound={unitsEmpty} />;
  return (
    <>
      <Card sx={{ mb: { xs: 3, md: 5 } }}>
        <Stack direction="row" justifyContent="flex-end">
          <Button
            size="small"
            color="primary"
            variant="contained"
            onClick={form.onToggle}
            sx={{ m: 1 }}
          >
            +
          </Button>
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ mb: { xs: 3, md: 5 } }}>
              <SubUnitNewEditForm
                childunits={childunits}
                onCloseForm={form.onFalse}
                refetch={unitsMutation}
                currentUnitId={currentUnit?.id}
              />
            </Box>
          </Collapse>
        </Stack>
        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
            >
              <TableHeadCustom
                headLabel={TABLE_HEAD}
                order={table.order}
                sx={{
                  backgroundColor: "primary.lighter", // эсвэл theme.palette.primary.lighter
                  "& th": {
                    color: "primary.main",
                    fontWeight: "bold",
                    fontSize: "0.875rem",
                    borderBottom: "1px solid #ccc",
                  },
                }}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />

              <TableBody>
                {unitsLoading && renderTableRowsSkeleton}
                {!unitsLoading && units?.length > 0 && renderTableRows}
                {renderTableEmpty}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={unitsCount}
          page={table.page}
          onPageChange={table.onChangePage}
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>
    </>
  );
}

SubUnitListView.propTypes = {
  currentUnit: PropTypes.object.isRequired,
  units: PropTypes.array,
  currentUnitId: PropTypes.number,
};
