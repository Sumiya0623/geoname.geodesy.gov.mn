"use client";

import PropTypes from "prop-types";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Chip,
  Stack,
  Table,
  Button,
  Divider,
  Collapse,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";

import { useMenuPermissions } from "src/hooks/use-menu-permissions";
import { useGetChampaign } from "src/api/champaign";
import { useGetConstantsFordropdown } from "src/api/constant";
import axiosInstance, { endpoints } from "src/utils/axios";

import Iconify from "src/components/iconify";
import ProfileAvatar from "src/components/profile-avatar";
import { useSnackbar } from "src/components/snackbar";
import { ConfirmDialog } from "src/components/custom-dialog";

// ----------------------------------------------------------------------
// Хээрийн судалгааны БАГИЙН БҮРЭЛДЭХҮҮН — төслийн сум бүрээр мод хэлбэрээр.
// Сум тус бүрд «Ажилтан нэмэх» (регистрээр хайж бөглөнө) ба «Шийдвэр нэмэх»
// (LegalOrder нэмэх/засах форм) товчтой. Бүртгэл нь ProjectMember дээр,
// үе шат (step) = Хээрийн судалгаа.
// ----------------------------------------------------------------------

const emptyForm = {
  id: null,
  register: "",
  full_name: "",
  phone: "",
  position: "",
  org_title: "",
  person: null,
};

