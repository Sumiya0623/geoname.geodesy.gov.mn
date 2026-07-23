"use client";

import useSWR from "swr";
import PropTypes from "prop-types";
import { useState } from "react";

import {
  Card,
  Chip,
  Stack,
  Table,
  Button,
  Dialog,
  Divider,
  Tooltip,
  MenuItem,
  Container,
  TableRow,
  TextField,
  TableBody,
  TableCell,
  TableHead,
  Typography,
  IconButton,
  Autocomplete,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  FormControlLabel,
  Switch,
} from "@mui/material";

import { useBoolean } from "src/hooks/use-boolean";
import { useDebounce } from "src/hooks/use-debounce";
import { useSettingsContext } from "src/components/settings";
import axiosInstance, { fetcher, endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";
import { useGetCouncils, useGetCouncilMembers } from "src/api/council";

import Iconify from "src/components/iconify";
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
  return (
    <Autocomplete
      fullWidth
      value={value}
      options={options}
      onChange={(e, v) => onChange(v)}
      onInputChange={(e, v, r) => r === "input" && setQ(v)}
      getOptionLabel={(o) =>
        o?.name
          ? `${o.name}${o.order_number ? ` (${o.order_number})` : ""}`
          : ""
      }
      isOptionEqualToValue={(o, v) => o?.id === v?.id}
      noOptionsText={dq?.length >= 2 ? "Олдсонгүй" : "Нэр/дугаараар хайх"}
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

  const { constants: kinds } = useGetConstantsFordropdown("COUNCIL_KINDS");
  const { constants: statuses } = useGetConstantsFordropdown("COUNCIL_STATUS");
  const { constants: positions } =
    useGetConstantsFordropdown("COUNCIL_POSITIONS");

  const { councils, councilsLoading, councilsMutation } = useGetCouncils();

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
  const aimags = useUnits("Аймаг/Нийслэл", null, true);
  const sums = useUnits("Сум/Дүүрэг", aimag?.id, !!aimag?.id);

  const openCreate = () => {
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
      if (cf.id) {
        await axiosInstance.patch(endpoints.council.edit(cf.id), body);
      } else {
        await axiosInstance.post(endpoints.council.create, body);
      }
      enqueueSnackbar("Хадгаллаа");
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

  return (
    <Container maxWidth="xxl">
      <CustomBreadcrumbs
        heading="Газар зүйн нэрийн зөвлөл"
        links={[{ name: "Дашбоард" }, { name: "Зөвлөлийн сан" }]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={openCreate}
          >
            Зөвлөл нэмэх
          </Button>
        }
      />

      {/* Зөвлөлийн жагсаалт */}
      <Card>
        <TableContainer>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Нэр</TableCell>
                  <TableCell>Төрөл</TableCell>
                  <TableCell>Харьяа нэгж</TableCell>
                  <TableCell>Төлөв</TableCell>
                  <TableCell align="center">Гишүүд</TableCell>
                  <TableCell width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {councils.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    selected={selected?.id === c.id}
                    sx={{ cursor: "pointer" }}
                    onClick={() => setSelected(c)}
                  >
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.kind?.name || "—"}</TableCell>
                    <TableCell>{c.unit?.unit || "Үндэсний"}</TableCell>
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
                    <TableCell align="center">{c.member_count}</TableCell>
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
                          setAimag(null);
                          setSum(null);
                          councilForm.onTrue();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {!councilsLoading && councils.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography variant="caption" color="text.secondary">
                        Зөвлөл алга. &quot;Зөвлөл нэмэх&quot;-ээр үүсгэнэ үү.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
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
      <Dialog
        open={councilForm.value}
        onClose={councilForm.onFalse}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{cf.id ? "Зөвлөл засах" : "Зөвлөл нэмэх"}</DialogTitle>
        <DialogContent>
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
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={councilForm.onFalse}>
            Болих
          </Button>
          <Button variant="contained" onClick={saveCouncil}>
            Хадгалах
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
