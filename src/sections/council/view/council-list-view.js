"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useDebounce } from "src/hooks/use-debounce";
import { useSettingsContext } from "src/components/settings";
import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetCouncils, useGetCouncilMembers } from "src/api/council";

import Iconify from "src/components/iconify";
import {
  useTable,
  TableNoData,
  TableHeadCustom,
  TablePaginationCustom,
} from "src/components/table";
import Scrollbar from "src/components/scrollbar";
import { useSnackbar } from "src/components/snackbar";
import CustomBreadcrumbs from "src/components/custom-breadcrumbs";
import CustomPopover, { usePopover } from "src/components/custom-popover";

// Зөвлөлийн мөрийн үйлдэл (засах) — босоо 3 цэгт цэс
function CouncilRowMenu({ onEdit }) {
  const popover = usePopover();
  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          popover.onOpen(e);
        }}
      >
        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>
      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        <MenuItem
          onClick={() => {
            onEdit();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Засах
        </MenuItem>
      </CustomPopover>
    </>
  );
}
CouncilRowMenu.propTypes = { onEdit: PropTypes.func };

// ----------------------------------------------------------------------
// LegalOrder (тогтоол/захирамж) сонгогч — баримтаар баталгаажуулна
// ----------------------------------------------------------------------
// Зөвлөлийн хүснэгтийн толгой — сортлох талбарууд
const COUNCIL_TABLE_HEAD = [
  { id: "name", label: "Нэр" },
  { id: "unit__parent__unit", label: "Харьяа", width: 240 },
  { id: "status__name", label: "Төлөв" },
  { id: "", width: 48 },
];

function LegalDocPicker({
  value,
  onChange,
  label = "Баримт (тогтоол/захирамж)",
}) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 350);
  const { data } = useSWR(
    dq && dq.trim().length >= 2
      ? [
          endpoints.legal.list(
            `search=${encodeURIComponent(dq.trim())}&page_size=20`,
          ),
          axiosInstance,
          "get",
        ]
      : null,
    fetcher,
    { shouldRetryOnError: false },
  );
  const options = data?.results || [];
  const loading = !!(dq && dq.trim().length >= 2 && !data);
  return (
    <Autocomplete
      fullWidth
      value={value}
      options={options}
      loading={loading}
      // Хайлт СЕРВЕР талд хийгддэг тул MUI‑ийн дотоод шүүлтийг унтраана.
      // (Эс бөгөөс signer/тайлбараар олдсон үр дүнг label‑д тохирохгүй гэж
      //  хаяж, "Олдсонгүй" гэж харуулдаг байсан.)
      filterOptions={(x) => x}
      onChange={(e, v) => onChange(v)}
      onInputChange={(e, v, r) => r === "input" && setQ(v)}
      getOptionLabel={(o) =>
        o?.name
          ? `${o.name}${o.order_number ? ` (${o.order_number})` : ""}`
          : ""
      }
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      noOptionsText={
        loading
          ? "Хайж байна…"
          : dq?.length >= 2
            ? "Олдсонгүй"
            : "Нэр, дугаар, төрөл, огноогоор хайх"
      }
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
}
LegalDocPicker.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func,
  label: PropTypes.string,
};

// ЗЗ нэгж dropdown (cascading)
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

// ----------------------------------------------------------------------

