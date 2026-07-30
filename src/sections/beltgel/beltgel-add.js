"use client";

import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Table,
  Button,
  Divider,
  MenuItem,
  TableRow,
  TableBody,
  TableCell,
  TextField,
  Typography,
  IconButton,
  TableContainer,
  CircularProgress,
} from "@mui/material";

import Scrollbar from "src/components/scrollbar";
import { useTable, TableNoData, TableHeadCustom } from "src/components/table";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useDebounce } from "src/hooks/use-debounce";
import {
  useGetLegalOrders,
  useGetLegalTypes,
  useGetLegalUnits,
} from "src/api/legal";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

import LegalNewEditForm from "src/sections/legal/legal-new-edit-form";

// ----------------------------------------------------------------------
// Бэлтгэл — орд нэмэх: ЭХЛЭЭД сангаас (одоо байгаа бүх LegalOrder) төрөл, нэр,
// дугаар, огноогоор хайж, олдвол тухайн төсөлд холбоно. Олдохгүй бол "Шинээр
// үүсгэх" форм. projectId байхгүй бол шууд үүсгэх форм (ерөнхий /dashboard/legal).
// ----------------------------------------------------------------------

const emptyCriteria = {
  org: "",
  name: "",
  order_number: "",
  order_date: "",
  unit_name: "", // ЗЗ нэгжийн нэрээр (аймаг/сум)
  aimag: "",
  sum: "",
};

// "Сум, дүүрэг" төрөл сонгогдсон эсэх — тэр үед аймаг/сум сонгуулна
const isSumOrg = (types, id) => {
  const t = (types || []).find((x) => String(x.id) === String(id));
  const nm = String(t?.label || t?.name || "");
  return nm.includes("Сум") || nm.includes("сум");
};

