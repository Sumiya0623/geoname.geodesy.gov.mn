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
  TextField,
  Typography,
  Autocomplete,
  LinearProgress,
  CircularProgress,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { fold } from "src/utils/fold-search";
import { useGetConstantsFordropdown } from "src/api/constant";
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
//  2) Хайхад нэр, зураг дээрх нэр, 1:25000/1:100000 нэрлэвэр гурвуулан
//     ажиллана (латин/кирилл хольцыг fold() жигдрүүлнэ).
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
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState({ count: 0, results: [] });
  const [linkedHere, setLinkedHere] = useState(new Set());

  // Тухайн төслийн тодруулалтын мөрүүд (маягтаар бүлэглэгдсэн).
  // URL нь «Маягтууд» табынхтай ижил тул SWR кэш дундаа ашиглагдана.
  const { forms, formsLoading } = useGetRecountForms({
    projectId,
    step: stepObj?.id,
  });

  // Маягтын шүүлт (chip) — зөвхөн мөр БАЙГАА маягтуудыг харуулна
  const formKeys = useMemo(
    () =>
      Object.keys(forms || {})
        .filter((k) => (forms?.[k] || []).length)
        .sort((a, b) => Number(a) - Number(b)),
    [forms],
  );

  const rows = useMemo(() => {
    const keys = tab === "all" ? formKeys : [tab];
    return keys.flatMap((k) => forms?.[k] || []);
  }, [forms, formKeys, tab]);

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
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Санд нийт {linked.count} нэр холбоотой
        </Typography>
      </Stack>

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
            label={`${FORM_LABEL[k] || `Маягт ${k}`} · ${forms[k].length}`}
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