export default function CouncilListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const councilForm = useBoolean();
  // Формд нэмэх гишүүдийн мөрүүд (зөвлөл хадгалагдсаны дараа үүснэ)
  const [mrows, setMrows] = useState([]);
  const { constants: memberTypes } = useGetConstantsFordropdown("MEMBER_TYPES");

  // Засах үед — тухайн зөвлөлийн ОДОО байгаа гишүүдийг мөрүүдэд сет хийнэ
  const loadMrows = async (councilId) => {
    if (!councilId) {
      setMrows([]);
      return;
    }
    try {
      const res = await axiosInstance.get(
        endpoints.council.members(
          new URLSearchParams({ council: councilId, page_size: 200 }).toString(),
        ),
      );
      const list = res?.data?.results || [];
      setMrows(
        list.map((m, i) => {
          const parts = String(m.full_name || "").trim().split(/\s+/);
          return {
            key: `db_${m.id}_${i}`,
            id: m.id, // байгаа гишүүн — дахин үүсгэхгүй
            type_id: m.position?.id || "",
            register: m.register || "",
            last_name: parts.length > 1 ? parts[0] : "",
            first_name: parts.length > 1 ? parts.slice(1).join(" ") : parts[0] || "",
            email: "",
            phone: "",
            found: m.register ? true : false,
            checking: false,
          };
        }),
      );
    } catch (e) {
      setMrows([]);
    }
  };

  const addMrow = () =>
    setMrows((p) => [
      ...p,
      {
        key: `${Date.now()}_${p.length}`,
        type_id: "",
        register: "",
        last_name: "",
        first_name: "",
        email: "",
        phone: "",
        found: null, // null=шалгаагүй, true=олдсон, false=олдоогүй
        checking: false,
      },
    ]);
  const setMrow = (key, patch) =>
    setMrows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const delMrow = async (key) => {
    const row = mrows.find((r) => r.key === key);
    // Хадгалагдсан гишүүн бол серверээс ч устгана
    if (row?.id) {
      try {
        await axiosInstance.delete(endpoints.council.memberDelete(row.id));
        enqueueSnackbar("Гишүүн устгагдлаа");
        membersMutation && membersMutation();
        councilsMutation();
      } catch (e) {
        enqueueSnackbar("Устгах үед алдаа гарлаа", { variant: "warning" });
        return;
      }
    }
    setMrows((p) => p.filter((r) => r.key !== key));
  };

  // Регистр 10 тэмдэгт болмогц ХУР‑аас иргэнийг татна
  const lookupRegister = async (key, register) => {
    const reg = (register || "").trim();
    if (reg.length !== 10) {
      setMrow(key, { found: null });
      return;
    }
    setMrow(key, { checking: true });
    try {
      const res = await axiosInstance.post(endpoints.request.checkUser, {
        register: reg,
      });
      const d = res?.data?.results || res?.data || {};
      const last = d.last_name || d.lastname || d.surname || "";
      const first = d.first_name || d.firstname || d.name || "";
      if (last || first) {
        setMrow(key, {
          found: true,
          checking: false,
          last_name: last,
          first_name: first,
        });
      } else {
        setMrow(key, { found: false, checking: false });
      }
    } catch (e) {
      // Олдоогүй — гараар овог, нэр оруулна
      setMrow(key, { found: false, checking: false });
    }
  };

  const { constants: kinds } = useGetConstantsFordropdown("COUNCIL_KINDS");
  const { constants: statuses } = useGetConstantsFordropdown("COUNCIL_STATUS");
  const { constants: positions } =
    useGetConstantsFordropdown("COUNCIL_POSITIONS");

  // Хүснэгт — бусад жагсаалттай ижил (useTable + TableHeadCustom + пагинаци)
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "id",
    defaultRowsPerPage: 10,
  });
  const [cq, setCq] = useState("");
  const cdq = useDebounce(cq.trim(), 400);
  const councilBody = useMemo(
    () => ({
      page: table.page + 1,
      page_size: table.rowsPerPage,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...(cdq ? { search: cdq } : {}),
    }),
    [table.page, table.rowsPerPage, table.order, table.orderBy, cdq],
  );
  const { councils, councilsCount, councilsLoading, councilsMutation } =
    useGetCouncils(councilBody);

  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(false);
  const { members, membersMutation } = useGetCouncilMembers(
    selected?.id,
    !history,
  );

  // --- Council нэмэх/засах форм ---
  const emptyCouncil = {
    id: null,
    name: "",
    kind_id: "",
    status_id: "",
    established_date: "",
    established_doc: null,
  };
  const [cf, setCf] = useState(emptyCouncil);
  const [aimag, setAimag] = useState(null);
  const [sum, setSum] = useState(null);
  // UNITLEVEL Constant‑ийн нэр ЯГ таарах ёстой ("Аймаг" гэвэл хоосон буцна)
  const aimags = useUnits("Аймаг/Нийслэл", null, true);
  const sums = useUnits("Сум/Дүүрэг", aimag?.id, !!aimag?.id);

  const openCreate = () => {
    setMrows([]);
    setCf(emptyCouncil);
    setAimag(null);
    setSum(null);
    councilForm.onTrue();
  };
  const saveCouncil = async () => {
    if (!cf.name.trim()) {
      enqueueSnackbar("Нэр оруулна уу", { variant: "warning" });
      return;
    }
    const body = {
      name: cf.name,
      ...(cf.kind_id ? { kind_id: cf.kind_id } : {}),
      ...(cf.status_id ? { status_id: cf.status_id } : {}),
      ...(cf.established_date ? { established_date: cf.established_date } : {}),
      ...(cf.established_doc?.id
        ? { established_doc_id: cf.established_doc.id }
        : {}),
      unit_id: (sum || aimag)?.id || null,
    };
    try {
      let saved = null;
      if (cf.id) {
        const res = await axiosInstance.patch(
          endpoints.council.edit(cf.id),
          body,
        );
        saved = res?.data || null;
      } else {
        const res = await axiosInstance.post(endpoints.council.create, body);
        saved = res?.data || null;
      }
      enqueueSnackbar("Хадгаллаа");
      // Формд нэмсэн гишүүдийг зөвлөлд бүртгэнэ (томилсон баримт = байгуулсан
      // баримт, огноо = байгуулсан огноо)
      const cid = saved?.id || cf.id;
      // full_name ЗААВАЛ — нэргүй мөрийг илгээхгүй (backend 400 өгдөг)
      const fresh = mrows.filter((r) => !r.id); // байгаа гишүүнийг давхарлахгүй
      const rows = fresh.filter((r) =>
        `${r.last_name || ""} ${r.first_name || ""}`.trim(),
      );
      const skipped = fresh.length - rows.length;
      if (skipped) {
        enqueueSnackbar(`${skipped} мөрд овог/нэр бөглөөгүй тул алгаслаа`, {
          variant: "warning",
        });
      }
      if (cid && rows.length) {
        if (!cf.established_doc?.id) {
          enqueueSnackbar("Гишүүн бүртгэхэд «Байгуулсан баримт» шаардлагатай", {
            variant: "warning",
          });
        } else {
          // Салбар зөвлөл бол ролийн НЭГЖ = сонгосон нэгж
          const kindName =
            kinds.find((k) => String(k.id) === String(cf.kind_id))?.name || "";
          const unitId = (sum || aimag)?.id || null;
          try {
            await Promise.all(
              rows.map(async (r) => {
                // Регистрээр системийн хэрэглэгчийг олох/үүсгэх —
                // «Иргэн» + зөвлөлийн роль, салбар зөвлөлд нэгжийг нь онооно
                let personId = null;
                if (r.register) {
                  try {
                    const pr = await axiosInstance.post(
                      endpoints.council.ensurePerson,
                      {
                        register: r.register,
                        last_name: r.last_name || "",
                        first_name: r.first_name || "",
                        email: r.email || "",
                        phone: r.phone || "",
                        role: kindName,
                        ...(unitId ? { unit: unitId } : {}),
                      },
                    );
                    personId = pr?.data?.id || null;
                  } catch (e) {
                    /* хэрэглэгч үүсээгүй ч гишүүнийг бүртгэнэ */
                  }
                }
                return axiosInstance.post(endpoints.council.memberCreate, {
                  council: cid,
                  full_name:
                    `${r.last_name || ""} ${r.first_name || ""}`.trim(),
                  register: r.register || null,
                  ...(personId ? { person: personId } : {}),
                  ...(r.type_id ? { position_id: r.type_id } : {}),
                  start_date:
                    cf.established_date ||
                    new Date().toISOString().slice(0, 10),
                  appoint_doc_id: cf.established_doc.id,
                });
              }),
            );
            membersMutation && membersMutation();
          } catch (err) {
            const d = err?.response?.data;
            const msg =
              typeof d === "string"
                ? d
                : d?.detail ||
                  Object.entries(d || {})
                    .map(([k, v]) => `${k}: ${[].concat(v).join(", ")}`)
                    .join(" · ") ||
                  "Гишүүн бүртгэхэд алдаа гарлаа";
            enqueueSnackbar(msg, { variant: "warning" });
          }
        }
      }
      setMrows([]);
      councilForm.onFalse();
      councilsMutation();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Алдаа гарлаа", {
        variant: "error",
      });
    }
  };

  // --- Гишүүн нэмэх диалог ---
  const emptyMember = {
    full_name: "",
    register: "",
    position_id: "",
    org_title: "",
    start_date: "",
    appoint_doc: null,
  };
  const [mDlg, setMDlg] = useState(null);
  const saveMember = async () => {
    if (!mDlg.full_name.trim() || !mDlg.appoint_doc?.id || !mDlg.start_date) {
      enqueueSnackbar("Нэр, томилсон баримт, огноо заавал", {
        variant: "warning",
      });
      return;
    }
    try {
      await axiosInstance.post(endpoints.council.memberCreate, {
        council: selected.id,
        full_name: mDlg.full_name,
        register: mDlg.register || null,
        ...(mDlg.position_id ? { position_id: mDlg.position_id } : {}),
        org_title: mDlg.org_title || null,
        start_date: mDlg.start_date,
        appoint_doc_id: mDlg.appoint_doc.id,
      });
      enqueueSnackbar("Гишүүн нэмэгдлээ");
      setMDlg(null);
      membersMutation();
      councilsMutation();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Алдаа гарлаа", {
        variant: "error",
      });
    }
  };

  // Гишүүнийг БҮРМӨСӨН устгах (алдаатай бүртгэлийг арилгах)
  const [delMember, setDelMember] = useState(null);
  const deleteMember = async () => {
    if (!delMember?.id) return;
    try {
      await axiosInstance.delete(endpoints.council.memberDelete(delMember.id));
      enqueueSnackbar("Гишүүн устгагдлаа");
      setDelMember(null);
      membersMutation();
      councilsMutation();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Устгах үед алдаа", {
        variant: "warning",
      });
    }
  };

  // --- Гишүүн чөлөөлөх диалог ---
  const [rDlg, setRDlg] = useState(null); // {member, end_date, release_doc}
  const releaseMember = async () => {
    if (!rDlg.release_doc?.id) {
      enqueueSnackbar("Чөлөөлсөн баримт заавал", { variant: "warning" });
      return;
    }
    try {
      await axiosInstance.post(
        endpoints.council.memberRelease(rDlg.member.id),
        {
          release_doc_id: rDlg.release_doc.id,
          ...(rDlg.end_date ? { end_date: rDlg.end_date } : {}),
        },
      );
      enqueueSnackbar("Чөлөөллөө");
      setRDlg(null);
      membersMutation();
      councilsMutation();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Алдаа гарлаа", {
        variant: "error",
      });
    }
  };

  const docLabel = (d) =>
    d ? `${d.name}${d.order_number ? ` (${d.order_number})` : ""}` : "—";

  // Зөвлөл нэмэх/засах форм — DIALOG биш, мөрийн ДООР задарна
  const renderCouncilForm = (
    <Box sx={{ p: 2, bgcolor: "background.neutral" }}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "start",
        }}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Нэр"
            fullWidth
            value={cf.name}
            onChange={(e) => setCf((p) => ({ ...p, name: e.target.value }))}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Төрөл"
              value={cf.kind_id}
              onChange={(e) =>
                setCf((p) => ({ ...p, kind_id: e.target.value }))
              }
            >
              <MenuItem value="">—</MenuItem>
              {kinds.map((k) => (
                <MenuItem key={k.id} value={k.id}>
                  {k.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Төлөв"
              value={cf.status_id}
              onChange={(e) =>
                setCf((p) => ({ ...p, status_id: e.target.value }))
              }
            >
              <MenuItem value="">—</MenuItem>
              {statuses.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              fullWidth
              options={aimags}
              value={aimag}
              onChange={(e, v) => {
                setAimag(v);
                setSum(null);
              }}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderInput={(params) => (
                <TextField {...params} label="Аймаг/Нийслэл (салбар бол)" />
              )}
            />
            <Autocomplete
              fullWidth
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
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="date"
              label="Байгуулсан огноо"
              InputLabelProps={{ shrink: true }}
              fullWidth
              value={cf.established_date}
              onChange={(e) =>
                setCf((p) => ({ ...p, established_date: e.target.value }))
              }
            />
          </Stack>
          <LegalDocPicker
            label="Байгуулсан баримт"
            value={cf.established_doc}
            onChange={(v) => setCf((p) => ({ ...p, established_doc: v }))}
          />
        </Stack>

        {/* 2‑р багана — ГИШҮҮД */}
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="subtitle2">Гишүүд</Typography>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={addMrow}
            >
              Гишүүн
            </Button>
          </Stack>

          {mrows.map((r) => (
            <Stack
              key={r.key}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "flex-start" }}
            >
              <TextField
                select
                size="small"
                label="Оролцоо"
                sx={{ minWidth: 150 }}
                value={r.type_id}
                onChange={(e) => setMrow(r.key, { type_id: e.target.value })}
              >
                {memberTypes.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                label="Регистр"
                sx={{ minWidth: 140 }}
                value={r.register}
                inputProps={{ maxLength: 10 }}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setMrow(r.key, { register: v });
                  if (v.length === 10) lookupRegister(r.key, v);
                  else setMrow(r.key, { found: null });
                }}
                helperText={
                  r.checking
                    ? "Шалгаж байна…"
                    : r.found === true
                      ? "Иргэн олдлоо"
                      : r.found === false
                        ? "Олдсонгүй — гараар бөглөнө үү"
                        : " "
                }
              />

              {/* Олдсон бол зөвхөн харуулна, олдоогүй бол гараар бөглөнө */}
              {r.found === true ? (
                <TextField
                  size="small"
                  label="Овог, нэр"
                  fullWidth
                  value={`${r.last_name} ${r.first_name}`.trim()}
                  InputProps={{ readOnly: true }}
                />
              ) : (
                r.found === false && (
                  <>
                    <TextField
                      size="small"
                      label="Овог"
                      fullWidth
                      value={r.last_name}
                      onChange={(e) =>
                        setMrow(r.key, { last_name: e.target.value })
                      }
                    />
                    <TextField
                      size="small"
                      label="Нэр"
                      fullWidth
                      value={r.first_name}
                      onChange={(e) =>
                        setMrow(r.key, { first_name: e.target.value })
                      }
                    />
                    <TextField
                      size="small"
                      label="Имэйл"
                      fullWidth
                      value={r.email}
                      onChange={(e) =>
                        setMrow(r.key, { email: e.target.value })
                      }
                    />
                    <TextField
                      size="small"
                      label="Утас"
                      fullWidth
                      value={r.phone}
                      onChange={(e) =>
                        setMrow(r.key, { phone: e.target.value })
                      }
                    />
                  </>
                )
              )}

              <IconButton
                size="small"
                color="error"
                onClick={() => delMrow(r.key)}
                sx={{ mt: 0.5 }}
              >
                <Iconify icon="solar:trash-bin-trash-bold" width={18} />
              </IconButton>
            </Stack>
          ))}
          {!mrows.length && (
            <Typography variant="caption" color="text.secondary">
              Гишүүн нэмэхийн тулд «+ Гишүүн» дарна уу.
            </Typography>
          )}
        </Stack>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        justifyContent="flex-end"
        sx={{ mt: 2 }}
      >
        <Button
          variant="contained"
          color="inherit"
          onClick={councilForm.onFalse}
        >
          Болих
        </Button>
        <Button variant="contained" color="primary" onClick={saveCouncil}>
          Хадгалах
        </Button>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Газар зүйн нэрийн зөвлөл"
        links={[{ name: "Дашбоард" }, { name: "Зөвлөлийн сан" }]}
      />

      {/* Зөвлөлийн жагсаалт */}
      <Card>
        {/* Toolbar — хайлт + нэмэх (constant‑listview‑тэй ижил padding) */}
        <Stack
          spacing={2}
          alignItems={{ xs: "stretch", md: "center" }}
          direction={{ xs: "column", md: "row" }}
          sx={{ p: 2.5, pr: { xs: 2.5, md: 1 } }}
        >
          <TextField
            fullWidth
            placeholder="Нэрээр..."
            value={cq}
            onChange={(e) => {
              setCq(e.target.value);
              table.onResetPage();
            }}
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
          <Tooltip title="Зөвлөл нэмэх">
            <IconButton color="primary" onClick={openCreate}>
              <Iconify icon="mingcute:add-line" />
            </IconButton>
          </Tooltip>
        </Stack>

        <TableContainer sx={{ position: "relative", overflow: "unset" }}>
          <Scrollbar>
            <Table
              size={table.dense ? "small" : "medium"}
              sx={{ minWidth: 800 }}
            >
              <TableHeadCustom
                headLabel={COUNCIL_TABLE_HEAD}
                //
                order={table.order}
                onSort={table.onSort}
                orderBy={table.orderBy}
              />
              <TableBody>
                {councils.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    selected={selected?.id === c.id}
                    sx={{ cursor: "pointer" }}
                    onClick={() =>
                      setSelected((prev) => (prev?.id === c.id ? null : c))
                    }
                  >
                    {/* Нэр + гишүүдийн тоо. Үндэсний зөвлөл — УЛААН, бусад нь энгийн */}
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box
                          component="span"
                          sx={{
                            color: (c.kind?.name || "").includes("Үндэсний")
                              ? "error.main"
                              : "text.primary",
                            fontWeight: (c.kind?.name || "").includes("Үндэсний")
                              ? 700
                              : 500,
                          }}
                          title={c.kind?.name || ""}
                        >
                          {c.name}
                        </Box>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.25}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected((prev) =>
                              prev?.id === c.id ? null : c,
                            );
                          }}
                          title={
                            selected?.id === c.id
                              ? "Гишүүдийг хаах"
                              : "Гишүүдийг харах"
                          }
                          sx={{
                            cursor: "pointer",
                            px: 0.5,
                            borderRadius: 1,
                            color:
                              selected?.id === c.id
                                ? "primary.main"
                                : "text.secondary",
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                        >
                          <Iconify
                            icon="solar:users-group-rounded-bold"
                            width={16}
                          />
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 700 }}
                          >
                            {c.member_count ?? 0}
                          </Typography>
                        </Stack>
                      </Stack>
                    </TableCell>
                    {/* Харьяа — нэгжийг chip‑ээр (сум бол аймаг + сум) */}
                    <TableCell>
                      {!c.unit ? (
                        <Chip
                          size="small"
                          variant="soft"
                          color="error"
                          label="Үндэсний"
                          sx={{ height: 22 }}
                        />
                      ) : (
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          <Chip
                            size="small"
                            variant="soft"
                            color="primary"
                            label={c.unit.parent_unit || c.unit.unit}
                            sx={{ height: 22 }}
                          />
                          {c.unit.parent_unit && (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={c.unit.unit}
                              sx={{ height: 22 }}
                            />
                          )}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.status?.name ? (
                        <Chip
                          size="small"
                          label={c.status.name}
                          variant="outlined"
                        />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CouncilRowMenu
                        onEdit={() => {
                          setCf({
                            id: c.id,
                            name: c.name || "",
                            kind_id: c.kind?.id || "",
                            status_id: c.status?.id || "",
                            established_date: c.established_date || "",
                            established_doc: c.established_doc || null,
                          });
                          // Харьяа нэгжийг СЕТ хийнэ: сум бол эцэг аймаг +
                          // сум, аймгийн түвшний бол зөвхөн аймаг
                          if (c.unit?.parent_unit) {
                            setAimag({
                              id: c.unit.parent,
                              unit: c.unit.parent_unit,
                            });
                            setSum({ id: c.unit.id, unit: c.unit.unit });
                          } else if (c.unit) {
                            setAimag({ id: c.unit.id, unit: c.unit.unit });
                            setSum(null);
                          } else {
                            setAimag(null);
                            setSum(null);
                          }
                          loadMrows(c.id);
                          councilForm.onTrue();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {/* Засах/нэмэх форм — сонгосон мөрийн ЯГ доор */}
                {councilForm.value && (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ p: 0, borderBottom: "none" }}>
                      <Collapse in unmountOnExit>
                        {renderCouncilForm}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
                <TableNoData
                  notFound={!councilsLoading && councils.length === 0}
                />
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>

        <TablePaginationCustom
          count={councilsCount}
          //
          page={table.page}
          onPageChange={table.onChangePage}
          //
          rowsPerPage={table.rowsPerPage}
          onRowsPerPageChange={table.onChangeRowsPerPage}
          //
          dense={table.dense}
          onChangeDense={table.onChangeDense}
        />
      </Card>

      {/* Сонгосон зөвлөлийн гишүүд */}
      {selected && (
        <Card sx={{ p: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="h6">{selected.name} — бүрэлдэхүүн</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={history}
                    onChange={(e) => setHistory(e.target.checked)}
                  />
                }
                label="Бүх түүх"
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setMDlg(emptyMember)}
              >
                Гишүүн нэмэх
              </Button>
            </Stack>
          </Stack>
          <Divider sx={{ mb: 1 }} />
          <TableContainer>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Нэр</TableCell>
                    <TableCell>Албан тушаал</TableCell>
                    <TableCell>Төлөөлж буй</TableCell>
                    <TableCell>Эхэлсэн</TableCell>
                    <TableCell>Дууссан</TableCell>
                    <TableCell>Томилсон баримт</TableCell>
                    <TableCell>Чөлөөлсөн баримт</TableCell>
                    <TableCell width={48} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((m) => (
                    <TableRow
                      key={m.id}
                      hover
                      sx={{ opacity: m.is_active ? 1 : 0.55 }}
                    >
                      <TableCell>
                        {m.full_name}
                        {m.register ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {m.register}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{m.position?.name || "—"}</TableCell>
                      <TableCell>{m.org_title || "—"}</TableCell>
                      <TableCell>{m.start_date || "—"}</TableCell>
                      <TableCell>
                        {m.is_active ? (
                          <Chip
                            size="small"
                            color="success"
                            label="идэвхтэй"
                            variant="outlined"
                          />
                        ) : (
                          m.end_date
                        )}
                      </TableCell>
                      <TableCell>{docLabel(m.appoint_doc)}</TableCell>
                      <TableCell>{docLabel(m.release_doc)}</TableCell>
                      <TableCell>
                        {m.is_active && (
                          <Tooltip title="Баримтаар чөлөөлөх">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() =>
                                setRDlg({
                                  member: m,
                                  end_date: "",
                                  release_doc: null,
                                })
                              }
                            >
                              <Iconify icon="solar:logout-3-bold" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Устгах">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDelMember(m)}
                          >
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          {history ? "Түүх алга." : "Идэвхтэй гишүүн алга."}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>
      )}

      {/* Зөвлөл нэмэх/засах диалог */}
      {/* Гишүүн устгах баталгаа */}
      <Dialog open={!!delMember} onClose={() => setDelMember(null)}>
        <DialogTitle>Гишүүн устгах</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <b>{delMember?.full_name}</b> гишүүнийг бүрмөсөн устгах уу? Энэ нь
            томилгооны түүхээс ч арилна — чөлөөлөх бол «Баримтаар чөлөөлөх»‑ийг
            ашиглана уу.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDelMember(null)}>
            Болих
          </Button>
          <Button variant="contained" color="error" onClick={deleteMember}>
            Устгах
          </Button>
        </DialogActions>
      </Dialog>

      {/* Гишүүн нэмэх диалог */}
      <Dialog
        open={!!mDlg}
        onClose={() => setMDlg(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Гишүүн нэмэх (баримтаар)</DialogTitle>
        {mDlg && (
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Овог нэр"
                  fullWidth
                  value={mDlg.full_name}
                  onChange={(e) =>
                    setMDlg((p) => ({ ...p, full_name: e.target.value }))
                  }
                />
                <TextField
                  label="Регистр"
                  value={mDlg.register}
                  onChange={(e) =>
                    setMDlg((p) => ({ ...p, register: e.target.value }))
                  }
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  select
                  fullWidth
                  label="Албан тушаал"
                  value={mDlg.position_id}
                  onChange={(e) =>
                    setMDlg((p) => ({ ...p, position_id: e.target.value }))
                  }
                >
                  <MenuItem value="">—</MenuItem>
                  {positions.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="date"
                  label="Томилогдсон огноо"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  value={mDlg.start_date}
                  onChange={(e) =>
                    setMDlg((p) => ({ ...p, start_date: e.target.value }))
                  }
                />
              </Stack>
              <TextField
                label="Төлөөлж буй албан тушаал"
                fullWidth
                value={mDlg.org_title}
                onChange={(e) =>
                  setMDlg((p) => ({ ...p, org_title: e.target.value }))
                }
              />
              <LegalDocPicker
                label="Томилсон баримт (заавал)"
                value={mDlg.appoint_doc}
                onChange={(v) => setMDlg((p) => ({ ...p, appoint_doc: v }))}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button color="inherit" onClick={() => setMDlg(null)}>
            Болих
          </Button>
          <Button variant="contained" onClick={saveMember}>
            Нэмэх
          </Button>
        </DialogActions>
      </Dialog>

      {/* Гишүүн чөлөөлөх диалог */}
      <Dialog
        open={!!rDlg}
        onClose={() => setRDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Гишүүн чөлөөлөх</DialogTitle>
        {rDlg && (
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 1 }}>
              &quot;{rDlg.member.full_name}&quot;-г чөлөөлнө. Баримт заавал.
            </Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                type="date"
                label="Чөлөөлсөн огноо (хоосон бол өнөөдөр)"
                InputLabelProps={{ shrink: true }}
                fullWidth
                value={rDlg.end_date}
                onChange={(e) =>
                  setRDlg((p) => ({ ...p, end_date: e.target.value }))
                }
              />
              <LegalDocPicker
                label="Чөлөөлсөн баримт (заавал)"
                value={rDlg.release_doc}
                onChange={(v) => setRDlg((p) => ({ ...p, release_doc: v }))}
              />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button color="inherit" onClick={() => setRDlg(null)}>
            Болих
          </Button>
          <Button variant="contained" color="warning" onClick={releaseMember}>
            Чөлөөлөх
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
