"use client";

import PropTypes from "prop-types";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Table,
  Stack,
  Button,
  Tooltip,
  Collapse,
  TextField,
  TableBody,
  Typography,
  TableContainer,
  InputAdornment,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useDebounce } from "src/hooks/use-debounce";
import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetLegalOrders } from "src/api/legal";
import { useGetChampaign } from "src/api/champaign";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";
import {
  TableNoData,
  TableSkeleton,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";

import LegalTableStatus from "src/sections/council/legal/legal-table-status";
import LegalNewEditForm from "src/sections/council/legal/legal-new-edit-form";

import AttachTableRow from "../attach-table-row";

// ----------------------------------------------------------------------
// БАРИМТ БИЧИГ — Суурин судалгаа табын доторх задардаг хэсэг.
// Тухайн ТӨСӨЛД холбогдсон эрх зүйн баримт бичгүүдийн (LegalOrder) НЭГ цэг:
//   • Төрлийн мөр     — төсөлд бүртгэгдсэн ангилал (chip) — шүүлт
//   • Нэмэх           — шинэ баримтыг төсөлд бүртгэнэ
//   • Сангаас холбох  — төслийн ЗЗ нэгжид харьяалагдах шийдвэрүүдийг бөөнөөр
//   • Мөр бүрт        — Нэр холбох / Засах / Төслөөс хасах
// (Өмнө нь «Бэлтгэл ажил» табд ижил жагсаалт байсныг давхардаж байсан тул
//  хасаж, бүх үйлдлийг энд нэгтгэв.)
// ----------------------------------------------------------------------

// LEGAL_LEVELS‑ийн эрэмбэ — Constant.code‑г БИЧСЭН ХЭВЭЭР нь (текстээр).
// «01, 02, 03…» гэж дугаарлавал яг тэр дараалалдаа орно; code хоосон бол
// сүүлд, тэнцвэл id‑ээр тогтвортой. Backend‑ийн эрэмбэтэй ИЖИЛ логик.
const byCode = (list) =>
  [...(list || [])].sort((a, b) => {
    const ca = String(a?.code ?? "").trim();
    const cb = String(b?.code ?? "").trim();
    if (!ca !== !cb) return ca ? -1 : 1; // хоосон code сүүлд
    return ca.localeCompare(cb) || (a?.id || 0) - (b?.id || 0);
  });

const TABLE_HEAD = [
  { id: "", label: "Nº", width: 48 },
  { id: "name", label: "Баримт бичиг" },
  { id: "type_name", label: "Төрөл", width: 140 },
  // Байгууллага — аймаг (1x) / сум (2x) түвшний шийдвэрт бөглөгдөнө
  { id: "org", label: "Байгууллага", width: 160 },
  { id: "order_number", label: "Дугаар", width: 110 },
  { id: "order_date", label: "Огноо", width: 120 },
  { id: "names_count", label: "Холбоотой нэр", width: 130, align: "center" },
  { id: "", label: "Файл", width: 70, align: "center" },
  { id: "", label: "Үйлдэл", width: 80, align: "right" },
];

export default function AttachListView({ projectId = "", onCount }) {
  const { enqueueSnackbar } = useSnackbar();
  const menuPermissions = useMenuPermissions({ content: "legal" });
  const addPanel = useBoolean();

  const [search, setSearch] = useState("");
  const dq = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [typeId, setTypeId] = useState(null); // түвшин (LEGAL_LEVELS) chip
  const [openId, setOpenId] = useState(null); // нэр холбох хэсэг задарсан мөр
  const [editId, setEditId] = useState(null); // засах форм задарсан мөр
  const [delRow, setDelRow] = useState(null); // хасах баталгаажуулалт

  const requestBody = useMemo(
    () => ({
      page: page + 1,
      page_size: pageSize,
      ordering: "-order_date",
      projects: projectId,
      ...(typeId ? { govlevel: typeId } : {}),
      ...(dq ? { search: dq } : {}),
    }),
    [page, pageSize, projectId, typeId, dq],
  );

  const {
    legalOrders,
    legalOrdersEmpty,
    legalOrdersCount,
    legalOrdersLoading,
    legalOrdersMutation,
  } = useGetLegalOrders(projectId ? requestBody : null);

  // Төслийн бүртгэгдсэн ангилал (registered_types) — chip‑ийн мөр.
  // «Сангаас холбох»/нэмэх/хасахын дараа тоо нь шинэчлэгдэнэ.
  const { champaign, champaignMutation } = useGetChampaign(projectId);
  const types = useMemo(
    () => byCode(champaign?.registered_types),
    [champaign?.registered_types],
  );
  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId) || null,
    [types, typeId],
  );
  // «Бүгд» таб — эхэнд (id="" → шүүлтгүй), тоо нь төрлүүдийн нийлбэр
  const statusTypes = useMemo(
    () => [
      {
        id: "",
        label: "Бүгд",
        order_count: types.reduce((a, t) => a + (t.order_count || 0), 0),
      },
      ...types,
    ],
    [types],
  );

  const refreshAll = useCallback(() => {
    legalOrdersMutation();
    champaignMutation?.();
  }, [legalOrdersMutation, champaignMutation]);

  // Нийт тоог эцэг карт (CollapseCard)‑ын толгойд харуулна
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(legalOrdersCount);
  }, [legalOrdersCount]);

  const handleToggle = useCallback((id) => {
    setEditId(null);
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const handleEdit = useCallback((id) => {
    setOpenId(null);
    setEditId((prev) => (prev === id ? null : id));
  }, []);

  // «Сангаас холбох» — төслийн хамрах ЗЗ нэгжид (аймаг сонгосон бол доод
  // шатны сум/баг хүртэл) харьяалагдах бүх шийдвэрийг нэг дор төсөлд холбоно.
  const [syncing, setSyncing] = useState(false);
  const handleSyncFromBank = useCallback(async () => {
    if (!projectId || syncing) return;
    setSyncing(true);
    try {
      const res = await axiosInstance.post(endpoints.legal.attachByUnits, {
        project: projectId,
      });
      const { added = 0, skipped = 0 } = res?.data || {};
      enqueueSnackbar(
        added
          ? `${added} шийдвэр сангаас холбогдлоо${skipped ? ` (${skipped} нь өмнө холбогдсон)` : ""}`
          : "Шинээр холбох шийдвэр олдсонгүй",
        { variant: added ? "success" : "info" },
      );
      refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Сангаас дуудахад алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setSyncing(false);
    }
  }, [projectId, syncing, enqueueSnackbar, refreshAll]);

  // Мөр хасах — тухайн ТӨСЛӨӨС салгана (баримт нь санд хэвээр үлдэнэ)
  const handleDetach = useCallback(async () => {
    const row = delRow;
    if (!row?.id) return;
    try {
      const res = await axiosInstance.post(
        endpoints.legal.detachProject(row.id),
        { project: projectId },
      );
      if (res?.status === 200) {
        enqueueSnackbar("Баримт бичгийг төслөөс хаслаа");
        if (openId === row.id) setOpenId(null);
        if (editId === row.id) setEditId(null);
        refreshAll();
      }
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Хасах үед алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setDelRow(null);
    }
  }, [delRow, projectId, openId, editId, enqueueSnackbar, refreshAll]);

  const notFound = legalOrdersEmpty && !legalOrdersLoading;

  if (!projectId) return null;

  return (
    <Box>
      {/* Төрлийн мөр (statusbar) — төсөлд бүртгэгдсэн ангилал + бичлэгийн тоо */}
      <LegalTableStatus
        types={statusTypes}
        value={typeId}
        onChange={(v) => {
          setPage(0);
          setTypeId(v);
        }}
      />

      {/* Toolbar — хайлт + Сангаас холбох + Нэмэх */}
      <Stack
        sx={{ px: 2.5, py: 2 }}
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1.5}
      >
        <TextField
          fullWidth
          value={search}
          onChange={(e) => {
            setPage(0);
            setSearch(e.target.value);
          }}
          placeholder="Баримт бичгийн нэр, дугаар, огноогоор хайх..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled" }}
                />
              </InputAdornment>
            ),
          }}
        />

        {!!menuPermissions?.create && (
          <Tooltip title="Сангаас холбох — төслийн хамрах засаг захиргаанд (аймаг сонгосон бол доод шатны сум, баг хүртэл) харьяалагдах бүх шийдвэрийг нэг дор төсөлд холбоно">
            <span>
              <Button
                variant="outlined"
                color="primary"
                disabled={syncing}
                startIcon={
                  <Iconify
                    icon="solar:refresh-circle-bold"
                    sx={
                      syncing
                        ? {
                            animation: "spin 1s linear infinite",
                            "@keyframes spin": {
                              from: { transform: "rotate(0deg)" },
                              to: { transform: "rotate(360deg)" },
                            },
                          }
                        : undefined
                    }
                  />
                }
                onClick={handleSyncFromBank}
                sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                Сангаас холбох
              </Button>
            </span>
          </Tooltip>
        )}

        {!!menuPermissions?.create && (
          <Button
            variant="contained"
            color={addPanel.value ? "inherit" : "primary"}
            startIcon={
              <Iconify icon={addPanel.value ? "eva:close-fill" : "mingcute:add-line"} />
            }
            onClick={addPanel.onToggle}
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {addPanel.value ? "Болих" : "Нэмэх"}
          </Button>
        )}
      </Stack>

      {/* Нэмэх форм — toolbar доор шууд задарна */}
      <Collapse in={addPanel.value} timeout="auto" unmountOnExit>
        <Box sx={{ mx: 2.5, mb: 2 }}>
          <LegalNewEditForm
            projectId={projectId}
            selectedLevel={selectedType}
            onClose={addPanel.onFalse}
            refetch={refreshAll}
          />
        </Box>
      </Collapse>

      <TableContainer sx={{ position: "relative", overflow: "unset" }}>
        <Scrollbar>
          <Table size="small" sx={{ minWidth: 1040 }}>
            <TableHeadCustom headLabel={TABLE_HEAD} />
            <TableBody>
              {legalOrdersLoading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <TableSkeleton key={i} headLength={TABLE_HEAD.length} />
                  ))
                : legalOrders.map((row, index) => (
                    <AttachTableRow
                      key={row.id}
                      row={row}
                      index={index}
                      page={page}
                      rowsPerPage={pageSize}
                      colSpan={TABLE_HEAD.length}
                      projectId={projectId}
                      menuPermissions={menuPermissions}
                      open={openId === row.id}
                      editing={editId === row.id}
                      onToggleAttach={() => handleToggle(row.id)}
                      onToggleEdit={() => handleEdit(row.id)}
                      onDetach={() => setDelRow(row)}
                      onChanged={refreshAll}
                    />
                  ))}

              <TableNoData notFound={notFound} />
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      {notFound && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2.5, pb: 2, display: "block" }}
        >
          Баримт бичиг алга — «Нэмэх» эсвэл «Сангаас холбох»‑оор төсөлд бүртгэнэ
          үү.
        </Typography>
      )}

      <TablePaginationCustom
        count={legalOrdersCount}
        page={page}
        rowsPerPage={pageSize}
        onPageChange={(e, v) => setPage(v)}
        onRowsPerPageChange={(e) => {
          setPage(0);
          setPageSize(parseInt(e.target.value, 10));
        }}
      />

      <ConfirmDialog
        open={!!delRow}
        onClose={() => setDelRow(null)}
        title="Төслөөс хасах"
        content={
          <>
            <strong>{delRow?.name}</strong> баримтыг энэ төслөөс хасах уу?
            Баримт нь <strong>санд хэвээр үлдэнэ</strong> — устахгүй.
          </>
        }
        action={
          <Button variant="contained" color="warning" onClick={handleDetach}>
            Хасах
          </Button>
        }
      />
    </Box>
  );
}

AttachListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onCount: PropTypes.func,
};
