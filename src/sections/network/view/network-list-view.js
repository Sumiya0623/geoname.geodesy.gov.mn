"use client";

import { isEqual } from "lodash";
import { useMemo, useState, useCallback } from "react";

import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";

import { paths } from "src/routes/paths";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import { useTable, TablePaginationCustom } from "src/components/table";
import { useGetConstants } from "src/api/constant";
import { Collapse } from "@mui/material";
import { useBoolean } from "src/hooks/use-boolean";
import { Box } from "@mui/system";
import NetWorkNewEditForm from "src/sections/network/network-new-edit-form";
import LazyTreeView from "../LazyTreeView";
import NetWorkTableToolbar from "../network-table-toolbar";

const defaultFilters = {
  name: "",
  parent: "",
};

export default function NetWorkListView() {
  const form = useBoolean();
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "geonetwork" });

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
      key: "GEODETIC_NETWORK",
      ...filters,
    }),
    [filters, table.order, table.orderBy, table.page, table.rowsPerPage],
  );

  const {
    constants,
    constantsEmpty,
    constantsMutation,
    constantsLoading,
    constantsCount,
  } = useGetConstants(requestBody);
  const [editingRoot, setEditingRoot] = useState(null);
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
          endpoints.network.delete(id),
        );
        if (response?.status === 204) {
          constantsMutation();
          enqueueSnackbar(`Ангилал амжилттай устгагдлаа`);
        }
      } catch (error) {
        enqueueSnackbar(error?.message || "Ангилалыг устгах үед алдаа гарлаа", {
          variant: error?.message ? "warning" : "error",
        });
      }
    },
    [constantsMutation, enqueueSnackbar],
  );

  const renderTableToolbar = (
    <NetWorkTableToolbar
      filters={filters}
      onFilters={handleFilters}
      canReset={canReset}
      onReset={handleResetFilters}
    />
  );

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Cүлжээний ангилал"
        links={[
          {
            name: "Cүлжээ",
            href: paths.dashboard.activity,
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
              id="network-create"
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
              нэмэх
            </Button>
          )
        }
      />
      <Collapse in={form.value} timeout="auto" unmountOnExit>
        <Box sx={{ mb: { xs: 3, md: 5 } }}>
          <NetWorkNewEditForm
            currentConstant={editingRoot}
            constants={constants}
            onCloseForm={() => {
              setEditingRoot(null);
              form.onFalse();
            }}
            refetch={() => {
              setEditingRoot(null);
              constantsMutation();
            }}
          />
        </Box>
      </Collapse>
      <Card sx={{ px: 2 }}>
        {renderTableToolbar}
        <Box id="network-table">
          {!constantsLoading && constants?.length > 0 && (
            <LazyTreeView
              constants={constants}
              onEditRoot={(root) => {
                setEditingRoot(root);
                if (!form.value) form.onTrue();
              }}
              handleDeleteRow={handleDeleteRow}
              rootMutation={constantsMutation}
              menuPermissions={menuPermissions}
            />
          )}
        </Box>

        <TablePaginationCustom
          count={constantsCount}
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
