"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Place as GeomPointIcon,
  Timeline as GeomLineIcon,
  CropSquare as GeomPolyIcon,
} from "@mui/icons-material";

import {
  Box,
  Tab,
  Card,
  Tabs,
  Table,
  Stack,
  Tooltip,
  Collapse,
  Checkbox,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  IconButton,
  Typography,
  Autocomplete,
  InputAdornment,
  TableContainer,
} from "@mui/material";

import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetRecountForms } from "src/api/recount";

import Iconify from "src/components/iconify";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import {
  useTable,
  TableNoData,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from "src/components/table";

// ----------------------------------------------------------------------
// Маягтууд (Хавсралт 1-4) — ReCount‑ийг статусаар нь хүснэгтээр. Хайлт (toolbar),
// хуудаслалт, олон сонголт (multi‑select) бүхий стандарт хүснэгт.
//  Маягт1=ижил, Маягт2=шинэ, Маягт3=зөрүүтэй+алдаатай, Маягт4=байршил.
// ----------------------------------------------------------------------

function useUnits(level, parentId, enabled = true) {
  const params = new URLSearchParams({ level });
  if (parentId) params.append("parent", parentId);
  const { data } = useSWR(
    enabled ? [endpoints.legal.units(params.toString()), axiosInstance, "get"] : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  return data?.results || [];
}

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

// Геометр төрөл → icon (дэвсгэр нэрийн icon‑той ижил: Цэг/Шугам/Талбай)
const GEOM_ICON = {
  Point: { Ic: GeomPointIcon, color: "#16a34a" },
  MultiPoint: { Ic: GeomPointIcon, color: "#16a34a" },
  LineString: { Ic: GeomLineIcon, color: "#2563eb" },
  MultiLineString: { Ic: GeomLineIcon, color: "#2563eb" },
  Polygon: { Ic: GeomPolyIcon, color: "#d97706" },
  MultiPolygon: { Ic: GeomPolyIcon, color: "#d97706" },
};
function GeomIcon({ geom }) {
  const g = GEOM_ICON[geom];
  if (!g) return null;
  const Ic = g.Ic;
  return (
    <Ic
      sx={{ fontSize: 15, color: g.color, ml: 0.5, verticalAlign: "text-bottom" }}
    />
  );
}
GeomIcon.propTypes = { geom: PropTypes.string };

// Маягт бүрийн баганы тодорхойлолт
const COLS = {
  1: [
    { id: "draft", label: "Зураг дээрх нэр", get: (r) => r.draft },
    { id: "name", label: "УИХ‑аар батлагдсан нэр", get: (r) => r.name },
    { id: "nomek_100k", label: "1:100000 нэрлэвэр", get: (r) => r.nomek_100k },
    { id: "nomek_25k", label: "1:25000 нэрлэвэр", get: (r) => r.nomek_25k },
  ],
  2: [
    { id: "draft", label: "Уламжлалт (батлагдаагүй) нэр", get: (r) => r.draft || r.name },
    { id: "nomek_100k", label: "1:100000 нэрэлбэр", get: (r) => r.nomek_100k },
    { id: "lat", label: "Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Уртраг", get: (r) => r.lon },
  ],
  3: [
    { id: "draft", label: "Зөрүүтэй/алдаатай нэр", get: (r) => r.draft },
    { id: "name", label: "УИХ‑аар батлагдсан нэр", get: (r) => r.name },
    { id: "nomek_100k", label: "1:100000 нэрэлбэр", get: (r) => r.nomek_100k },
    { id: "lat", label: "Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Уртраг", get: (r) => r.lon },
  ],
  4: [
    { id: "name", label: "УИХ‑аар батлагдсан нэр", get: (r) => r.name },
    { id: "nomek_25k", label: "1:25000 нэрэлбэр", get: (r) => r.nomek_25k },
    { id: "lat", label: "Суурь — Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Суурь — Уртраг", get: (r) => r.lon },
    { id: "clat", label: "Зөв — Өргөрөг", get: () => "" },
    { id: "clon", label: "Зөв — Уртраг", get: () => "" },
  ],
  5: [
    { id: "name", label: "Газар зүйн нэр", get: (r) => r.name },
    { id: "draft", label: "Зэргэлдээх суманд нэрлэж буй нэр", get: (r) => r.draft },
    { id: "lat", label: "Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Уртраг", get: (r) => r.lon },
    { id: "note", label: "Хэрхэн шийдвэрлэсэн (тайлбар)", get: () => "" },
  ],
  // Маягт 6, 8, 9 — одоохондоо дотроо хоосон (дата холбоогүй), зөвхөн PDF загвар
  6: [
    { id: "name", label: "Шинээр бий болсон объект", get: (r) => r.draft || r.name },
    { id: "type", label: "Дэвсгэр нэр", get: (r) => r.gtype },
    { id: "nomek_25k", label: "1:25000 нэрэлбэр", get: (r) => r.nomek_25k },
    { id: "lat", label: "Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Уртраг", get: (r) => r.lon },
  ],
  8: [
    { id: "name", label: "УИХ-аар шинээр батлагдах нэр", get: (r) => r.name },
    { id: "nomek_25k", label: "1:25000 нэрэлбэр", get: (r) => r.nomek_25k },
    { id: "lat", label: "Өргөрөг", get: (r) => r.lat },
    { id: "lon", label: "Уртраг", get: (r) => r.lon },
  ],
  9: [
    { id: "person", label: "Иргэний овог, нэр", get: () => "" },
    { id: "register", label: "Регистрийн дугаар", get: () => "" },
    { id: "phone", label: "Утасны дугаар", get: () => "" },
    { id: "sign", label: "Гарын үсэг", get: () => "" },
  ],
};

const TABS = [
  { value: "1", label: "Маягт 1" },
  { value: "2", label: "Маягт 2" },
  { value: "3", label: "Маягт 3" },
  { value: "4", label: "Маягт 4" },
  { value: "5", label: "Маягт 5" },
  { value: "6", label: "Маягт 6" },
  { value: "8", label: "Маягт 8" },
  { value: "9", label: "Маягт 9" },
];

// Маягт бүрийн гарчиг (PDF доторх Хавсралтын нэр) — хайлтын дээр харуулна
const FORM_TITLES = {
  1: "Улсын Их Хурлаар батлагдсан газар зүйн нэр 1:25000-1:100000-ны масштабтай байр зүйн зураг дээр бичигдсэн нэртэй харьцуулсан судалгаа",
  2: "Улсын Их Хурлаар батлагдаагүй (уламжлалт) газар зүйн нэрийн жагсаалт",
  3: "Улсын Их Хурлаар зөрүүтэй, өөр нэрээр, үг үсгийн алдаатай батлагдсан газар зүйн нэрийн жагсаалт",
  4: "Улсын Их Хурлаар батлагдсан нэрийн тодруулалт хийсэн суурь зурагт байршлаараа буруу тэмдэглэгдсэн газар зүйн нэрийн судалгаа",
  5: "Зөрүүтэй нэрлэж буй газар зүйн нэрийн жагсаалт",
  6: "Шинээр буй болсон газар зүйн объектуудын нэрийг тодотгосон судалгаа",
  8: "Улсын Их Хурлаар батлуулах газар зүйн нэр",
  9: "Газар зүйн нэрийн хээрийн тодотголын ажилд газарчнаар ажилласан иргэний нотолгоо",
};

export default function MayagtView({ projectId = "", stepName = "Суурин судалгаа" }) {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultRowsPerPage: 25 });

  const [tab, setTab] = useState("1");
  const [q, setQ] = useState("");
  const [aimag, setAimag] = useState(null);
  const [sum, setSum] = useState(null);
  // Дэвсгэр нэрийн dependent 3 түвшний шүүлт (Үндсэн→Анхдагч→Дэд)
  const [cat1, setCat1] = useState(null);
  const [cat2, setCat2] = useState(null);
  const [cat3, setCat3] = useState(null);
  const [cat1Opts, setCat1Opts] = useState([]);
  const [cat2Opts, setCat2Opts] = useState([]);
  const [cat3Opts, setCat3Opts] = useState([]);
  const typeFilterId = cat3?.id || cat2?.id || cat1?.id || null;

  const fetchCats = useCallback(async (parent) => {
    try {
      const qp = parent ? new URLSearchParams({ parent }).toString() : "";
      const res = await axiosInstance.get(endpoints.nameCategory.list(qp));
      return res?.data?.results || res?.data || [];
    } catch (e) {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchCats(null).then(setCat1Opts);
  }, [fetchCats]);

  const handleCat = useCallback(
    async (level, value) => {
      if (level === 1) {
        setCat1(value);
        setCat2(null);
        setCat3(null);
        setCat3Opts([]);
        setCat2Opts(value?.id ? await fetchCats(value.id) : []);
      } else if (level === 2) {
        setCat2(value);
        setCat3(null);
        setCat3Opts(value?.id ? await fetchCats(value.id) : []);
      } else {
        setCat3(value);
      }
    },
    [fetchCats],
  );

  const { constants: steps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const stepObj = useMemo(
    () => steps.find((s) => s.name === stepName) || null,
    [steps, stepName],
  );

  const aimags = useUnits("Аймаг/Нийслэл", null, true);
  const sums = useUnits("Сум/Дүүрэг", aimag?.id, !!aimag?.id);

  const { forms, formsLoading, formsMutation } = useGetRecountForms({
    projectId,
    step: stepObj?.id,
    sum: sum?.id,
    aimag: aimag?.id,
    type: typeFilterId,
    tab,
  });

  // Таб солих/шүүхэд хуудас+сонголт reset
  const resetView = useCallback(() => {
    table.onResetPage();
    table.setSelected([]);
  }, [table]);

  useEffect(() => {
    resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, sum, aimag, typeFilterId]);

  const cols = COLS[tab];

  // Хайлтаар шүүсэн мөрүүд (нэр/зураг дээрх нэр + нэрлэвэр код)
  const filtered = useMemo(() => {
    const all = forms?.[tab] || [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(s) ||
        (r.draft || "").toLowerCase().includes(s) ||
        (r.nomek_25k || "").toLowerCase().includes(s) ||
        (r.nomek_100k || "").toLowerCase().includes(s),
    );
  }, [forms, tab, q]);

  const paged = filtered.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage,
  );
  const allIds = filtered.map((r) => r.id);
  const notFound = !formsLoading && filtered.length === 0;

  const handleDeleteSelected = async () => {
    const ids = table.selected;
    if (!ids.length) return;
    try {
      await Promise.all(
        ids.map((id) => axiosInstance.delete(endpoints.recount.delete(id))),
      );
      enqueueSnackbar(`${ids.length} мөр устгагдлаа`);
      table.setSelected([]);
      formsMutation();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Устгах үед алдаа", {
        variant: "warning",
      });
    }
  };

  // Маягтыг Хавсралт загвараар PDF болгож татах (тухайн таб + сум/алхмын шүүлтээр)
  const [pdfLoading, setPdfLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false); // аймаг/сум шүүлт (Extra)
  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ form: tab, project: String(projectId) });
      if (stepObj?.id) params.append("step", stepObj.id);
      if (sum?.id) params.append("sum_geom", sum.id);
      const res = await axiosInstance.get(
        `/api/r/recount/form-pdf/?${params.toString()}`,
        { responseType: "blob" },
      );
      const blob = res?.data;
      // Хариу PDF биш (алдааны JSON) бол — бодит алдааг уншиж харуулна
      if (!blob || (blob.type && !blob.type.includes("pdf"))) {
        let msg = "Маягт татахад алдаа гарлаа";
        try {
          const txt = await blob.text();
          msg = JSON.parse(txt)?.detail || msg;
        } catch (_) {
          /* JSON биш бол анхдагч мессеж */
        }
        enqueueSnackbar(msg, { variant: "warning" });
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mayagt_${tab}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Маягт татахад алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setPdfLoading(false);
    }
  };

  if (!projectId) return null;

  const headLabel = [
    ...cols.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <Box>
      <Card>
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.value}
              value={t.value}
              label={`${t.label} (${forms?.[t.value]?.length || 0})`}
            />
          ))}
        </Tabs>

        {/* Маягтын гарчиг (PDF доторх Хавсралтын нэр) */}
        {FORM_TITLES[tab] && (
          <Box sx={{ px: 2, pt: 2 }}>
            <Typography
              variant="subtitle2"
              align="center"
              sx={{ fontWeight: 700, lineHeight: 1.4 }}
            >
              {FORM_TITLES[tab]}
            </Typography>
          </Box>
        )}

        {/* Toolbar — хайлт + шүүлт (Extra) + PDF */}
        <Stack sx={{ px: 2, pb: 1, pt: 1 }} direction="row" alignItems="center" spacing={1}>
          <TextField
            fullWidth
            size="small"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Нэр / зураг дээрх нэр / нэрлэвэрээр хайх..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
            }}
          />
          <Tooltip title="Шүүлтүүр (аймаг/сум)">
            <IconButton
              color={
                filterOpen || aimag?.id || sum?.id || typeFilterId
                  ? "primary"
                  : "default"
              }
              onClick={() => setFilterOpen((v) => !v)}
            >
              <Iconify icon="mdi:filter-variant" width={24} />
            </IconButton>
          </Tooltip>
          {["1", "2", "3", "4", "5", "6", "8", "9"].includes(tab) && (
            <Tooltip title="Маягт татах (PDF)">
              <span>
                <IconButton color="error" onClick={handleDownloadPdf} disabled={pdfLoading}>
                  <Iconify icon="mdi:file-pdf-box" width={26} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>

        {/* Шүүлтүүрийн форм (Extra) — toggle товчоор нээгдэнэ */}
        <Collapse in={filterOpen} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, pb: 2 }}>
            <Box
              gap={1.5}
              display="grid"
              gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }}
              sx={{ maxWidth: 640, mb: 1.5 }}
            >
              <Autocomplete
                size="small"
                options={aimags}
                value={aimag}
                onChange={(e, v) => {
                  setAimag(v);
                  setSum(null);
                }}
                getOptionLabel={(o) => o?.unit || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => (
                  <TextField {...params} label="Аймаг/Нийслэл" />
                )}
              />
              <Autocomplete
                size="small"
                options={sums}
                value={sum}
                disabled={!aimag?.id}
                onChange={(e, v) => setSum(v)}
                getOptionLabel={(o) => o?.unit || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => (
                  <TextField {...params} label="Сум/Дүүрэг" />
                )}
              />
            </Box>

            {/* Дэвсгэр нэр — dependent 3 түвшин */}
            <Typography variant="overline" color="text.secondary">
              Дэвсгэр нэр
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 0.5, maxWidth: 900 }}
            >
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 0 }}
                options={cat1Opts}
                value={cat1}
                onChange={(e, v) => handleCat(1, v)}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => <TextField {...params} label="Үндсэн" />}
              />
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 0 }}
                disabled={!cat1?.id}
                options={cat2Opts}
                value={cat2}
                onChange={(e, v) => handleCat(2, v)}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => <TextField {...params} label="Анхдагч" />}
              />
              <Autocomplete
                size="small"
                sx={{ flex: 1, minWidth: 0 }}
                disabled={!cat2?.id}
                options={cat3Opts}
                value={cat3}
                onChange={(e, v) => handleCat(3, v)}
                getOptionLabel={(o) => o?.name || ""}
                isOptionEqualToValue={(o, v) => o?.id === v?.id}
                renderInput={(params) => <TextField {...params} label="Дэд" />}
              />
            </Stack>
          </Box>
        </Collapse>

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <TableSelectedAction
            dense={table.dense}
            numSelected={table.selected.length}
            rowCount={filtered.length}
            onSelectAllRows={(checked) =>
              table.onSelectAllRows(checked, allIds)
            }
            action={
              <Tooltip title="Сонгосныг устгах">
                <IconButton color="error" onClick={handleDeleteSelected}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Tooltip>
            }
          />

          <Scrollbar>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHeadCustom
                headLabel={headLabel}
                rowCount={filtered.length}
                numSelected={table.selected.length}
                onSelectAllRows={(checked) =>
                  table.onSelectAllRows(checked, allIds)
                }
              />
              <TableBody>
                {paged.map((r) => {
                  const selected = table.selected.includes(r.id);
                  return (
                    <TableRow key={r.id} hover selected={selected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected}
                          onClick={() => table.onSelectRow(r.id)}
                        />
                      </TableCell>
                      {cols.map((c, ci) => (
                        <TableCell key={c.id}>
                          {dash(c.get(r))}
                          {ci === 0 && <GeomIcon geom={r.geom} />}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                <TableNoData notFound={notFound} />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={filtered.length}
          page={table.page}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.onChangePage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        Нэрлэвэр (1:25000/1:100000) нь цэгийн орон зайн байрлалаар олдоно.
      </Typography>
    </Box>
  );
}

MayagtView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  stepName: PropTypes.string,
};
