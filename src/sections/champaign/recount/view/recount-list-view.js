"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Menu,
  Stack,
  Checkbox,
  MenuItem,
  Table,
  Button,
  Dialog,
  Divider,
  Tooltip,
  Collapse,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  Typography,
  Autocomplete,
  DialogTitle,
  FormControlLabel,
  DialogContent,
  DialogActions,
  TableContainer,
  CircularProgress,
} from "@mui/material";

import { useDebounce } from "src/hooks/use-debounce";
import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetRecounts } from "src/api/recount";
import { useGetChampaign } from "src/api/champaign";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { TableHeadCustom, TablePaginationCustom } from "src/components/table";

import RecountMap from "./recount-map";

import RecountTableRow from "../recount-table-row";
import RecountTableStatus from "../recount-table-status";
import RecountAdvancedSearch, { EMPTY_ADV } from "../recount-advanced-search";
import RecountTableToolbar from "../recount-table-toolbar";
import { statusColor } from "src/sections/map/recountStatus";

// ----------------------------------------------------------------------
// Суурин судалгаа — Дахин тооллого (ReCount). ЗЗ нэгж + ангилал сонгоход тухайн
// нэрсийг хуудаслалттай хүснэгтээр харуулна. Мөр бүрт 4 товч:
//  ижил → шууд хадгална (draft = нэр).
//  зөрүүтэй / алдаатай → бичих диалог → draft‑д хадгална.
//  байршил → газрын зураг дээр ойролцоо байршил зурж хадгална (удахгүй).
// Доор нь тухайн төслийн ReCount.loc‑ийг GeoServer WMS‑ээр харуулна.
// ----------------------------------------------------------------------