export default function BeltgelAdd({ projectId, onDone, onClose }) {
  const { enqueueSnackbar } = useSnackbar();

  const [criteria, setCriteria] = useState(emptyCriteria);
  const [busyId, setBusyId] = useState(null);
  const [attached, setAttached] = useState(() => new Set());
  const [creating, setCreating] = useState(false);

  const { legalTypes } = useGetLegalTypes();

  const sumSelected = isSumOrg(legalTypes, criteria.org);
  // Толгой — "Сум, дүүрэг" үед Аймаг/Сум эхэлж, дараа нь ерөнхий баганууд
  const HEAD = sumSelected
    ? [
        { id: "aimag", label: "Аймаг", width: 130 },
        { id: "sum", label: "Сум/Дүүрэг", width: 130 },
        { id: "name", label: "Нэр" },
        { id: "order_number", label: "Дугаар" },
        { id: "order_date", label: "Огноо" },
        { id: "", width: 48 },
      ]
    : [
        { id: "org", label: "Төрөл", width: 150 },
        { id: "unit", label: "Нэгж", width: 150 },
        { id: "name", label: "Нэр" },
        { id: "order_number", label: "Дугаар" },
        { id: "order_date", label: "Огноо" },
        { id: "", width: 48 },
      ];
  // Аймаг → Сум (UNITLEVEL Constant‑ийн нэр ЯГ таарах ёстой)
  const { units: aimagOptions } = useGetLegalUnits(
    "Аймаг/Нийслэл",
    null,
    sumSelected,
  );
  const { units: sumOptions } = useGetLegalUnits(
    "Сум/Дүүрэг",
    criteria.aimag || null,
    sumSelected && !!criteria.aimag,
  );

  // Хүснэгтийн эрэмбэ — толгойгоор дарж солино (сервер талд)
  const table = useTable({
    defaultDense: true,
    defaultOrder: "desc",
    defaultOrderBy: "order_date",
  });

  const dc = useDebounce(criteria, 400);
  const searchBody = useMemo(() => {
    const has =
      dc.org ||
      dc.name?.trim() ||
      dc.order_number?.trim() ||
      dc.order_date ||
      dc.unit_name?.trim() ||
      dc.aimag ||
      dc.sum;
    if (!has) return null;
    return {
      page_size: 20,
      ordering: `${table.order === "desc" ? "-" : ""}${table.orderBy}`,
      ...(dc.org ? { org: dc.org } : {}),
      ...(dc.name?.trim() ? { name: dc.name.trim() } : {}),
      ...(dc.order_number?.trim()
        ? { order_number: dc.order_number.trim() }
        : {}),
      ...(dc.order_date ? { order_date: dc.order_date } : {}),
      ...(dc.unit_name?.trim() ? { unit_name: dc.unit_name.trim() } : {}),
      // Сум сонгосон бол яг тэр сум, эс бөгөөс аймаг (удам)
      ...(dc.sum ? { sum: dc.sum } : dc.aimag ? { aimag: dc.aimag } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dc, table.order, table.orderBy]);

  const { legalOrders: results, legalOrdersLoading: loading } =
    useGetLegalOrders(searchBody);

  // Тухайн төсөлд АЛЬ ХЭДИЙН холбогдсон ордууд — хайлтын үр дүнд "Холбогдсон"
  // гэж таниулна (эс бөгөөс дахин холбох гэж оролдоно).
  const { legalOrders: projectOrders, legalOrdersMutation: refetchProject } =
    useGetLegalOrders(
      projectId ? { projects: projectId, page_size: 1000 } : null,
    );
  const attachedIds = useMemo(() => {
    const set = new Set(attached);
    (projectOrders || []).forEach((o) => set.add(o.id));
    return set;
  }, [attached, projectOrders]);

  const set = (k) => (e) =>
    setCriteria((prev) => {
      const next = { ...prev, [k]: e.target.value };
      if (k === "org") {
        next.aimag = "";
        next.sum = "";
      }
      if (k === "aimag") next.sum = "";
      return next;
    });

  const handleAttach = async (order) => {
    if (!order?.id) return;
    setBusyId(order.id);
    try {
      await axiosInstance.post(endpoints.legal.attachProject(order.id), {
        project: projectId,
      });
      enqueueSnackbar("Сангаас холбогдлоо");
      // Панелийг ХААХГҮЙ — дараалан хэд хэдэн ордыг холбож болно.
      // Хэрэглэгч дуусаад "Хаах" дарна.
      onDone && onDone();
      setAttached((prev) => new Set(prev).add(order.id));
      refetchProject && refetchProject();
    } catch (error) {
      enqueueSnackbar(
        error?.response?.data?.detail || "Холбоход алдаа гарлаа",
        {
          variant: "error",
        },
      );
    } finally {
      setBusyId(null);
    }
  };

  // projectId БАЙХГҮЙ → сангаас холбох утгагүй тул шууд шинээр үүсгэх форм.
  if (!projectId) {
    return (
      <Box
        sx={{
          mb: 2,
          borderLeft: "4px solid",
          borderColor: "primary.main",
          borderRadius: 1,
        }}
      >
        <LegalNewEditForm
          projectId=""
          selectedType={null}
          onClose={onClose}
          refetch={onDone}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        mb: 2,
        borderLeft: "4px solid",
        borderColor: "primary.main",
        bgcolor: "background.neutral",
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Сангаас хайх
      </Typography>

      {/* Хайх талбарууд: төрөл, нэр, дугаар, огноо */}
      <Box
        gap={1.5}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
          md: "repeat(5, 1fr)",
        }}
        sx={{ mb: 2 }}
      >
        <TextField
          select
          label="Төрөл"
          value={criteria.org}
          onChange={set("org")}
        >
          <MenuItem value="">Бүгд</MenuItem>
          {legalTypes.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.label || t.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Нэр" value={criteria.name} onChange={set("name")} />
        <TextField
          label="Дугаар"
          value={criteria.order_number}
          onChange={set("order_number")}
        />
        <TextField
          type="date"
          label="Огноо"
          InputLabelProps={{ shrink: true }}
          value={criteria.order_date}
          onChange={set("order_date")}
        />
        <TextField
          label="Сум, дүүргийн нэр"
          placeholder="Аймаг эсвэл сумын нэр…"
          value={criteria.unit_name}
          onChange={set("unit_name")}
        />
      </Box>

      {/* "Сум, дүүрэг" төрөл сонгосон үед — аймаг/сумаар нарийсгах */}
      {sumSelected && (
        <Box
          gap={1.5}
          display="grid"
          gridTemplateColumns={{
            xs: "repeat(1, 1fr)",
            sm: "repeat(2, 1fr)",
          }}
          sx={{ mb: 2 }}
        >
          <TextField
            select
            label="Аймаг/Нийслэл"
            value={criteria.aimag}
            onChange={set("aimag")}
          >
            <MenuItem value="">Бүгд</MenuItem>
            {aimagOptions.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.unit}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Сум/Дүүрэг"
            value={criteria.sum}
            disabled={!criteria.aimag}
            onChange={set("sum")}
          >
            <MenuItem value="">Бүгд</MenuItem>
            {sumOptions.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.unit}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      )}

      {/* Үр дүн — толгойгоор эрэмбэлэгддэг хүснэгт, мөр бүрд холбох товч */}
      <Box sx={{ maxHeight: 300, overflow: "auto", mb: 1 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={20} />
          </Stack>
        ) : !searchBody ? (
          <Typography variant="caption" color="text.secondary">
            Төрөл, нэр, дугаар, огноо эсвэл сум/дүүргийн нэрээр хайна уу.
          </Typography>
        ) : (
          <TableContainer sx={{ position: "relative", overflow: "unset" }}>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHeadCustom
                  headLabel={HEAD}
                  //
                  order={table.order}
                  onSort={table.onSort}
                  orderBy={table.orderBy}
                />
                <TableBody>
                  {results.map((o) => (
                    <TableRow key={o.id} hover>
                      {sumSelected ? (
                        <>
                          <TableCell>{o.unit?.parent_unit || "—"}</TableCell>
                          <TableCell>{o.unit?.unit || "—"}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            {o.org?.label || o.org?.name ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={o.org.label || o.org.name}
                              />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {o.unit?.parent_unit
                              ? `${o.unit.parent_unit}, ${o.unit.unit}`
                              : o.unit?.unit || "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell sx={{ fontWeight: 600 }}>{o.name}</TableCell>
                      <TableCell>{o.order_number || "—"}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {o.order_date || "—"}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color={attachedIds.has(o.id) ? "success" : "primary"}
                          disabled={busyId === o.id || attachedIds.has(o.id)}
                          onClick={() => handleAttach(o)}
                          title={
                            attachedIds.has(o.id)
                              ? "Энэ төсөлд аль хэдийн холбогдсон"
                              : "Ашиглах"
                          }
                        >
                          {busyId === o.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify
                              icon={
                                attachedIds.has(o.id)
                                  ? "solar:check-circle-bold"
                                  : "mingcute:link-line"
                              }
                            />
                          )}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}

                  <TableNoData notFound={!results.length} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Box>

      <Divider sx={{ my: 2 }}>эсвэл</Divider>

      {!creating ? (
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button
            variant="contained"
            color="primary"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setCreating(true)}
          >
            Нэмэх
          </Button>
          <Button variant="contained" onClick={onClose}>
            Хаах
          </Button>
        </Stack>
      ) : (
        <LegalNewEditForm
          projectId={projectId}
          selectedType={null}
          onClose={onClose}
          refetch={onDone}
        />
      )}
    </Box>
  );
}

BeltgelAdd.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onDone: PropTypes.func,
  onClose: PropTypes.func,
};
