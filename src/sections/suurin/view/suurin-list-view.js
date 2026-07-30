"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Card,
  Chip,
  Menu,
  Stack,
  Checkbox,
  MenuItem,
  Table,
  Button,
  Dialog,
  Divider,
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

import SuurinTableRow from "../suurin-table-row";
import SuurinTableToolbar from "../suurin-table-toolbar";
import { statusColorByName } from "src/components/map/recountStatus";

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

export default function SuurinListView({
  projectId = "",
  stepName = "Суурин судалгаа",
}) {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  // ЗЗ нэгж — 3 түвшний хамааралтай
  const [u1, setU1] = useState(null);
  const [u2, setU2] = useState(null);
  const [u3, setU3] = useState(null);
  const selUnit = u3 || u2 || u1;
  // Нэрийн ангилал — 3 түвшний хамааралтай
  const [t1, setT1] = useState(null);
  const [t2, setT2] = useState(null);
  const [t3, setT3] = useState(null);
  const selType = t3 || t2 || t1;

  const [q, setQ] = useState(""); // нэрээр хайх
  const dq = useDebounce(q.trim(), 400);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState(null);
  const [dlg, setDlg] = useState(null); // {geoname, statusName, text}

  // Төслийн хамрах ЗЗ нэгж — нэрийн санг эндээс шүүнэ / импортод ашиглана
  const { champaign } = useGetChampaign(projectId);
  const projectUnitIds = useMemo(
    () => (champaign?.units || []).map((u) => u.id),
    [champaign],
  );
  const [importing, setImporting] = useState(false);
  const [sumSel, setSumSel] = useState(null); // хураангуйд сонгосон үндсэн ангилал

  // Төслийн талбайд багтах батлагдсан нэрсийн АНГИЛЛЫН хураангуй
  const { data: typeSummary } = useSWR(
    projectUnitIds.length
      ? [
          endpoints.geoname.typeSummary(
            new URLSearchParams({
              unit_tree: projectUnitIds.join(","),
            }).toString(),
          ),
          axiosInstance,
          "get",
        ]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const sumGroups = useMemo(() => typeSummary?.results || [], [typeSummary]);
  const sumActive = useMemo(
    () => sumGroups.find((g) => g.id === sumSel) || null,
    [sumGroups, sumSel],
  );

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
  const [rowMenu, setRowMenu] = useState(null); // мөрийн 3 цэгийн цэс
  const [editDlg, setEditDlg] = useState(null); // {id, name, draft, statusIds}
  const [mapKey, setMapKey] = useState(0); // газрын зураг дахин татах түлхүүр
  const [drawingFor, setDrawingFor] = useState(null); // байршил зурж буй geoname
  const [isNew, setIsNew] = useState(false); // "Шинэ нэр" горим
  const [newName, setNewName] = useState("");

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

  // Cascading dropdowns
  const lvl1 = useUnits("Аймаг/Нийслэл", null, true);
  const lvl2 = useUnits("Сум/Дүүрэг", u1?.id, !!u1?.id);
  const lvl3 = useUnits("Баг/Хороо", u2?.id, !!u2?.id);
  const ty1 = useTypes(null, true);
  const ty2 = useTypes(t1?.id, !!t1?.id);
  const ty3 = useTypes(t2?.id, !!t2?.id);

  // Шүүсэн нэрсийн хүснэгт (хуудаслалттай). ЗЗ нэгж эсвэл ангилал сонгосон үед.
  const tableQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", page + 1);
    p.set("page_size", pageSize);
    if (selUnit?.id) p.set("unit_geom", selUnit.id);
    if (selType?.id) p.set("type", selType.id);
    if (dq) p.set("search", dq); // нэр / дугаараар хайх
    // Аль хэдийн бүртгэгдсэн (доор сонгогдсон) нэрсийг хайлтаас хасна
    if (projectId) p.set("exclude_recount_project", projectId);
    if (stepObj?.id) p.set("exclude_recount_step", stepObj.id);
    return p.toString();
  }, [page, pageSize, selUnit, selType, dq, projectId, stepObj]);
  const tableEnabled = !!(selUnit?.id || selType?.id || dq);
  const {
    data: nameData,
    isLoading: namesLoading,
    mutate: namesMutation,
  } = useSWR(
    tableEnabled
      ? [endpoints.geoname.list(tableQuery), axiosInstance, "get"]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const names = nameData?.results || [];
  const namesCount = nameData?.count || 0;

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
            ...(selType?.id ? { type: selType.id } : {}),
            ...(rStatuses.length ? { statuses: rStatuses.join(",") } : {}),
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
      selType,
      rStatuses,
      noGeom,
    ],
  );
  const { recounts, recountsCount, recountsLoading, recountsMutation } =
    useGetRecounts(requestBody);

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

  // Газрын зургийг navigate хийх хүрээ — dropdown‑оос ЗЗ нэгж сонгоход
  const [fitExtent, setFitExtent] = useState(null);
  const navigateToUnit = useCallback(async (unitId) => {
    if (!unitId) return;
    try {
      const res = await axiosInstance.get(endpoints.legal.unitExtent(unitId));
      if (res?.data?.extent) setFitExtent(res.data.extent);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Газрын зургийн CQL шүүлт — тухайн төсөл (+ үе шат)
  const mapCql = useMemo(() => {
    if (!projectId) return undefined;
    let c = `project_id=${projectId}`;
    if (stepObj?.id) c += ` AND step_id=${stepObj.id}`;
    return c;
  }, [projectId, stepObj]);

  const refreshAll = useCallback(() => {
    recountsMutation();
    setMapKey((k) => k + 1); // газрын зургийн давхаргыг шинэчлэх
    if (namesMutation) namesMutation(); // хайлтын хүснэгтийг дахин татах (exclude)
  }, [recountsMutation, namesMutation]);

  // Нэг recount хадгалах (ижил/зөрүүтэй/алдаатай)
  const saveRecount = async (geoname, statusName, draftText, loc) => {
    setBusyId(geoname.id);
    try {
      await axiosInstance.post(endpoints.recount.create, {
        project_id: projectId,
        name_id: geoname.id,
        draft: draftText || "",
        ...(stepObj?.id ? { step_id: stepObj.id } : {}),
        ...(statusId(statusName) ? { status_id: statusId(statusName) } : {}),
        ...(loc ? { loc } : {}),
      });
      enqueueSnackbar(`"${geoname.name}" — ${statusName}`);
      refreshAll();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Хадгалах үед алдаа", {
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAction = (geoname, statusName) => {
    if (statusName === "ижил") {
      saveRecount(geoname, "ижил", geoname.name);
    } else if (statusName === "байршил") {
      // Газрын зураг дээр цэг тавих горимд орно
      setDrawingFor(geoname);
      enqueueSnackbar(
        `"${geoname.name}" — газрын зураг дээр байршлыг тэмдэглэнэ үү`,
        {
          variant: "info",
        },
      );
    } else {
      // зөрүүтэй / алдаатай → бичих диалог (draft‑ыг нэрээр урьдчилж бөглөнө)
      setDlg({ geoname, statusName, text: geoname.name || "" });
    }
  };

  // Газрын зураг дээр дүрс зурахад дуудагдана (WKT 4326) → байршил статустай хадгална
  const handleDrawn = async (wkt) => {
    if (!drawingFor || !wkt) return;
    const g = drawingFor;
    setDrawingFor(null);
    if (g.isNew) {
      // Шинэ нэр — GeoName‑гүй, draft = бичсэн нэр, статус "шинэ"
      await saveRecount({ name: g.name }, "шинэ", g.name, wkt);
      setNewName("");
    } else {
      await saveRecount(g, "байршил", g.name, wkt);
    }
  };

  // Нэрийн геометрийн төрлийг OpenLayers Draw төрөл рүү буулгана
  const olDrawType = (gt) => {
    const t = (gt || "").toLowerCase();
    if (t.includes("polygon")) return "Polygon";
    if (t.includes("line")) return "LineString";
    return "Point";
  };
  // Ангиллын desc (Цэг/Шугам/Талбай) → OL Draw төрөл
  const descToGeomType = (desc) => {
    if (desc === "Шугам") return "LineString";
    if (desc === "Талбай") return "Polygon";
    return "Point";
  };

  // Шинэ нэрийг газрын зураг дээр зурах горимд оруулна
  const startNewDraw = () => {
    if (!newName.trim()) {
      enqueueSnackbar("Шинэ нэрээ бичнэ үү", { variant: "warning" });
      return;
    }
    setDrawingFor({
      isNew: true,
      name: newName.trim(),
      geom_type: descToGeomType(selType?.desc),
    });
  };

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
      await axiosInstance.patch(endpoints.recount.edit(editDlg.id), {
        draft: editDlg.draft,
        status_ids: editDlg.statusIds,
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

  const unitCell = (label, options, value, onChange, disabled) => (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      onChange={onChange}
      getOptionLabel={(o) => o?.unit || o?.name || ""}
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );

  return (
    <Box>
      {/* Төслийн талбайн батлагдсан нэрсийн ХУРААНГУЙ — ангиллаар */}
      {!!sumGroups.length && (
        <>
          <Box
            gap={2}
            display="grid"
            gridTemplateColumns={{
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            }}
            sx={{ mb: 2 }}
          >
            {sumGroups.map((g) => {
              const active = g.id === sumSel;
              return (
                <Card
                  key={g.id}
                  onClick={() => setSumSel(active ? null : g.id)}
                  sx={{
                    p: 2,
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: active ? "primary.main" : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "common.white",
                        bgcolor: "primary.main",
                        flexShrink: 0,
                      }}
                    >
                      <Iconify icon="mdi:map-marker-multiple" width={24} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1" noWrap>
                        {g.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {g.count.toLocaleString()} нэр ·{" "}
                        {(g.children || []).length} дэд ангилал
                      </Typography>
                    </Box>
                    <Iconify
                      icon={active ? "mdi:chevron-up" : "mdi:chevron-down"}
                      width={22}
                    />
                  </Stack>
                </Card>
              );
            })}
          </Box>

          {/* Сонгосон үндсэн ангиллын дэд задаргаа */}
          {sumActive && (
            <Card sx={{ px: 2, py: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {sumActive.name} — дэд ангиллууд
              </Typography>
              <Stack divider={<Divider flexItem />}>
                {(sumActive.children || []).map((k, i) => (
                  <Stack
                    key={k.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ py: 0.75 }}
                  >
                    <Typography variant="body2">
                      <Box
                        component="span"
                        sx={{ color: "text.disabled", mr: 1 }}
                      >
                        {i + 1}.
                      </Box>
                      {k.name}
                    </Typography>
                    <Chip
                      variant="soft"
                      color="primary"
                      label={`${k.count.toLocaleString()} нэр`}
                    />
                  </Stack>
                ))}
              </Stack>
            </Card>
          )}
        </>
      )}

      {/* Бүртгэгдсэн дахин тооллого — үргэлж нээлттэй */}
      <Card sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography variant="subtitle1">
            Тодруулалт ({recountsCount} нэр)
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Iconify icon="solar:map-bold" />}
            onClick={() =>
              router.push(`/dashboard/champaign/${projectId}/map/`)
            }
          >
            Газрын зураг
          </Button>
        </Stack>
        <>
          <Divider />
          {/* Toolbar — хайлт + сангаас импортлох */}
          <SuurinTableToolbar
            search={rq}
            onSearch={(v) => {
              setRq(v);
              setRPage(0);
            }}
            t1={t1}
            t2={t2}
            t3={t3}
            ty1={ty1}
            ty2={ty2}
            ty3={ty3}
            onType={(level, v) => {
              if (level === 1) {
                setT1(v);
                setT2(null);
                setT3(null);
              } else if (level === 2) {
                setT2(v);
                setT3(null);
              } else {
                setT3(v);
              }
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
            noGeom={noGeom}
            onNoGeom={(v) => {
              setNoGeom(v);
              setRPage(0);
            }}
            importing={importing}
            canImport={!!projectUnitIds.length}
            onImport={handleImportByUnits}
          />
          <TableContainer>
            <Scrollbar>
              <Table sx={{ minWidth: 600 }}>
                <TableHeadCustom
                  order={rOrder}
                  orderBy={rOrderBy}
                  onSort={onRecountSort}
                  headLabel={[
                    { id: "name__name", label: "Нэр" },
                    { id: "type_l1", label: "Үндсэн" },
                    { id: "type_l2", label: "Дэд" },
                    { id: "type_l3", label: "Ангилал" },
                    { id: "", label: "Байршил", width: 110, align: "center" },
                    { id: "", label: "Төлөв" },
                    { id: "", label: "", width: 70, align: "right" },
                  ]}
                />
                <TableBody>
                  {recountsLoading && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <CircularProgress size={20} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!recountsLoading && recounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Бичлэг алга.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {recounts.map((r) => (
                    <SuurinTableRow
                      key={r.id}
                      row={r}
                      menuOpen={rowMenu?.row?.id === r.id}
                      onLocation={setLocDlg}
                      onMenu={(anchor, item) =>
                        setRowMenu({ anchor, row: item })
                      }
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
            labelDisplayedRows={({ from, to, count }) =>
              `${from}–${to} / ${count}`
            }
          />
        </>
      </Card>

      {/* Газрын зураг тусдаа хуудаст шилжсэн (champaign/<id>/map) — энд хэрэггүй */}

      {/* Байршил — газрын зураг дээр тодруулж харуулна */}
      <Dialog
        open={!!locDlg}
        onClose={() => setLocDlg(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 1 }}>{locDlg?.title}</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {locDlg?.geom && (
            <RecountMap height={460} flyTarget={{ geom: locDlg.geom }} />
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
          <Typography variant="overline" color="text.secondary">
            Төлөв
          </Typography>
          <Stack>
            {statuses.map((st) => {
              const col = statusColorByName(st.name);
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
          <Button variant="contained" onClick={handleEditSave}>
            Хадгалах
          </Button>
        </DialogActions>
      </Dialog>

      {/* зөрүүтэй / алдаатай — бичих диалог (draft) */}
      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {dlg?.statusName === "батлагдаагүй"
            ? "Батлагдаагүй нэр"
            : "Алдаатай нэр"}
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

SuurinListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  stepName: PropTypes.string,
};
