import PropTypes from "prop-types";
import React, { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  Box,
  Chip,
  Stack,
  Button,
  Dialog,
  TextField,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
} from "@mui/material";
import {
  CheckOutlined,
  AddShoppingCart,
  OpenInNewRounded as OpenInNewIcon,
} from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequestStatuses } from "src/api/request";
import { useGetConstantsFordropdown } from "src/api/constant";

import { requestMapDraw, requestRecountReload } from "./mapDraw";

// Нэрийн геометрийн төрлийг OpenLayers Draw төрөл рүү буулгана
function olDrawType(gt) {
  const t = (gt || "").toLowerCase();
  if (t.includes("polygon")) return "Polygon";
  if (t.includes("line")) return "LineString";
  return "Point";
}
const DRAW_LABEL = { Point: "цэг", LineString: "шугам", Polygon: "талбай" };

import RequestChangeForm from "src/sections/request/request-change-form";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн дэлгэрэнгүй карт — ангиллын зам (level1/2/3), дугаар,
// нэр, дэлгэрэнгүй линк, батлагдсан төлөв, Сагсанд нэмэх / Өөрчлөх хүсэлт.
// NameSidebar болон FeatureSelector (олон нэрийн пейжер) хоёулаа ашиглана.
// ----------------------------------------------------------------------