export default function TeamListView({ projectId, stepName, onCount }) {
  const { enqueueSnackbar } = useSnackbar();
  const { champaign } = useGetChampaign(projectId);
  const { constants: positions } = useGetConstantsFordropdown(
    "PROJECT_MEMBER_TYPES",
  );
  // Үе шатыг НЭРЭЭР нь (ж: «Хээрийн судалгаа») өөрөө олж авна — эцэг хуудас
  // backend‑ээс юу ч татахгүй.
  const { constants: steps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const stepId = useMemo(() => {
    const key = (stepName || "").trim().toLowerCase();
    if (!key) return null;
    return (
      steps.find((s) => (s.name || "").toLowerCase().includes(key))?.id || null
    );
  }, [steps, stepName]);
  // Эрх: SUBMENUS code='project-member' — list/create/update/delete
  const perm = useMenuPermissions({ content: "project-member" });
  const canView = !!perm?.list;
  const canCreate = !!perm?.create;
  const canUpdate = !!perm?.update;
  const canDelete = !!perm?.delete;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openUnits, setOpenUnits] = useState(() => new Set()); // задарсан сумд
  const [formUnit, setFormUnit] = useState(null); // ажилтан нэмэх/засах сум
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState(null); // {found:bool}
  const [delRow, setDelRow] = useState(null);
  const [rowMenu, setRowMenu] = useState(null); // {anchor, row, unitId}

  // Төслийн хамрах сумд (аймаг бол өөрөө нэг мөр)
  const units = useMemo(() => champaign?.units || [], [champaign]);

  const fetchMembers = useCallback(() => {
    if (!projectId || !canView) return;
    // Үе шат нэрээр өгсөн бол ТҮҮНИЙГ олтол татахгүй — эс бөгөөс шүүлтгүй
    // хүсэлт явж, өөр үе шатны гишүүд орж ирнэ.
    if (stepName && !stepId) return;
    setLoading(true);
    const q = new URLSearchParams({ project: projectId });
    if (stepId) q.set("step", stepId);
    axiosInstance
      .get(endpoints.champaign.members(q.toString()))
      .then((res) => setMembers(res?.data?.results || res?.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [projectId, stepId, stepName, canView]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Гишүүдийн тоог эцэг хуудсанд мэдэгдэнэ (collapse‑ийн толгойд харуулна)
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;
  useEffect(() => {
    onCountRef.current?.(members.length);
  }, [members.length]);

  const byUnit = useMemo(() => {
    const m = new Map();
    members.forEach((r) => {
      const k = r.unit || 0;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return m;
  }, [members]);

  const toggleUnit = (id) =>
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Регистрээр системийн хэрэглэгч хайх — олдвол мэдээллийг бөглөнө
  const handleFind = async () => {
    const reg = (form.register || "").trim();
    if (!reg) return;
    try {
      const res = await axiosInstance.get(endpoints.champaign.findPerson(reg));
      const d = res?.data || {};
      setLookup(d);
      if (d.found) {
        setForm((p) => ({
          ...p,
          full_name: d.full_name || p.full_name,
          phone: d.phone || p.phone,
          person: d.id,
        }));
        enqueueSnackbar("Хэрэглэгч олдлоо — мэдээлэл бөглөгдлөө");
      } else {
        setForm((p) => ({ ...p, person: null }));
        enqueueSnackbar("Хэрэглэгч олдсонгүй — гараар бөглөнө үү", {
          variant: "info",
        });
      }
    } catch (e) {
      setLookup(null);
    }
  };

  const openMemberForm = (unitId, row = null) => {
    setFormUnit(unitId);
    setLookup(null);
    setForm(
      row
        ? {
            id: row.id,
            register: row.register || "",
            full_name: row.full_name || "",
            phone: row.phone || "",
            position: row.position || "",
            org_title: row.org_title || "",
            person: row.person || null,
          }
        : emptyForm,
    );
    setOpenUnits((prev) => new Set(prev).add(unitId));
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      enqueueSnackbar("Овог нэр бичнэ үү", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        project: projectId,
        unit: formUnit || null,
        step: stepId || null,
        full_name: form.full_name.trim(),
        register: form.register.trim() || null,
        phone: form.phone.trim() || null,
        org_title: form.org_title.trim() || null,
        position: form.position || null,
        person: form.person || null,
      };
      if (form.id) {
        await axiosInstance.patch(
          endpoints.champaign.memberDetail(form.id),
          body,
        );
      } else {
        await axiosInstance.post(endpoints.champaign.memberCreate(), body);
      }
      enqueueSnackbar("Хадгалагдлаа");
      setFormUnit(null);
      setForm(emptyForm);
      fetchMembers();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Хадгалахад алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delRow) return;
    try {
      await axiosInstance.delete(endpoints.champaign.memberDetail(delRow.id));
      enqueueSnackbar("Устгагдлаа");
      fetchMembers();
    } catch (e) {
      enqueueSnackbar("Устгахад алдаа гарлаа", { variant: "warning" });
    } finally {
      setDelRow(null);
    }
  };

  // Харах эрхгүй бол хэсэг огт харагдахгүй
  if (!projectId || !canView) return null;

  const unitLabel = (u) =>
    u?.parent_unit ? `${u.parent_unit} — ${u.unit}` : u?.unit || "—";

  return (
    <>
      <Box sx={{ p: 2.5, pt: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {stepName || "Хээрийн судалгаа"} үе шатны багийн бүрэлдэхүүнийг сум
          тус бүрээр бүртгэнэ. Регистр оруулаад хайхад системд бүртгэлтэй бол
          мэдээлэл автоматаар бөглөгдөнө.
        </Typography>

        {units.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            Төсөлд хамрах засаг захиргааны нэгж бүртгэгдээгүй байна.
          </Typography>
        ) : (
          units.map((u) => {
            const rows = byUnit.get(u.id) || [];
            const isOpen = openUnits.has(u.id);
            return (
              <Box
                key={u.id}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                {/* Сумын мөр */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ px: 1.5, py: 1 }}
                >
                  <IconButton size="small" onClick={() => toggleUnit(u.id)}>
                    <Iconify
                      icon={
                        isOpen
                          ? "eva:chevron-down-fill"
                          : "eva:chevron-right-fill"
                      }
                      width={18}
                    />
                  </IconButton>
                  <Iconify
                    icon="solar:map-point-bold"
                    width={16}
                    sx={{ color: "primary.main" }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{ flexGrow: 1, cursor: "pointer" }}
                    onClick={() => toggleUnit(u.id)}
                  >
                    {unitLabel(u)}
                  </Typography>
                  <Chip
                    size="small"
                    variant="soft"
                    label={`${rows.length} хүн`}
                    sx={{ height: 20 }}
                  />
                  {canCreate && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Iconify icon="mingcute:add-line" />}
                      onClick={() => openMemberForm(u.id)}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      Ажилтан нэмэх
                    </Button>
                  )}
                </Stack>

                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <Divider />
                  {rows.length > 0 && (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Овог нэр</TableCell>
                          <TableCell width={150}>Албан тушаал</TableCell>
                          <TableCell width={130}>Регистр</TableCell>
                          <TableCell width={120}>Утас</TableCell>
                          <TableCell width={170}>Шийдвэр</TableCell>
                          <TableCell width={90} align="right" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map((r) => (
                          <TableRow key={r.id} hover>
                            <TableCell>
                              {/* Системд бүртгэлтэй бол ProfileAvatar,
                                    эс бөгөөс зөвхөн гараар бичсэн нэр */}
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                              >
                                {r.person_profile && (
                                  <ProfileAvatar
                                    user={r.person_profile}
                                    size={28}
                                  />
                                )}
                                <Typography variant="body2">
                                  {r.full_name}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{r.position_name || "—"}</TableCell>
                            <TableCell>{r.register || "—"}</TableCell>
                            <TableCell>{r.phone || "—"}</TableCell>
                            <TableCell>
                              {r.doc_name
                                ? `${r.doc_name}${
                                    r.doc_number ? ` · №${r.doc_number}` : ""
                                  }`
                                : "—"}
                            </TableCell>
                            <TableCell align="right">
                              {(canUpdate || canDelete) && (
                                <IconButton
                                  size="small"
                                  onClick={(e) =>
                                    setRowMenu({
                                      anchor: e.currentTarget,
                                      row: r,
                                      unitId: u.id,
                                    })
                                  }
                                >
                                  <Iconify
                                    icon="eva:more-vertical-fill"
                                    width={18}
                                  />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {/* Ажилтан нэмэх/засах форм — мөрийн доор */}
                  <Collapse in={formUnit === u.id} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, bgcolor: "background.neutral" }}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 2,
                          gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, 1fr)",
                            md: "repeat(3, 1fr)",
                          },
                        }}
                      >
                        <TextField
                          label="Регистр"
                          value={form.register}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              register: e.target.value,
                            }))
                          }
                          onBlur={handleFind}
                          InputProps={{
                            endAdornment: (
                              <IconButton size="small" onClick={handleFind}>
                                <Iconify icon="eva:search-fill" width={18} />
                              </IconButton>
                            ),
                          }}
                          helperText={
                            lookup
                              ? lookup.found
                                ? "Системд бүртгэлтэй"
                                : "Системд олдсонгүй — гараар бөглөнө"
                              : " "
                          }
                        />
                        <TextField
                          label="Овог нэр"
                          value={form.full_name}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              full_name: e.target.value,
                            }))
                          }
                        />
                        <TextField
                          label="Утас"
                          value={form.phone}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, phone: e.target.value }))
                          }
                        />
                        <TextField
                          select
                          label="Албан тушаал"
                          value={form.position}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              position: e.target.value,
                            }))
                          }
                        >
                          <MenuItem value="">— Сонгоогүй —</MenuItem>
                          {positions.map((o) => (
                            <MenuItem key={o.id} value={o.id}>
                              {o.name}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Төлөөлж буй байгууллага/албан тушаал"
                          value={form.org_title}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              org_title: e.target.value,
                            }))
                          }
                          sx={{ gridColumn: { md: "span 2" } }}
                        />
                      </Box>

                      <Stack
                        direction="row"
                        spacing={1.5}
                        justifyContent="flex-end"
                        sx={{ mt: 2 }}
                      >
                        <Button
                          color="inherit"
                          variant="outlined"
                          onClick={() => setFormUnit(null)}
                        >
                          Болих
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={saving}
                          onClick={handleSave}
                        >
                          Хадгалах
                        </Button>
                      </Stack>
                    </Box>
                  </Collapse>
                </Collapse>
              </Box>
            );
          })
        )}
      </Box>

      {/* Мөрийн үйлдлийн цэс — Засах / Устгах */}
      <Menu
        anchorEl={rowMenu?.anchor}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 160 } } }}
      >
        {canUpdate && (
          <MenuItem
            onClick={() => {
              openMemberForm(rowMenu.unitId, rowMenu.row);
              setRowMenu(null);
            }}
          >
            <ListItemIcon>
              <Iconify icon="solar:pen-bold" width={18} />
            </ListItemIcon>
            <ListItemText>Засах</ListItemText>
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            sx={{ color: "error.main" }}
            onClick={() => {
              setDelRow(rowMenu.row);
              setRowMenu(null);
            }}
          >
            <ListItemIcon>
              <Iconify
                icon="solar:trash-bin-trash-bold"
                width={18}
                sx={{ color: "error.main" }}
              />
            </ListItemIcon>
            <ListItemText>Устгах</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        open={!!delRow}
        onClose={() => setDelRow(null)}
        title="Устгах"
        content={`"${delRow?.full_name}"‑ийг багийн бүрэлдэхүүнээс хасах уу?`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Устгах
          </Button>
        }
      />
    </>
  );
}

TeamListView.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  stepName: PropTypes.string,
  onCount: PropTypes.func,
};
