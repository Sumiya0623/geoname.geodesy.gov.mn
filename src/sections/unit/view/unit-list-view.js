"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";
import { useRouter } from "src/routes/hooks";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import {
  useTable,
  TableNoData,
  TableSkeleton,
  TablePaginationCustom,
} from "src/components/table";

import UnitTableToolbar from "../unit-table-toolbar";

import { Collapse } from "@mui/material";
import { useBoolean } from "src/hooks/use-boolean";
import { Box } from "@mui/system";

import { useGetUnits } from "src/api/unit";
import UnitNewEditForm from "../unit-new-edit-form";
import LazyTreeView from "../LazyTreeView";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 10 },
  { id: "unit1", label: "Аймаг" },
  { id: "unit2", label: "Сум" },
  { id: "unit3", label: "Баг" },
  { id: "" },
];

const defaultFilters = {
  name: "",
};

export default function UnitListView() {
  const router = useRouter();
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "unit" });
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

  const { units, unitsEmpty, unitsMutation, unitsLoading, unitsCount } =
    useGetUnits(requestBody);
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
        const response = await axiosInstance.delete(endpoints.level.delete(id));
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
    [unitsMutation, enqueueSnackbar],
  );

  const handleEditRow = useCallback(
    (id) => {
      router.push(paths.dashboard.unit.edit(id));
    },
    [router],
  );

  const handleViewRow = useCallback(
    (id) => {
      router.push(paths.dashboard.unit.details(id));
    },
    [router],
  );

  const renderTableToolbar = (
    <UnitTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  const renderTableRowsSkeleton = Array.from({ length: table.rowsPerPage }).map(
    (_, index) => <TableSkeleton key={index} headLength={TABLE_HEAD.length} />,
  );

  const renderTableEmpty = <TableNoData notFound={unitsEmpty} />;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Засаг захиргааны нэгж"
        links={[
          {
            name: "Нэгж",
            href: paths.dashboard.name.root,
          },
          {
            name: "Жагсаалт",
          },
        ]}
        action={
          menuPermissions?.create && (
            <></>
            // <Button
            //   color="primary"
            //   variant="contained"
            //   onClick={form.onToggle}
            //   endIcon={
            //     <Iconify
            //       icon="mingcute:down-line"
            //       sx={{
            //         transition: (theme) => theme.transitions.create("all"),
            //         ...(form.value && {
            //           transform: "rotate(-180deg)",
            //         }),
            //       }}
            //     />
            //   }
            // >
            //   нэмэх
            // </Button>
          )
        }
      />
      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: { xs: 3, md: 5 } }}>
          <UnitNewEditForm
            units={units}
            onCloseForm={form.onFalse}
            refetch={unitsMutation}
          />
        </Box>
      </Collapse>
      <Card>
        {renderTableToolbar}

        <Box id="unit-table">
          {!unitsLoading && units?.length > 0 && (
            <LazyTreeView
              levels={units}
              onEditRoot={(root) => {
                setEditingRoot(root);
                if (!form.value) form.onTrue();
              }}
              handleDeleteRow={handleDeleteRow}
              rootMutation={unitsMutation}
            />
          )}
        </Box>

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
    </Container>
  );
}
