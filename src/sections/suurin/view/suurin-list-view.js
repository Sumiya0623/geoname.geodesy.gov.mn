"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Card,
  Chip,
  Stack,
  Table,
  Switch,
  Button,
  Dialog,
  Divider,
  Tooltip,
  Collapse,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  Autocomplete,
  DialogTitle,
  ButtonGroup,
  FormControlLabel,
  DialogContent,
  DialogActions,
  TableContainer,
  InputAdornment,
  CircularProgress,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useDebounce } from "src/hooks/use-debounce";
import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetRecounts } from "src/api/recount";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import { TableHeadCustom, TablePaginationCustom } from "src/components/table";


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
  const form = useBoolean();
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
  const recountList = useBoolean(false); // бүртгэгдсэн хүснэгт — default хураасан
  // Бүртгэгдсэн дахин тооллого — хайлт / хуудаслалт / сорт
  const [rq, setRq] = useState("");
  const rdq = useDebounce(rq.trim(), 400);
  const [rPage, setRPage] = useState(0);
  const [rPageSize, setRPageSize] = useState(10);
  const [rOrderBy, setROrderBy] = useState("id");
  const [rOrder, setROrder] = useState("desc");
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
  const { data: nameData, isLoading: namesLoading, mutate: namesMutation } =
    useSWR(
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
          }
        : null,
    [projectId, stepObj, rPage, rPageSize, rOrder, rOrderBy, rdq],
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
      enqueueSnackbar(`"${geoname.name}" — газрын зураг дээр байршлыг тэмдэглэнэ үү`, {
        variant: "info",
      });
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
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6">Дахин тооллого</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="info"
            startIcon={<Iconify icon="solar:map-point-bold" />}
            onClick={() => router.push(`/dashboard/champaign/${projectId}/map/`)}
          >
            Газрын зураг
          </Button>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={form.onToggle}
          >
            Нэр бүртгэх
          </Button>
        </Stack>
      </Stack>

      {form.value && (
        <Card sx={{ p: 2, mb: 2 }}>
          {/* ЗЗ нэгж — 3 түвшин */}
          <Box
            gap={1.5}
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }}
            sx={{ mb: 1.5 }}
          >
            {unitCell(
              "Аймаг / Нийслэл",
              lvl1,
              u1,
              (e, v) => {
                setU1(v);
                setU2(null);
                setU3(null);
                setPage(0);
                navigateToUnit(v?.id);
              },
              false,
            )}
            {unitCell(
              "Сум / Дүүрэг",
              lvl2,
              u2,
              (e, v) => {
                setU2(v);
                setU3(null);
                setPage(0);
                navigateToUnit(v?.id);
              },
              !u1?.id,
            )}
            {unitCell(
              "Баг / Хороо",
              lvl3,
              u3,
              (e, v) => {
                setU3(v);
                setPage(0);
                navigateToUnit(v?.id);
              },
              !u2?.id,
            )}
          </Box>
          {/* Нэрийн ангилал — 3 түвшин */}
          <Box
            gap={1.5}
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "repeat(3, 1fr)" }}
            sx={{ mb: 2 }}
          >
            {unitCell(
              "Ангилал (үндсэн)",
              ty1,
              t1,
              (e, v) => {
                setT1(v);
                setT2(null);
                setT3(null);
                setPage(0);
              },
              false,
            )}
            {unitCell(
              "Дэд ангилал",
              ty2,
              t2,
              (e, v) => {
                setT2(v);
                setT3(null);
                setPage(0);
              },
              !t1?.id,
            )}
            {unitCell(
              "Төрөл",
              ty3,
              t3,
              (e, v) => {
                setT3(v);
                setPage(0);
              },
              !t2?.id,
            )}
          </Box>

          {/* Нэрээр хайх */}
          <TextField
            fullWidth
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Нэр / дугаараар хайх..."
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <Iconify
                  icon="eva:search-fill"
                  sx={{ color: "text.disabled", mr: 1 }}
                />
              ),
              endAdornment: q ? (
                <IconButton size="small" onClick={() => setQ("")}>
                  <Iconify icon="eva:close-fill" />
                </IconButton>
              ) : null,
            }}
          />

          {/* Шинэ нэр — байхгүй нэрийг ангиллын геометрээр зурж бүртгэх */}
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={isNew}
                  onChange={(e) => setIsNew(e.target.checked)}
                />
              }
              label="Шинэ нэр"
            />
            {isNew && (
              <>
                <TextField
                  size="small"
                  label="Шинэ нэр"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  sx={{ minWidth: 240 }}
                />
                <Tooltip
                  title={`Газрын зураг дээр байршил зурах (${descToGeomType(
                    selType?.desc,
                  ) === "Polygon" ? "полигон" : descToGeomType(selType?.desc) === "LineString" ? "шугам" : "цэг"})`}
                >
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<Iconify icon="solar:map-point-add-bold" />}
                      onClick={startNewDraw}
                      disabled={!newName.trim()}
                    >
                      Байршил зурах
                    </Button>
                  </span>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Ангилал: {selType?.name || "—"}
                </Typography>
              </>
            )}
          </Stack>

          {/* Шүүсэн нэрсийн хүснэгт */}
          {!tableEnabled ? (
            <Typography variant="caption" color="text.secondary">
              ЗЗ нэгж, ангилал сонгох эсвэл нэрээр хайхад нэрс энд гарч ирнэ.
            </Typography>
          ) : (
            <>
              <TableContainer>
                <Scrollbar>
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell width={48}>№</TableCell>
                        <TableCell>Нэр</TableCell>
                        <TableCell>Дугаар</TableCell>
                        <TableCell align="right">Үйлдэл</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {namesLoading && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                            <CircularProgress size={20} />
                          </TableCell>
                        </TableRow>
                      )}
                      {!namesLoading && names.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                            <Typography variant="caption" color="text.secondary">
                              Нэр олдсонгүй.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      {names.map((g, i) => {
                        return (
                          <TableRow key={g.id} hover>
                            <TableCell>{page * pageSize + i + 1}</TableCell>
                            <TableCell>{g.name}</TableCell>
                            <TableCell>{g.number || "—"}</TableCell>
                            <TableCell align="right">
                              <ButtonGroup
                                size="small"
                                variant="outlined"
                                disabled={busyId === g.id}
                              >
                                <Button
                                  color="success"
                                  onClick={() => handleAction(g, "ижил")}
                                >
                                  Ижил
                                </Button>
                                <Button
                                  color="warning"
                                  onClick={() => handleAction(g, "батлагдаагүй")}
                                >
                                  Батлагдаагүй
                                </Button>
                                <Button
                                  color="error"
                                  onClick={() => handleAction(g, "алдаатай")}
                                >
                                  Алдаатай
                                </Button>
                                <Tooltip title="Газрын зураг дээр байршил зурах">
                                  <Button
                                    onClick={() => handleAction(g, "байршил")}
                                  >
                                    Байршил
                                  </Button>
                                </Tooltip>
                              </ButtonGroup>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Scrollbar>
              </TableContainer>
              <TablePaginationCustom
                count={namesCount}
                page={page}
                onPageChange={(e, p) => setPage(p)}
                rowsPerPage={pageSize}
                onRowsPerPageChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} / ${count}`
                }
              />
            </>
          )}
        </Card>
      )}

      {/* Бүртгэгдсэн дахин тооллого — default хураасан (collapsed) */}
      <Card sx={{ mb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, cursor: "pointer" }}
          onClick={recountList.onToggle}
        >
          <Typography variant="subtitle1">
            Бүртгэгдсэн дахин тооллого ({recountsCount})
          </Typography>
          <Iconify
            icon={
              recountList.value
                ? "eva:chevron-up-fill"
                : "eva:chevron-down-fill"
            }
            width={22}
          />
        </Stack>
        <Collapse in={recountList.value} timeout="auto" unmountOnExit>
          <Divider />
          {/* Хайлт */}
          <Box sx={{ p: 2 }}>
            <TextField
              fullWidth
              size="small"
              value={rq}
              onChange={(e) => {
                setRq(e.target.value);
                setRPage(0);
              }}
              placeholder="Нэр / тайлбараар хайх..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify
                      icon="eva:search-fill"
                      sx={{ color: "text.disabled" }}
                    />
                  </InputAdornment>
                ),
                endAdornment: rq ? (
                  <IconButton size="small" onClick={() => setRq("")}>
                    <Iconify icon="eva:close-fill" />
                  </IconButton>
                ) : null,
              }}
            />
          </Box>
          <TableContainer>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 600 }}>
                <TableHeadCustom
                  order={rOrder}
                  orderBy={rOrderBy}
                  onSort={onRecountSort}
                  headLabel={[
                    { id: "draft", label: "Нэр / Тайлбар" },
                    { id: "status__name", label: "Төлөв" },
                    { id: "", label: "Үйлдэл", align: "right" },
                  ]}
                />
                <TableBody>
                  {recountsLoading && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <CircularProgress size={20} />
                      </TableCell>
                    </TableRow>
                  )}
                  {!recountsLoading && recounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          Бичлэг алга.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {recounts.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.draft || r.name?.name || "—"}</TableCell>
                      <TableCell>
                        {r.status?.name ? (
                          <Chip
                            size="small"
                            label={r.status.name}
                            variant="outlined"
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
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
        </Collapse>
      </Card>

      {/* Газрын зураг тусдаа хуудаст шилжсэн (champaign/<id>/map) — энд хэрэггүй */}

      {/* зөрүүтэй / алдаатай — бичих диалог (draft) */}
      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {dlg?.statusName === "батлагдаагүй" ? "Батлагдаагүй нэр" : "Алдаатай нэр"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            {dlg?.geoname?.name} — зөв/тэмдэглэх утгыг бичнэ үү (draft‑д хадгална).
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
