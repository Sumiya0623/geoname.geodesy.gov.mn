"use client";

import { isEqual } from "lodash";
import { useState, useMemo, useCallback } from "react";

import {
  Box,
  Card,
  Grid,
  Table,
  Stack,
  Collapse,
  Container,
  Typography,
  TableBody,
  CardActionArea,
  CircularProgress,
  TableContainer,
} from "@mui/material";
import { Icon } from "@iconify/react";

import { paths } from "src/routes/paths";
import { useBoolean } from "src/hooks/use-boolean";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetGeonames, useGetGeonameTypes } from "src/api/geoname";

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

import GeonameTableRow from "../geoname-table-row";
import GeonameTableToolbar from "../geoname-table-toolbar";
import GeonameNewEditForm from "../geoname-new-edit-form";
import GeonameAdvancedSearch from "../geoname-advanced-search";

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Нэр" },
  { id: "number", label: "Дугаар", width: 140 },
  { id: "", label: "Төрөл", width: 180 },
  { id: "", label: "Төлөв", width: 120 },
  { id: "", label: "Батлагдсан", width: 120, align: "center" },
  { id: "created_date", label: "Огноо", width: 130 },
  { id: "", width: 48 },
];

const defaultFilters = {
  search: "",
  category: null,
  // дэлгэрэнгүй хайлт
  name: "",
  number: "",
  aimag: null,
  sum: null,
  lat: "",
  lon: "",
  nomek: "",
};

// Дэлгэрэнгүй шүүлтийн талбарууд (badge/идэвх шалгахад)
const ADVANCED_KEYS = ["name", "number", "aimag", "sum", "lat", "lon", "nomek"];

// ----------------------------------------------------------------------

