"use client";

import PropTypes from "prop-types";
import { useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Alert,
  Button,
  Divider,
  Tooltip,
  Collapse,
  TextField,
  IconButton,
  Typography,
  Autocomplete,
  InputAdornment,
  LinearProgress,
  CircularProgress,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { fold } from "src/utils/fold-search";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetLegalUnits } from "src/api/legal";
import { useGetRecountForms } from "src/api/recount";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

// ----------------------------------------------------------------------
// Баримт ↔ нэр холбох (нэг баримтын доор задардаг хэсэг)
//
// Өмнө нь энэ хэсэг «Маягтууд» табын toolbar дотор байсан бөгөөд баримтаа
// автокомплитоос хайж олдог байв. Одоо Суурин судалгаа → «Баримт бичгийн
// холболт» жагсаалтад БАРИМТ нь сонгогдсон байдаг тул энд зөвхөн НЭР сонгоно:
//
//  1) Нэрийн сан = тухайн төслийн (алхмын) тодруулалтын мөрүүд — маягтаар
//     нарийсгаж болно (Бүгд / Маягт 1..9).
//  2) Шүүлтүүр (toggle) — аймаг/сум (орон зайгаар, backend), нэрийн ангилал
//     буюу дэвсгэр нэр (3 түвшний dependent, backend) ба нэрлэвэр (client).
//     Шүүлтээр нарийссан сангаас Autocomplete нь нэр, зураг дээрх нэр,
//     нэрлэвэр гурвуулангаар хайна (латин/кирилл хольцыг fold() жигдрүүлнэ).
//  3) «Холбох» → LegalOrder.names (M2M) дээр нэмэгдэнэ. Аль хэдийн
//     холбоотойг тэмдэглээд давхардуулахгүй; chip дээрх ✕‑ээр салгана.
// ----------------------------------------------------------------------

const FORM_LABEL = {
  1: "Маягт 1",
  2: "Маягт 2",
  3: "Маягт 3",
  4: "Маягт 4",
  5: "Маягт 5",
  6: "Маягт 6",
  8: "Маягт 8",
  9: "Маягт 9",
};