// ЗЗ нэгжийн dropdown (UNITLEVEL нэр + parent) — cascading
function useUnits(level, parentId, enabled = true) {
  const params = new URLSearchParams({ level });
  if (parentId) params.append("parent", parentId);
  const { data } = useSWR(
    enabled
      ? [endpoints.legal.units(params.toString()), axiosInstance, "get"]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return data?.results || [];
}

// Нэрийн ангилал (GEONAME_TYPES) — parent байвал дэд, эс бөгөөс үндсэн
function useTypes(parentId, enabled = true) {
  const params = new URLSearchParams();
  if (parentId) params.set("parent", parentId);
  else params.set("key", "GEONAME_TYPES");
  const { data } = useSWR(
    enabled
      ? [endpoints.nameclass.list(params.toString()), axiosInstance, "get"]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return data?.results || [];
}

export default function RecountListView({
  projectId = "",
  stepName = "Суурин судалгаа",
  onCount,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  // ЗЗ нэгж — 3 түвшний хамааралтай
  // Нэрийн ангилал — 3 түвшний хамааралтай
  const [t1, setT1] = useState(null);
  const [t2, setT2] = useState(null);
  const [t3, setT3] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [dlg, setDlg] = useState(null); // {geoname, statusName, text}

  // Төслийн хамрах ЗЗ нэгж — нэрийн санг эндээс шүүнэ / импортод ашиглана
  const { champaign } = useGetChampaign(projectId);
  const projectUnitIds = useMemo(
    () => (champaign?.units || []).map((u) => u.id),
    [champaign],
  );
  const [importing, setImporting] = useState(false);

  // Бүртгэгдсэн дахин тооллого — хайлт / хуудаслалт / сорт
  const [rq, setRq] = useState("");
  const rdq = useDebounce(rq.trim(), 400);
  const [rPage, setRPage] = useState(0);
  const [rPageSize, setRPageSize] = useState(10);
  const [rOrderBy, setROrderBy] = useState("id");
  const [rOrder, setROrder] = useState("desc");
  const [rStatuses, setRStatuses] = useState([]); // олон сонголт (RECOUNT_STATUS)
  const [locDlg, setLocDlg] = useState(null); // {title, geom} — байршил харах
  const [stMenu, setStMenu] = useState(null); // төлвийн сонголтын цэсний anchor
  const [noGeom, setNoGeom] = useState(false); // зөвхөн байршилгүй нэрс
  const [advOpen, setAdvOpen] = useState(false); // дэлгэрэнгүй хайлт нээлттэй
  const [adv, setAdv] = useState(EMPTY_ADV); // дэлгэрэнгүй хайлтын утгууд
  // Дэлгэрэнгүй хайлтын ангилал — хамгийн гүн сонголт үйлчилнэ
  const advType = adv.t3 || adv.t2 || adv.t1;
  // Дэлгэрэнгүй хайлтад ямар нэг утга сонгогдсон эсэх (icon дээрх улаан цэг)
  const advActive =
    !!adv.aimag ||
    !!adv.sum ||
    !!adv.user ||
    !!advType ||
    !!adv.geomType ||
    !!adv.isBorder;
  const [rowMenu, setRowMenu] = useState(null); // мөрийн 3 цэгийн цэс
  const [dense, setDense] = useState(true); // хүснэгтийн нягт горим (стандарт)
  const [editDlg, setEditDlg] = useState(null); // {id, name, draft, statusIds}
  const [drawingFor, setDrawingFor] = useState(null); // байршил зурж буй geoname
  const [newName, setNewName] = useState("");

  // Ангиллын мод — засах диалог дээр 3 түвшнээр сонгуулна
  const { constants: geoTypes } = useGetConstantsFordropdown("GEONAME_TYPES");
  const typeChildren = useCallback(
    (parentId) =>
      geoTypes.filter((t) => (t.parent ?? null) === (parentId ?? null)),
    [geoTypes],
  );
  // Ангиллын ЗАМЫГ (l1 → l2 → l3) сэргээнэ
  const typeChain = useCallback(
    (typeId) => {
      const byId = new Map(geoTypes.map((t) => [t.id, t]));
      const chain = [];
      let cur = typeId ? byId.get(typeId) : null;
      const seen = new Set();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        chain.unshift(cur);
        cur = cur.parent != null ? byId.get(cur.parent) : null;
      }
      return chain;
    },
    [geoTypes],
  );

  // Шүүлтэд гарах — тухайн төслийн тодруулалт үүсгэсэн хэрэглэгчид
  const { data: userData } = useSWR(
    projectId
      ? [
          endpoints.recount.users(
            new URLSearchParams({ project: projectId }).toString(),
          ),
          axiosInstance,
          "get",
        ]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const userOptions = useMemo(() => userData?.results || [], [userData]);

  const { constants: steps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const { constants: statuses } = useGetConstantsFordropdown("RECOUNT_STATUS");
  const stepObj = useMemo(
    () => steps.find((s) => s.name === stepName) || null,
    [steps, stepName],
  );
  const statusId = useCallback(
    (name) => statuses.find((s) => s.name === name)?.id || null,
    [statuses],
  );

  const ty1 = useTypes(null, true);
  const ty2 = useTypes(t1?.id, !!t1?.id && t1.id !== "none");
  const ty3 = useTypes(t2?.id, !!t2?.id);

  const requestBody = useMemo(
    () =>
      projectId
        ? {
            project: projectId,
            page: rPage + 1,
            page_size: rPageSize,
            ordering: `${rOrder === "desc" ? "-" : ""}${rOrderBy}`,
            ...(rdq ? { search: rdq } : {}),
            ...(stepObj?.id ? { step: stepObj.id } : {}),
            ...(advType?.id
              ? { type: advType.id }
              : t1?.id
                ? { type: t1.id }
                : {}),
            ...(adv.sum?.id || adv.aimag?.id
              ? { unit: adv.sum?.id || adv.aimag?.id }
              : {}),
            ...(adv.geomType ? { geom_type: adv.geomType } : {}),
            ...(adv.isBorder ? { is_border: 1 } : {}),
            ...(rStatuses.length ? { statuses: rStatuses.join(",") } : {}),
            ...(adv.user?.id ? { user: adv.user.id } : {}),
            ...(noGeom ? { no_geom: 1 } : {}),
          }
        : null,
    [
      projectId,
      stepObj,
      rPage,
      rPageSize,
      rOrder,
      rOrderBy,
      rdq,
      rStatuses,
      adv,
      advType,
      t1,
      noGeom,
    ],
  );
  const { recounts, recountsCount, recountsLoading, recountsMutation } =
    useGetRecounts(requestBody);

  // Нийт тоог эцэг хуудсанд мэдэгдэнэ (collapse‑ийн толгойд харуулна)
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(recountsCount);
  }, [recountsCount]);

  // Сорт солих — толгойн багана дарахад
  const onRecountSort = useCallback(
    (id) => {
      const isAsc = rOrderBy === id && rOrder === "asc";
      setROrder(isAsc ? "desc" : "asc");
      setROrderBy(id);
      setRPage(0);
    },
    [rOrderBy, rOrder],
  );

  const refreshAll = useCallback(() => {
    recountsMutation();
  }, [recountsMutation]);

  const handleDelete = async (id) => {
    try {
      const res = await axiosInstance.delete(endpoints.recount.delete(id));
      if (res?.status === 204) {
        enqueueSnackbar("Устгагдлаа");
        refreshAll();
      }
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Устгах үед алдаа", {
        variant: "warning",
      });
    }
  };

  // Тодруулалтын тайлбар + төлвийг засах
  const handleEditSave = async () => {
    if (!editDlg?.id) return;
    try {
      const typeId = editDlg.t3?.id || editDlg.t2?.id || editDlg.t1?.id || null;
      await axiosInstance.patch(endpoints.recount.edit(editDlg.id), {
        draft: editDlg.draft,
        status_ids: editDlg.statusIds,
        // Ангилал — draft тодруулалтын төрөл (ReCount.type)
        ...(!editDlg.nameId && typeId ? { type_id: typeId } : {}),
      });
      // Хилийн цэс нь тооллогын биш, НЭРийн шинж чанар тул тусад нь
      if (editDlg.nameId) {
        await axiosInstance.patch(endpoints.geoname.edit(editDlg.nameId), {
          is_border: !!editDlg.isBorder,
        });
      }
      enqueueSnackbar("Хадгалагдлаа");
      setEditDlg(null);
      refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Хадгалах үед алдаа гарлаа",
        { variant: "warning" },
      );
    }
  };

  // Төслийн талбайд (units) багтах БҮХ батлагдсан нэрийг дахин тооллого руу импортлох
  const handleImportByUnits = useCallback(async () => {
    if (!projectId || importing) return;
    setImporting(true);
    try {
      const res = await axiosInstance.post(endpoints.recount.importByUnits, {
        project: projectId,
        ...(stepObj?.id ? { step: stepObj.id } : {}),
      });
      const { added = 0, skipped = 0 } = res?.data || {};
      enqueueSnackbar(
        added
          ? `${added} нэр импортлогдлоо${skipped ? ` (${skipped} нь өмнө бүртгэгдсэн)` : ""}`
          : "Шинээр импортлох нэр олдсонгүй",
        { variant: added ? "success" : "info" },
      );
      recountsMutation && recountsMutation();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Импорт хийхэд алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setImporting(false);
    }
  }, [projectId, importing, stepObj, enqueueSnackbar, recountsMutation]);

  if (!projectId) return null;

  return (
    <Box>
      <>
        {/* Ангиллын тоо — таб хэлбэрээр (дарахад тухайн ангиллаар шүүнэ) */}
        <RecountTableStatus
          params={requestBody}
          value={t1?.id ?? ""}
          onChange={(id) => {
            setT1(id ? { id } : null);
            setT2(null);
            setT3(null);
            setRPage(0);
          }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Сангаас холбох — төслийн хамрах засаг захиргаанд (аймаг сонгосон бол доод шатны сум, баг хүртэл) багтах бүх батлагдсан нэрийг дахин тооллого руу нэг дор нэмнэ">
                <span>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={importing || !projectUnitIds.length}
                    startIcon={
                      <Iconify
                        icon="solar:refresh-circle-bold"
                        sx={
                          importing
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
                    onClick={handleImportByUnits}
                    sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    Сангаас холбох
                  </Button>
                </span>
              </Tooltip>

              <Button
                variant="outlined"
                color="primary"
                startIcon={<Iconify icon="solar:map-bold" />}
                onClick={() =>
                  router.push(`/dashboard/champaign/${projectId}/map/`)
                }
                sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
              >
                Газрын зураг
              </Button>
            </Stack>
          }
        />

        {/* Toolbar — хайлт + сангаас импортлох */}
        <RecountTableToolbar
          search={rq}
          onSearch={(v) => {
            setRq(v);
            setRPage(0);
          }}
          statuses={statuses}
          selectedStatuses={rStatuses}
          onStatuses={(id) => {
            setRStatuses((prev) =>
              id === null
                ? []
                : prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id],
            );
            setRPage(0);
          }}
          stMenu={stMenu}
          onStMenu={setStMenu}
          onAdvanced={() => setAdvOpen((v) => !v)}
          advancedActive={advActive}
          canReset={advActive || !!rq || !!rStatuses.length || noGeom}
          onReset={() => {
            setAdv(EMPTY_ADV);
            setRq("");
            setRStatuses([]);
            setNoGeom(false);
            setRPage(0);
          }}
          noGeom={noGeom}
          onNoGeom={(v) => {
            setNoGeom(v);
            setRPage(0);
          }}
        />

        {/* Дэлгэрэнгүй хайлт — toolbar‑ын доор */}
        <Collapse in={advOpen} timeout="auto" unmountOnExit>
          <RecountAdvancedSearch
            open={advOpen}
            value={adv}
            users={userOptions}
            onApply={(v) => {
              setAdv(v);
              setRPage(0);
            }}
          />
        </Collapse>

        <TableContainer>
          <Scrollbar>
            <Table size={dense ? "small" : "medium"} sx={{ minWidth: 600 }}>
              <TableHeadCustom
                order={rOrder}
                orderBy={rOrderBy}
                onSort={onRecountSort}
                headLabel={[
                  { id: "", label: "Nº", width: 48 },
                  { id: "name__name", label: "Нэр" },
                  { id: "type_l1", label: "Үндсэн", width: 150 },
                  { id: "type_l3", label: "Ангилал", width: 170 },
                  { id: "created_date", label: "Үүсгэсэн", width: 210 },
                  { id: "", label: "", width: 70, align: "right" },
                ]}
              />
              <TableBody>
                {recountsLoading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
                {!recountsLoading && recounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="caption" color="text.secondary">
                        Бичлэг алга.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {recounts.map((r, index) => (
                  <RecountTableRow
                    key={r.id}
                    row={r}
                    rowQueue={{ rowsPerPage: rPageSize, page: rPage, index }}
                    menuOpen={rowMenu?.row?.id === r.id}
                    onLocation={setLocDlg}
                    onMenu={(anchor, item) => setRowMenu({ anchor, row: item })}
                  />
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
        <TablePaginationCustom
          count={recountsCount}
          page={rPage}
          rowsPerPage={rPageSize}
          onPageChange={(e, p) => setRPage(p)}
          onRowsPerPageChange={(e) => {
            setRPageSize(parseInt(e.target.value, 10));
            setRPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          dense={dense}
          onChangeDense={(e) => setDense(e.target.checked)}
          labelDisplayedRows={({ from, to, count }) =>
            `${from}–${to} / ${count}`
          }
        />
      </>

      {/* Байршил — газрын зураг дээр тодруулж харуулна */}
      <Dialog
        open={!!locDlg}
        onClose={() => setLocDlg(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {locDlg?.title}
          <Typography variant="caption" color="text.secondary" display="block">
            Байршлыг газрын зураг дээр улбар шар өнгөөр тодруулав
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {locDlg?.geom && (
            <RecountMap height={520} flyTarget={{ geom: locDlg.geom }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setLocDlg(null)}>
            Хаах
          </Button>
        </DialogActions>
      </Dialog>

      {/* Мөрийн үйлдлийн цэс — Засах / Устгах */}
      <Menu
        open={!!rowMenu}
        anchorEl={rowMenu?.anchor}
        onClose={() => setRowMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 160 } } }}
      >
        <MenuItem
          onClick={() => {
            const r = rowMenu.row;
            setEditDlg({
              id: r.id,
              nameId: r.name?.id || null,
              name: r.name?.name || "",
              draft: r.draft || "",
              statusIds: (r.statuses || []).map((x) => x.id),
              isBorder: !!r.name?.is_border,
              // Ангилал — зөвхөн батлагдсан нэргүй (draft) тодруулалтад
              t1: typeChain(r.type?.id)[0] || null,
              t2: typeChain(r.type?.id)[1] || null,
              t3: typeChain(r.type?.id)[2] || null,
            });
            setRowMenu(null);
          }}
        >
          <Iconify icon="solar:pen-bold" sx={{ mr: 1 }} />
          Засах
        </MenuItem>
        <Divider />
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            handleDelete(rowMenu.row.id);
            setRowMenu(null);
          }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" sx={{ mr: 1 }} />
          Устгах
        </MenuItem>
      </Menu>

      {/* Тодруулалт засах — тайлбар (draft) + төлөв */}
      <Dialog
        open={!!editDlg}
        onClose={() => setEditDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>
          Тодруулалт засах
          {editDlg?.name ? (
            <Typography
              variant="caption"
              component="div"
              color="text.secondary"
            >
              {editDlg.name}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Тайлбар / зөв нэр"
            value={editDlg?.draft || ""}
            onChange={(e) =>
              setEditDlg((d) => ({ ...d, draft: e.target.value }))
            }
            sx={{ mb: 2 }}
          />

          {/* Ангилал — батлагдсан нэргүй (draft) тодруулалт ЗААВАЛ ангилалтай */}
          {!editDlg?.nameId && (
            <>
              <Typography variant="overline" color="text.secondary">
                Ангилал
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 0.5, mb: 2 }}>
                <Autocomplete
                  value={editDlg?.t1 || null}
                  onChange={(_e, v) =>
                    setEditDlg((d) => ({ ...d, t1: v, t2: null, t3: null }))
                  }
                  options={typeChildren(null)}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Үндсэн" />
                  )}
                />
                <Autocomplete
                  value={editDlg?.t2 || null}
                  disabled={!editDlg?.t1?.id}
                  onChange={(_e, v) =>
                    setEditDlg((d) => ({ ...d, t2: v, t3: null }))
                  }
                  options={typeChildren(editDlg?.t1?.id)}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Дэд" />
                  )}
                />
                <Autocomplete
                  value={editDlg?.t3 || null}
                  disabled={!editDlg?.t2?.id}
                  onChange={(_e, v) => setEditDlg((d) => ({ ...d, t3: v }))}
                  options={typeChildren(editDlg?.t2?.id)}
                  getOptionLabel={(o) => o?.name || ""}
                  isOptionEqualToValue={(o, v) => o?.id === v?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Ангилал" />
                  )}
                />
              </Stack>
            </>
          )}

          <Typography variant="overline" color="text.secondary">
            Төлөв
          </Typography>
          <Stack>
            {statuses.map((st) => {
              const col = statusColor(st);
              const on = (editDlg?.statusIds || []).includes(st.id);
              return (
                <FormControlLabel
                  key={st.id}
                  sx={{ ml: 0 }}
                  control={
                    <Checkbox
                      checked={on}
                      onChange={() =>
                        setEditDlg((d) => ({
                          ...d,
                          statusIds: on
                            ? d.statusIds.filter((x) => x !== st.id)
                            : [...d.statusIds, st.id],
                        }))
                      }
                    />
                  }
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: col,
                        }}
                      />
                      <Typography variant="body2">{st.name}</Typography>
                    </Stack>
                  }
                />
              );
            })}
          </Stack>

          {/* Хилийн цэс — газар зүйн НЭРийн шинж чанар (GeoName.is_border) */}
          {!!editDlg?.nameId && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <FormControlLabel
                sx={{ ml: 0 }}
                control={
                  <Checkbox
                    checked={!!editDlg?.isBorder}
                    onChange={(e) =>
                      setEditDlg((d) => ({ ...d, isBorder: e.target.checked }))
                    }
                  />
                }
                label={<Typography variant="body2">Хилийн цэс</Typography>}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setEditDlg(null)}>
            Болих
          </Button>
          <Button variant="contained" color="primary" onClick={handleEditSave}>
            Хадгалах
          </Button>
        </DialogActions>
      </Dialog>

      {/* зөрүүтэй / алдаатай — бичих диалог (draft) */}
      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {dlg?.statusName === "Уламжлалт" ? "Уламжлалт нэр" : "Зөрүүтэй нэр"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            {dlg?.geoname?.name} — зөв/тэмдэглэх утгыг бичнэ үү (draft‑д
            хадгална).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 1.5 }}
            value={dlg?.text || ""}
            onChange={(e) => setDlg((d) => ({ ...d, text: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDlg(null)}>
            Болих
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={busyId === dlg?.geoname?.id}
            onClick={async () => {
              const { geoname, statusName, text } = dlg;
              setDlg(null);
              await saveRecount(geoname, statusName, text);
            }}
          >
            Хадгалах
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

RecountListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  stepName: PropTypes.string,
  onCount: PropTypes.func,
};