export default function GeonameListView() {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "geoname" });
  const form = useBoolean();
  const advanced = useBoolean();

  const table = useTable({
    defaultDense: true,
    defaultOrderBy: "created_date",
    defaultOrder: "desc",
    defaultRowsPerPage: 10,
  });

  const [selectedId, setSelectedId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);

  const { types, typesLoading, typesMutation } = useGetGeonameTypes();

  // "" = Нийт (бүгд), number = тодорхой төрөл, null = сонгоогүй
  const isAll = selectedId === "";
  // Хүснэгтийн type шүүлт = ангилал cascade сонголт (эс бөгөөс карт)
  const typeFilter = filters.category || selectedId;

  const unitTree = filters.sum?.id || filters.aimag?.id || null;

  const requestBody = useMemo(
    () =>
      selectedId !== null
        ? {
            page: table.page + 1,
            page_size: table.rowsPerPage,
            ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
            ...(isAll ? {} : { type: typeFilter }),
            ...(filters.search ? { search: filters.search } : {}),
            // дэлгэрэнгүй хайлт
            ...(filters.name ? { name: filters.name } : {}),
            ...(filters.number ? { number: filters.number } : {}),
            ...(filters.nomek ? { nomek: filters.nomek } : {}),
            ...(filters.lat && filters.lon
              ? { lat: filters.lat, lon: filters.lon }
              : {}),
            ...(unitTree ? { unit_tree: unitTree } : {}),
          }
        : null,
    [
      selectedId,
      isAll,
      typeFilter,
      table.page,
      table.rowsPerPage,
      table.order,
      table.orderBy,
      filters.search,
      filters.name,
      filters.number,
      filters.nomek,
      filters.lat,
      filters.lon,
      unitTree,
    ]
  );

  const {
    geonames,
    geonamesEmpty,
    geonamesCount,
    geonamesLoading,
    geonamesMutation,
  } = useGetGeonames(requestBody);

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedId) || null,
    [types, selectedId]
  );

  const refetchAll = useCallback(() => {
    geonamesMutation();
    typesMutation();
  }, [geonamesMutation, typesMutation]);

  const handleSelect = useCallback(
    (id) => {
      setSelectedId((prev) => (prev === id ? null : id));
      setFilters(defaultFilters);
      table.onResetPage();
    },
    [table]
  );

  const handleFilters = useCallback(
    (name, value) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, [name]: value }));
    },
    [table]
  );

  const canReset = !isEqual(defaultFilters, filters);

  const advancedActive = useMemo(
    () => ADVANCED_KEYS.some((k) => !isEqual(defaultFilters[k], filters[k])),
    [filters]
  );

  const handleApplyAdvanced = useCallback(
    (adv) => {
      table.onResetPage();
      setFilters((prev) => ({ ...prev, ...adv }));
    },
    [table]
  );

  const handleDeleteRow = useCallback(
    async (id) => {
      try {
        const res = await axiosInstance.delete(endpoints.geoname.delete(id));
        if (res?.status === 204) {
          enqueueSnackbar("Амжилттай устгагдлаа");
          refetchAll();
        }
      } catch (error) {
        enqueueSnackbar(error?.response?.data?.detail || "Устгах үед алдаа гарлаа", {
          variant: "warning",
        });
      }
    },
    [enqueueSnackbar, refetchAll]
  );

  const openCreate = () => {
    setEditItem(null);
    form.onTrue();
  };
  const openEdit = (item) => {
    setEditItem(item);
    form.onTrue();
  };

  const notFound = geonamesEmpty && !geonamesLoading;

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Газар зүйн нэр"
        links={[
          { name: "Дашбоард", href: paths.dashboard.root },
          { name: "Газар зүйн нэр" },
        ]}
        sx={{ mb: 3 }}
      />

      {/* Төрлийн картууд */}
      {typesLoading ? (
        <Box sx={{ py: 5, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {types.map((t) => {
            const active = t.id === selectedId;
            return (
              <Grid key={t.id || "all"} item xs={12} sm={6} md={4} lg={3}>
                <Card
                  sx={{
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <CardActionArea onClick={() => handleSelect(t.id)} sx={{ p: 2.5 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          minWidth: 48,
                          borderRadius: 1.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "common.white",
                          bgcolor: t.color || "primary.main",
                        }}
                      >
                        <Icon icon="solar:map-point-bold" width={26} />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="subtitle1" noWrap>
                          {t.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t.geoname_count} нэр
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Хүснэгт */}
      {selectedType && (
        <Card>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2.5, pt: 2 }}>
            <Icon icon="solar:folder-with-files-bold" width={22} />
            <Typography variant="h6">{selectedType.name}</Typography>
          </Stack>

          <GeonameTableToolbar
            filters={filters}
            onFilters={handleFilters}
            canReset={canReset}
            onReset={() => setFilters(defaultFilters)}
            canCreate={!isAll && menuPermissions?.create}
            onCreate={openCreate}
            rootTypeId={selectedId}
            onAdvanced={advanced.onTrue}
            advancedActive={advancedActive}
          />

          {/* Нэмэх / засах форм — toolbar доор */}
          <Collapse in={form.value} timeout="auto" unmountOnExit>
            <Box sx={{ px: 2.5, pb: 2 }}>
              <GeonameNewEditForm
                currentItem={editItem}
                defaultTypeId={typeFilter}
                onClose={form.onFalse}
                refetch={refetchAll}
              />
            </Box>
          </Collapse>

          <TableContainer sx={{ position: "relative", overflow: "unset" }}>
            <Scrollbar>
              <Table size={table.dense ? "small" : "medium"} sx={{ minWidth: 800 }}>
                <TableHeadCustom
                  headLabel={TABLE_HEAD}
                  order={table.order}
                  orderBy={table.orderBy}
                  onSort={table.onSort}
                />
                <TableBody>
                  {geonamesLoading
                    ? Array.from({ length: table.rowsPerPage }).map((_, i) => (
                        <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                      ))
                    : geonames.map((row, index) => (
                        <GeonameTableRow
                          key={row.id}
                          row={row}
                          index={index}
                          page={table.page}
                          rowsPerPage={table.rowsPerPage}
                          menuPermissions={menuPermissions}
                          onEdit={() => openEdit(row)}
                          onDeleteRow={() => handleDeleteRow(row.id)}
                        />
                      ))}
                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={geonamesCount}
            page={table.page}
            onPageChange={table.onChangePage}
            rowsPerPage={table.rowsPerPage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      )}

      <GeonameAdvancedSearch
        open={advanced.value}
        onClose={advanced.onFalse}
        value={filters}
        onApply={handleApplyAdvanced}
      />
    </Container>
  );
}