export default function NameDetailCard({ name, onSelect, onAfterAction }) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [typePath, setTypePath] = useState([]);
  const [approved, setApproved] = useState(undefined);
  const [createdDate, setCreatedDate] = useState(null);
  const [coord, setCoord] = useState(null); // [lon, lat]
  const [geomType, setGeomType] = useState(null);
  const { statuses } = useGetRequestStatuses();
  const changeStatus =
    statuses.find((s) => (s?.name || "").includes("Өөрчл")) || null;

  // Төслийн газрын зураг (champaign/<id>/map) дээр бол — рекаунт бүртгэх горим
  const pathname = usePathname();
  const recountProjectId = useMemo(() => {
    const m = (pathname || "").match(/^\/dashboard\/champaign\/([^/]+)\/map/);
    return m ? m[1] : null;
  }, [pathname]);
  const { constants: rStatuses } = useGetConstantsFordropdown("RECOUNT_STATUS");
  const { constants: rSteps } = useGetConstantsFordropdown("RECOUNT_STEPS");
  const rStep = useMemo(
    () => rSteps.find((s) => s.name === "Суурин судалгаа") || null,
    [rSteps],
  );
  const statusIdByName = (nm) => rStatuses.find((s) => s.name === nm)?.id || null;
  const [saving, setSaving] = useState(false);
  const [draftDlg, setDraftDlg] = useState(null); // {statusName, text}
  const [rcEdit, setRcEdit] = useState(false); // recount төлөв засах горим
  const [rcConfirm, setRcConfirm] = useState(false); // recount устгах баталгаа

  // Recount төлөв өөрчлөх (PATCH)
  const editRecountStatus = async (statusName) => {
    setSaving(true);
    try {
      await axiosInstance.patch(endpoints.recount.edit(name.id), {
        status_id: statusIdByName(statusName),
      });
      enqueueSnackbar(`Төлөв "${statusName}" болголоо`);
      setRcEdit(false);
      requestRecountReload();
      onAfterAction?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Засахад алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  // Recount устгах (DELETE)
  const deleteRecount = async () => {
    setSaving(true);
    try {
      await axiosInstance.delete(endpoints.recount.delete(name.id));
      enqueueSnackbar("Тодруулалт устгагдлаа");
      setRcConfirm(false);
      requestRecountReload();
      onSelect?.(null);
      onAfterAction?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Устгахад алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveRecount = async (statusName, draftText, loc) => {
    setSaving(true);
    try {
      await axiosInstance.post(endpoints.recount.create, {
        project_id: recountProjectId,
        name_id: name.id,
        draft: draftText || "",
        ...(rStep?.id ? { step_id: rStep.id } : {}),
        ...(statusIdByName(statusName) ? { status_id: statusIdByName(statusName) } : {}),
        ...(loc ? { loc } : coord ? { loc: { type: "Point", coordinates: coord } } : {}),
      });
      enqueueSnackbar(`"${name.name}" — ${statusName} төлөвөөр бүртгэгдлээ`);
      onAfterAction?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Бүртгэхэд алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  // suurin‑тэй ижил логик: ижил→шууд, зөрүүтэй/алдаатай→draft диалог,
  // байршил→зураг дээр геометр зурах (нэрийн төрлөөр Цэг/Шугам/Талбай)
  const handleStatus = async (statusName) => {
    if (statusName === "ижил") {
      saveRecount("ижил", name.name);
    } else if (statusName === "байршил") {
      const dtype = olDrawType(geomType);
      enqueueSnackbar(
        `"${name.name}" — газрын зураг дээр ${DRAW_LABEL[dtype]} зурна уу (ESC — болих)`,
        { variant: "info" },
      );
      const geojson = await requestMapDraw(dtype);
      if (!geojson) return; // ESC / болих
      await saveRecount("байршил", name.name, geojson);
    } else {
      setDraftDlg({ statusName, text: name.name || "" });
    }
  };

  useEffect(() => {
    let active = true;
    const id = name?.id;
    if (!id) {
      setTypePath([]);
      setApproved(undefined);
      return undefined;
    }
    axiosInstance
      .get(endpoints.geoname.details(id))
      .then((res) => {
        if (active) {
          setTypePath(res?.data?.type_path || []);
          setApproved(res?.data?.is_approved ?? null);
          setCreatedDate(res?.data?.created_date || null);
          const la = res?.data?.lat;
          const lo = res?.data?.lon;
          setCoord(la != null && lo != null ? [lo, la] : null);
          setGeomType(res?.data?.geom_type || null);
        }
      })
      .catch(() => {
        if (active) {
          setTypePath([]);
          setApproved(undefined);
        }
      });
    return () => {
      active = false;
    };
  }, [name?.id]);

  // Худалдан авалтын дэд систем устсан тул "Сагсанд нэмэх" одоохондоо идэвхгүй.
  function addToCart() {
    enqueueSnackbar("Сагсны үйлдэл одоохондоо идэвхгүй байна", {
      variant: "info",
    });
  }

  if (!name) return null;

  return (
    <>
      <Box sx={{ p: 2 }}>
        {typePath.length > 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mb: 1,
              flexWrap: "wrap",
            }}
          >
            {typePath.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 && (
                  <Typography variant="caption" color="text.disabled">
                    ›
                  </Typography>
                )}
                <Chip
                  size="small"
                  label={t.name}
                  variant={i === typePath.length - 1 ? "filled" : "outlined"}
                  color={i === typePath.length - 1 ? "primary" : "default"}
                  sx={{ height: 20, fontSize: 11 }}
                />
              </React.Fragment>
            ))}
          </Box>
        )}

        <Typography variant="h6">{name?.number}</Typography>
        {name.name && <Typography variant="body1">{name.name}</Typography>}

        {name?.id && (
          <Button
            component="a"
            href={`/dashboard/geoname/${name.id}`}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            endIcon={<OpenInNewIcon fontSize="small" />}
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              px: 0.5,
              my: 0.5,
            }}
          >
            Дэлгэрэнгүй мэдээлэл
          </Button>
        )}

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {approved !== undefined && (
            <Chip
              size="small"
              label={
                approved === true
                  ? "Батлагдсан"
                  : approved === false
                    ? "Батлагдаагүй"
                    : `${createdDate || ""} Хэлэлцүүлэг`.trim()
              }
              variant="outlined"
              color={
                approved === true
                  ? "success"
                  : approved === false
                    ? "warning"
                    : "info"
              }
              sx={{ fontWeight: "bold" }}
            />
          )}
        </Box>

        {name?._isRecount ? (
          /* Дарсан объект нь recount — төлөв + Засах/Устгах */
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              <Chip
                size="small"
                color="info"
                variant="filled"
                label="Тодруулалт (recount)"
              />
              {(() => {
                const st = rStatuses.find(
                  (s) => String(s.id) === String(name.status_id),
                );
                return st ? (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Төлөв: ${st.name}`}
                  />
                ) : null;
              })()}
            </Stack>

            {rcConfirm ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="body2" color="error">
                  Устгах уу?
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={saving}
                  onClick={deleteRecount}
                >
                  Тийм
                </Button>
                <Button size="small" onClick={() => setRcConfirm(false)}>
                  Үгүй
                </Button>
              </Stack>
            ) : (
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={saving}
                  onClick={() => setRcEdit((v) => !v)}
                >
                  Төлөв засах
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={saving}
                  onClick={() => setRcConfirm(true)}
                >
                  Устгах
                </Button>
              </Stack>
            )}

            {rcEdit && !rcConfirm && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {rStatuses.map((s) => (
                  <Button
                    key={s.id}
                    size="small"
                    variant={
                      String(s.id) === String(name.status_id)
                        ? "contained"
                        : "outlined"
                    }
                    disabled={saving}
                    onClick={() => editRecountStatus(s.name)}
                    sx={{ textTransform: "none", fontSize: 11, px: 0.7 }}
                  >
                    {s.name}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        ) : recountProjectId ? (
          /* Төслийн газрын зураг — рекаунтын төлөв (ижил/зөрүүтэй/алдаатай/байршил) */
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
            {[
              { s: "ижил", label: "Ижил", color: "success" },
              { s: "батлагдаагүй", label: "Батлагдаагүй", color: "warning" },
              { s: "алдаатай", label: "Алдаатай", color: "error" },
              { s: "байршил", label: "Байршил", color: "info" },
            ].map((b) => (
              <Button
                key={b.s}
                variant="outlined"
                fullWidth
                size="small"
                color={b.color}
                disabled={saving || !name?.id}
                onClick={() => handleStatus(b.s)}
                sx={{ textTransform: "none", fontWeight: 600, fontSize: 11, px: 0.5 }}
              >
                {b.label}
              </Button>
            ))}
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {name?.id && (
              <Button
                variant="contained"
                fullWidth
                size="small"
                color="primary"
                startIcon={<AddShoppingCart fontSize="small" />}
                onClick={() => {
                  onSelect?.(name);
                  addToCart();
                }}
                sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
              >
                Сагсанд нэмэх
              </Button>
            )}
            <Button
              variant="contained"
              fullWidth
              size="small"
              color="warning"
              startIcon={<CheckOutlined fontSize="small" />}
              onClick={() => setRequestModalOpen(true)}
              sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
            >
              Өөрчлөх хүсэлт
            </Button>
          </Stack>
        )}
      </Box>

      {/* Зөрүүтэй / Алдаатай — draft (зөв/тэмдэглэх) бичих диалог */}
      <Dialog
        open={!!draftDlg}
        onClose={() => setDraftDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {draftDlg?.statusName === "батлагдаагүй" ? "Батлагдаагүй" : "Алдаатай"} нэр
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            {name?.name} — зөв/тэмдэглэх утгыг бичнэ үү (draft-д хадгална).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 1.5 }}
            value={draftDlg?.text || ""}
            onChange={(e) =>
              setDraftDlg((p) => ({ ...p, text: e.target.value }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDraftDlg(null)}>
            Болих
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => {
              const d = draftDlg;
              setDraftDlg(null);
              saveRecount(d.statusName, d.text);
            }}
          >
            Хадгалах
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="body"
      >
        <DialogTitle
          sx={{ bgcolor: "primary.main", color: "common.white", py: 1.5 }}
        >
          Нэр өөрчлөх хүсэлт
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <RequestChangeForm
            onClose={() => setRequestModalOpen(false)}
            selectedStatus={changeStatus}
            geonameId={name?.id || null}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

NameDetailCard.propTypes = {
  name: PropTypes.object,
  onSelect: PropTypes.func,
  onAfterAction: PropTypes.func,
};