export default function AttachNamePanel({
  projectId,
  order,
  stepName = "Суурин судалгаа",
  onChanged,
}) {
  const { enqueueSnackbar } = useSnackbar();

  const { constants: steps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const stepObj = useMemo(
    () => steps.find((s) => s.name === stepName) || null,
    [steps, stepName],
  );

  const [tab, setTab] = useState("all"); // нэрийн санг маягтаар нарийсгах
  const [filterOpen, setFilterOpen] = useState(false);
  const [aimag, setAimag] = useState(null);
  const [sum, setSum] = useState(null);
  const [qNomek, setQNomek] = useState(""); // нэрлэвэр — client талд
  // Нэрийн ангилал (дэвсгэр нэр) — Үндсэн → Анхдагч → Дэд, dependent 3 түвшин
  const [cat1, setCat1] = useState(null);
  const [cat2, setCat2] = useState(null);
  const [cat3, setCat3] = useState(null);
  const [cat1Opts, setCat1Opts] = useState([]);
  const [cat2Opts, setCat2Opts] = useState([]);
  const [cat3Opts, setCat3Opts] = useState([]);
  const typeFilterId = cat3?.id || cat2?.id || cat1?.id || null;
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState({ count: 0, results: [] });
  const [linkedHere, setLinkedHere] = useState(new Set());

  const { units: aimagOpts } = useGetLegalUnits("Аймаг/Нийслэл", null, true);
  const { units: sumOpts } = useGetLegalUnits(
    "Сум/Дүүрэг",
    aimag?.id,
    !!aimag?.id,
  );

  // Нэрийн ангиллын түвшин бүрийг эцгээр нь татна (parent=null → Үндсэн)
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
    let alive = true;
    fetchCats(null).then((v) => {
      if (alive) setCat1Opts(v);
    });
    return () => {
      alive = false;
    };
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

  const hasFilter = !!(aimag?.id || sum?.id || typeFilterId || qNomek);

  const clearFilters = useCallback(() => {
    setAimag(null);
    setSum(null);
    setQNomek("");
    setCat1(null);
    setCat2(null);
    setCat3(null);
    setCat2Opts([]);
    setCat3Opts([]);
  }, []);

  // Тухайн төслийн тодруулалтын мөрүүд (маягтаар бүлэглэгдсэн).
  // Аймаг/сум/ангилал нь backend талд шүүгдэнэ (аймаг/сум — орон зайгаар).
  // `tab` дамжуулахгүй тул шүүлт БҮХ маягтад үйлчилнэ (эндээс нэрийг маягт
  // харгалзахгүй сонгодог).
  const { forms, formsLoading } = useGetRecountForms({
    projectId,
    step: stepObj?.id,
    sum: sum?.id,
    aimag: aimag?.id,
    type: typeFilterId,
  });

  // Нэрлэвэрийн шүүлт — мөр бүрд nomek_25k/100k аль хэдийн ирсэн тул client
  // талд шүүнэ (сервер рүү дахин явахгүй, шууд хариу үзүүлнэ).
  const formsN = useMemo(() => {
    const sn = fold(qNomek);
    if (!sn) return forms || {};
    const out = {};
    Object.keys(forms || {}).forEach((k) => {
      out[k] = (forms[k] || []).filter(
        (r) =>
          fold(r.nomek_25k).includes(sn) || fold(r.nomek_100k).includes(sn),
      );
    });
    return out;
  }, [forms, qNomek]);

  // Маягтын шүүлт (chip) — зөвхөн мөр БАЙГАА маягтуудыг харуулна
  const formKeys = useMemo(
    () =>
      Object.keys(formsN || {})
        .filter((k) => (formsN?.[k] || []).length)
        .sort((a, b) => Number(a) - Number(b)),
    [formsN],
  );

  // Сонгосон маягт шүүлтээр хоосорвол «Бүгд» рүү буцаана (мухар табд гацахгүй)
  useEffect(() => {
    if (tab !== "all" && !formKeys.includes(tab)) setTab("all");
  }, [tab, formKeys]);

  const rows = useMemo(() => {
    const keys = tab === "all" ? formKeys : [tab];
    return keys.flatMap((k) => formsN?.[k] || []);
  }, [formsN, formKeys, tab]);

  // Мөрүүд → нэрийн сонголт (name_id‑гээр давхардлыг арилгана)
  const options = useMemo(() => {
    const seen = new Map();
    rows.forEach((r) => {
      if (!r?.name_id || seen.has(r.name_id)) return;
      seen.set(r.name_id, {
        id: r.name_id,
        label: r.name || r.draft || "—",
        draft: r.draft || "",
        nomek: [r.nomek_100k, r.nomek_25k].filter(Boolean).join(" · "),
      });
    });
    return [...seen.values()];
  }, [rows]);

  // Зарим мөр (шинэ нэр) GeoName‑д холбогдоогүй байдаг — тэднийг холбох боломжгүй
  const noNameCount = useMemo(
    () => rows.filter((r) => !r?.name_id).length,
    [rows],
  );

  // Баримт солигдоход сонголтоо цэвэрлэнэ
  useEffect(() => {
    setPicked([]);
  }, [order?.id]);

  // Сонгосон баримтад холбоотой нэрс (нийт тоо + эхний 500)
  const loadLinked = useCallback(async (id) => {
    if (!id) {
      setLinked({ count: 0, results: [] });
      return;
    }
    try {
      const res = await axiosInstance.get(endpoints.geoname.orderNames(id));
      setLinked({
        count: res?.data?.count || 0,
        results: res?.data?.results || [],
      });
    } catch (e) {
      setLinked({ count: 0, results: [] });
    }
  }, []);

  useEffect(() => {
    loadLinked(order?.id);
  }, [order?.id, loadLinked]);

  // Жагсаалтад харагдаж буй нэрсээс АЛЬ нь энэ баримтад аль хэдийн холбоотойг
  // серверээс шалгана. (Нэг баримтад 200мянга+ нэр холбогдсон байж болох тул
  // бүтэн жагсаалтаас биш, зөвхөн огтлолцлоор.)
  useEffect(() => {
    let alive = true;
    if (!order?.id || !options.length) {
      setLinkedHere(new Set());
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const res = await axiosInstance.post(endpoints.geoname.orderLinked, {
          order: order.id,
          project: projectId,
          names: options.map((o) => o.id),
        });
        if (alive) setLinkedHere(new Set(res?.data?.linked || []));
      } catch (e) {
        if (alive) setLinkedHere(new Set());
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [order?.id, options, projectId, linked]);

  const linkedIds = useMemo(
    () => new Set([...(linked.results || []).map((n) => n.id), ...linkedHere]),
    [linked, linkedHere],
  );

  // Хайлт: нэр + зураг дээрх нэр + нэрлэвэр (fold‑оор)
  const filterOptions = useCallback((opts, { inputValue }) => {
    const s = fold(inputValue);
    const hit = s
      ? opts.filter(
          (o) =>
            fold(o.label).includes(s) ||
            fold(o.draft).includes(s) ||
            fold(o.nomek).includes(s),
        )
      : opts;
    return hit.slice(0, 50); // ихээр рендэрлэхгүй (жагсаалт 700+ байж болно)
  }, []);

  const pickAll = useCallback(() => {
    setPicked((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...options.filter((o) => !seen.has(o.id))];
    });
  }, [options]);

  const newOnes = picked.filter((p) => !linkedIds.has(p.id));

  // Энэ ЖАГСААЛТААС аль нэрс нь холбогдсон бэ (215мянган нэртэй баримтын
  // бүтэн жагсаалтыг харуулах нь утгагүй — хамааралтайг нь л chip‑дэнэ)
  const linkedFromList = useMemo(
    () => options.filter((o) => linkedIds.has(o.id)),
    [options, linkedIds],
  );

  const handleAttach = async () => {
    if (!order?.id || !picked.length) return;
    setBusy(true);
    try {
      const res = await axiosInstance.post(endpoints.geoname.attachOrder, {
        order: order.id,
        project: projectId,
        names: picked.map((p) => p.id),
      });
      const { added = 0, skipped = 0 } = res?.data || {};
      enqueueSnackbar(
        `${added} нэр холбогдлоо` +
          (skipped ? ` · ${skipped} нь аль хэдийн холбоотой байсан` : ""),
        { variant: added ? "success" : "info" },
      );
      setPicked([]);
      await loadLinked(order.id);
      onChanged?.();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Холбоход алдаа гарлаа",
        { variant: "warning" },
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDetach = async (nameId) => {
    if (!order?.id) return;
    try {
      await axiosInstance.post(endpoints.geoname.detachOrder, {
        order: order.id,
        project: projectId,
        names: [nameId],
      });
      await loadLinked(order.id);
      enqueueSnackbar("Салгалаа");
      onChanged?.();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Салгахад алдаа гарлаа",
        { variant: "warning" },
      );
    }
  };

  if (!order?.id) return null;

  return (
    <Box sx={{ px: 2, py: 2, bgcolor: "background.neutral", borderRadius: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ flexWrap: "wrap", gap: 1 }}
      >
        <Typography variant="overline" color="text.secondary">
          Нэр холбох
        </Typography>
        <Tooltip title="Шүүлтүүр (аймаг/сум/ангилал/нэрлэвэр)">
          <IconButton
            size="small"
            color={filterOpen || hasFilter ? "primary" : "default"}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Iconify icon="mdi:filter-variant" width={20} />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Санд нийт {linked.count} нэр холбоотой
        </Typography>
      </Stack>

      {/* Шүүлтүүр — аймаг/сум ба ангилал нь backend, нэрлэвэр нь client талд */}
      <Collapse in={filterOpen} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
          <Box
            gap={1.5}
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr 1fr" }}
          >
            <Autocomplete
              size="small"
              options={aimagOpts}
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
              options={sumOpts}
              value={sum}
              disabled={!aimag?.id}
              onChange={(e, v) => setSum(v)}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Сум/Дүүрэг" />
              )}
            />
            <TextField
              size="small"
              label="Нэрлэвэр"
              placeholder="ж: M-47-73-Б"
              value={qNomek}
              onChange={(e) => setQNomek(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify
                      icon="mdi:grid-large"
                      sx={{ color: "text.disabled" }}
                    />
                  </InputAdornment>
                ),
                endAdornment: qNomek ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQNomek("")}>
                      <Iconify icon="eva:close-fill" width={16} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>

          {/* Нэрийн ангилал (дэвсгэр нэр) — dependent 3 түвшин */}
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: "block", mt: 1.5 }}
          >
            Нэрийн ангилал
          </Typography>
          <Box
            gap={1.5}
            display="grid"
            gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr 1fr" }}
            sx={{ mt: 0.5 }}
          >
            <Autocomplete
              size="small"
              options={cat1Opts}
              value={cat1}
              onChange={(e, v) => handleCat(1, v)}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => <TextField {...params} label="Үндсэн" />}
            />
            <Autocomplete
              size="small"
              disabled={!cat1?.id}
              options={cat2Opts}
              value={cat2}
              onChange={(e, v) => handleCat(2, v)}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Анхдагч" />
              )}
            />
            <Autocomplete
              size="small"
              disabled={!cat2?.id}
              options={cat3Opts}
              value={cat3}
              onChange={(e, v) => handleCat(3, v)}
              getOptionLabel={(o) => o?.name || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => <TextField {...params} label="Дэд" />}
            />
          </Box>

          {hasFilter && (
            <Button
              size="small"
              color="inherit"
              sx={{ mt: 1 }}
              startIcon={<Iconify icon="mdi:filter-remove-outline" />}
              onClick={clearFilters}
            >
              Шүүлт цэвэрлэх
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Нэрийн санг маягтаар нарийсгах */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1, mb: 1.5, flexWrap: "wrap", gap: 1 }}
      >
        <Chip
          label={`Бүгд · ${options.length}`}
          color={tab === "all" ? "primary" : "default"}
          variant={tab === "all" ? "filled" : "outlined"}
          onClick={() => setTab("all")}
        />
        {formKeys.map((k) => (
          <Chip
            key={k}
            label={`${FORM_LABEL[k] || `Маягт ${k}`} · ${formsN[k].length}`}
            color={tab === k ? "primary" : "default"}
            variant={tab === k ? "filled" : "outlined"}
            onClick={() => setTab(k)}
          />
        ))}
      </Stack>

      {formsLoading && <LinearProgress sx={{ mb: 1.5 }} />}

      <Stack spacing={1.5}>
        {/* Нэр — тухайн төслийн тодруулалтын жагсаалтаас */}
        <Autocomplete
          multiple
          disableCloseOnSelect
          value={picked}
          options={options}
          onChange={(e, v) => setPicked(v)}
          filterOptions={filterOptions}
          getOptionLabel={(o) => o?.label || ""}
          isOptionEqualToValue={(o, v) => o?.id === v?.id}
          noOptionsText="Тодруулалтын жагсаалтаас олдсонгүй"
          renderOption={(props, o) => (
            <li {...props} key={o.id}>
              <Stack sx={{ py: 0.25, width: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">{o.label}</Typography>
                  {linkedIds.has(o.id) && (
                    <Chip color="success" variant="soft" label="холбоотой" />
                  )}
                </Stack>
                {o.nomek && (
                  <Typography variant="caption" color="text.secondary">
                    {o.nomek}
                  </Typography>
                )}
              </Stack>
            </li>
          )}
          renderTags={(value, getTagProps) =>
            value.map((o, i) => (
              <Chip
                {...getTagProps({ index: i })}
                key={o.id}
                label={o.label}
                color={linkedIds.has(o.id) ? "default" : "primary"}
                variant={linkedIds.has(o.id) ? "outlined" : "soft"}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Нэр (нэр / зураг дээрх нэр / нэрлэвэрээр хайх)"
              placeholder="жишээ: Товхон толгой эсвэл M-47-85-Б"
            />
          )}
        />

        {/* Түргэн сонголт + холбох */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          <Button
            variant="outlined"
            disabled={!options.length}
            startIcon={<Iconify icon="mdi:playlist-plus" />}
            onClick={pickAll}
          >
            Жагсаалтад багтсан бүгд ({options.length})
          </Button>
          {!!picked.length && (
            <Button color="inherit" onClick={() => setPicked([])}>
              Цэвэрлэх
            </Button>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Button
            variant="contained"
            disabled={!picked.length || busy}
            startIcon={
              busy ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Iconify icon="mdi:link-variant-plus" />
              )
            }
            onClick={handleAttach}
          >
            Холбох{newOnes.length ? ` (${newOnes.length})` : ""}
          </Button>
        </Stack>

        {!!noNameCount && (
          <Typography variant="caption" color="warning.main">
            {noNameCount} мөр газар зүйн нэртэй холбогдоогүй (шинэ нэр) тул
            сонголтод харагдахгүй.
          </Typography>
        )}

        {!!picked.length && picked.length !== newOnes.length && (
          <Alert severity="info" sx={{ py: 0 }}>
            Сонгосон {picked.length}‑аас {picked.length - newOnes.length} нь аль
            хэдийн холбоотой — давхардуулахгүй.
          </Alert>
        )}

        {/* Одоо холбоотой нэрс */}
        <Divider />
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ flexWrap: "wrap", gap: 0.75 }}
        >
          <Typography variant="caption" color="text.secondary">
            Энэ жагсаалтаас холбогдсон: {linkedFromList.length}
          </Typography>
          {linkedFromList.slice(0, 30).map((o) => (
            <Chip
              key={o.id}
              variant="outlined"
              label={o.label}
              onDelete={() => handleDetach(o.id)}
            />
          ))}
          {linkedFromList.length > 30 && (
            <Typography variant="caption" color="text.secondary">
              +{linkedFromList.length - 30} …
            </Typography>
          )}
          {!linkedFromList.length && (
            <Typography variant="caption" color="text.disabled">
              — тодруулалтын нэрсээс аль нь ч холбогдоогүй
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

AttachNamePanel.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  order: PropTypes.object,
  stepName: PropTypes.string,
  onChanged: PropTypes.func,
};
