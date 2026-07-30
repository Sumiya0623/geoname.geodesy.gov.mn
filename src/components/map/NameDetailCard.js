import PropTypes from "prop-types";
import React, { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  Box,
  Chip,
  Stack,
  Button,
  Dialog,
  Checkbox,
  TextField,
  Typography,
  DialogTitle,
  DialogActions,
  DialogContent,
  FormControlLabel,
} from "@mui/material";
import {
  CheckOutlined,
  DescriptionRounded,
  OpenInNewRounded as OpenInNewIcon,
} from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";

import { HOST_API } from "src/config-global";
import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequestStatuses } from "src/api/request";
import { useGetConstantsFordropdown } from "src/api/constant";

import {
  requestMapDraw,
  commitMapEdit,
  cancelMapEdit,
  requestMapEditGeom,
  requestRecountReload,
} from "./mapDraw";
import { statusColorByName } from "./recountStatus";

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

export default function NameDetailCard({
  name,
  onSelect,
  onAfterAction,
  onFormOpenChange,
}) {
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
  const [rcStatusIds, setRcStatusIds] = useState(() => new Set()); // сонгосон төлвүүд
  const [rcDraft, setRcDraft] = useState(""); // "алдаатай" үеийн засвар нэр
  const [editingGeom, setEditingGeom] = useState(false); // байрлал засах горим
  const [photos, setPhotos] = useState([]); // нэрийн зургууд
  const [inquireLoading, setInquireLoading] = useState(false); // лавлагаа гаргах

  // geoname id — recount дээр name_id, эс бол name.id
  const geonameId = name?._isRecount ? name?.name_id : name?.id;

  // Тодруулалт (recount) дээр дарсан бол — төсөл/төлвийн дэлгэрэнгүйг татна
  const [rcDetail, setRcDetail] = useState(null);
  useEffect(() => {
    if (!name?._isRecount || !name?.id) {
      setRcDetail(null);
      return undefined;
    }
    let active = true;
    axiosInstance
      .get(endpoints.recount.edit(name.id))
      .then((res) => {
        if (active) setRcDetail(res?.data || null);
      })
      .catch(() => {
        if (active) setRcDetail(null);
      });
    return () => {
      active = false;
    };
  }, [name?._isRecount, name?.id]);

  // Нэрийн зургуудыг татна (recount + жирийн geoname хоёуланд)
  useEffect(() => {
    let active = true;
    if (!geonameId) {
      setPhotos([]);
      return undefined;
    }
    axiosInstance
      .get(endpoints.geoname.details(geonameId))
      .then((res) => {
        if (active) setPhotos(res?.data?.photos || []);
      })
      .catch(() => {
        if (active) setPhotos([]);
      });
    return () => {
      active = false;
    };
  }, [geonameId]);

  // Байрлал засах — QGIS маягаар геометр засаад хадгална, дараа нь дахин дуудна.
  // Геометр аль хэдийн client дээр (name.geometry — WFS‑ээс ачаалагдсан) байгаа
  // тул дахин ТАТАХГҮЙ, шууд түүнийг засна.
  const handleEditGeom = async () => {
    if (!geonameId) return;
    // Click үед геометрийг _geom (GeoJSON 4326)‑д хадгалдаг (map-init.js). Дахин татахгүй.
    const geom = name?._geom || name?.geometry || null;
    if (!geom) {
      enqueueSnackbar("Геометр олдсонгүй", { variant: "warning" });
      return;
    }
    setEditingGeom(true);
    const geojson = await requestMapEditGeom(geom);
    setEditingGeom(false);
    if (!geojson) return; // Болих/ESC
    try {
      // recount_view геометр = COALESCE(recount.loc, geoname.geoloc). Тиймээс
      // recount дээр байгаа бол recount.loc‑г засна (тэгж байж цэг хөдөлнө);
      // жирийн geoname бол geoname.geoloc‑г засна.
      if (name?._isRecount) {
        await axiosInstance.patch(endpoints.recount.edit(name.id), {
          loc: geojson,
        });
      } else {
        await axiosInstance.patch(endpoints.geoname.edit(geonameId), {
          geom: geojson,
        });
      }
      enqueueSnackbar("Байрлал хадгалагдлаа");
      // Засагдсан байрлалыг газрын зурагт дахин дуудна
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("geoname:changed"));
      requestRecountReload();
      onAfterAction?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Байрлал хадгалахад алдаа гарлаа", {
        variant: "warning",
      });
    }
  };

  // ' 1219 1220 ' → [1219,1220]
  const parseStatusIds = (s) =>
    String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);

  const errStatusId = statusIdByName("алдаатай");
  const unapprovedStatusId = statusIdByName("батлагдаагүй");
  const shineStatusId = statusIdByName("шинэ");
  // recount АНХНААСАА "шинэ" статустай байсан эсэх (байсан бол checkbox‑д харуулна)
  const hadShine = parseStatusIds(name?.status_ids).includes(shineStatusId);
  // "алдаатай" ЭСВЭЛ "батлагдаагүй" сонгосон бол засварласан нэрийн талбар гарна
  const showDraftField =
    (errStatusId && rcStatusIds.has(errStatusId)) ||
    (unapprovedStatusId && rcStatusIds.has(unapprovedStatusId));

  // Хилийн цэс (GeoName.is_border) — анхдагч тэмдэглээгүй
  const [rcBorder, setRcBorder] = useState(false);

  // Засах горимыг нээхэд ХУУЧИН төлвүүдийг set хийнэ. draft default = одоогийн нэр.
  const openRcEdit = () => {
    setRcStatusIds(new Set(parseStatusIds(name.status_ids)));
    // Хилийн цэс (GeoName.is_border) — анхдагч false
    setRcBorder(
      name.is_border === true || name.is_border === "true",
    );
    // Засварласан нэр = ЗӨВХӨН draft (засвар). Батлагдсан нэр биш. Байхгүй бол хоосон.
    setRcDraft(name.draft || "");
    setRcEdit(true);
  };
  const toggleRcStatus = (id, on) =>
    setRcStatusIds((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  // Recount ОЛОН төлөв хадгалах (PATCH status_ids — M2M)
  const saveRecountStatuses = async () => {
    setSaving(true);
    try {
      await axiosInstance.patch(endpoints.recount.edit(name.id), {
        status_ids: [...rcStatusIds],
        // "алдаатай"/"батлагдаагүй" сонгосон бол засварласан нэрийг draft‑д хадгална
        ...(showDraftField ? { draft: rcDraft.trim() } : {}),
      });
      // Хилийн цэс нь ТООЛЛОГЫН биш, ГАЗАР ЗҮЙН НЭРийн шинж чанар тул
      // geoname‑ийг тусад нь шинэчилнэ (батлагдсан нэртэй холбоотой үед л).
      if (name.name_id) {
        await axiosInstance.patch(endpoints.geoname.edit(name.name_id), {
          is_border: rcBorder,
        });
      }
      enqueueSnackbar("Төлөв хадгалагдлаа");
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
        ...(statusIdByName(statusName) ? { status_ids: [statusIdByName(statusName)] } : {}),
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
    // Recount дээр name.id нь RECOUNT id (geoname биш) — geoname details татахгүй
    if (!id || name?._isRecount) {
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
  }, [name?.id, name?._isRecount]);

  // Форм нээгдэхэд Popover‑г шинэ (өндөр) агуулгад тааруулж дахин байрлуулна —
  // MUI resize дохион дээр байрлалаа хязгаарт (marginThreshold) багтаана → доод
  // хэсэг (Бүртгэх) таслагдахгүй.
  useEffect(() => {
    if (!requestModalOpen) return undefined;
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    return () => clearTimeout(t);
  }, [requestModalOpen]);

  // Формын нээлттэй төлвийг parent (толгой)‑д мэдэгдэнэ → толгойд "Буцах" харагдана
  useEffect(() => {
    onFormOpenChange?.(requestModalOpen);
  }, [requestModalOpen, onFormOpenChange]);

  // Толгойн "Буцах"/X товчноос ирэх буцах команд → Дэлгэрэнгүй рүү сэргээнэ
  useEffect(() => {
    const back = () => setRequestModalOpen(false);
    window.addEventListener("geoname:formBack", back);
    return () => window.removeEventListener("geoname:formBack", back);
  }, []);

  // Лавлагаа авах — батлагдсан нэрд лавлагаа (GeoNameInquire) үүсгээд, HTML баримтыг
  // шинэ табд нээнэ. QR нь /inquire/<code> (нийтийн шалгах хуудас) руу заана.
  const handleInquire = async () => {
    if (!geonameId || inquireLoading) return;
    setInquireLoading(true);
    try {
      const res = await axiosInstance.post(endpoints.geoname.inquire(geonameId), {});
      const code = res?.data?.code;
      // ЗААВАЛ /api/ доогуур — nginx дээр /inquire/<code> нь frontend‑ийн
      // QR шалгах хуудас руу очдог тул баримт харагдахгүй болно.
      if (code) window.open(`${HOST_API}/api/inquire/${code}/`, "_blank");
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Лавлагаа гаргахад алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setInquireLoading(false);
    }
  };

  if (!name) return null;

  return (
    <>
      {requestModalOpen ? (
        // Өөрчлөх хүсэлт — popup ДОТОР inline (dialog БИШ). Буцах товчтой.
        <Box
          sx={{
            p: 2,
            width: { xs: "86vw", sm: 720 },
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          {/* Буцах товч толгой (header) дээр — parent NameSidebar/FeatureSelector дотор */}
          <RequestChangeForm
            onClose={() => setRequestModalOpen(false)}
            selectedStatus={changeStatus}
            geonameId={name?.id || null}
          />
        </Box>
      ) : (
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

        {/* Дэлгэрэнгүй — geoname рүү. Recount дээр холбоотой geoname (name_id)‑руу;
            draft (geoname‑гүй) recount дээр линк харагдахгүй. */}
        {(name?._isRecount ? name?.name_id : name?.id) && (
          <Button
            component="a"
            href={`/dashboard/geoname/${
              name?._isRecount ? name.name_id : name.id
            }`}
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

        {/* Нэрийн зургууд — хэвтээ зурвас (дарж томоор нээнэ) */}
        {photos.length > 0 && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              py: 1,
              mt: 0.5,
            }}
          >
            {photos.map((p) => (
              <Box
                key={p.id}
                component="img"
                src={p.url}
                alt="зураг"
                onClick={() => window.open(p.url, "_blank")}
                sx={{
                  height: 72,
                  minWidth: 96,
                  width: 96,
                  objectFit: "cover",
                  borderRadius: 1,
                  flexShrink: 0,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              />
            ))}
          </Box>
        )}

        {/* Байрлал засах — QGIS маягаар геометр засах. ЗӨВХӨН төслийн газрын
            зураг (champaign/<id>/map) дээр — бусад газар харагдахгүй. */}
        {geonameId && recountProjectId && (
          <Box sx={{ mt: 0.5 }}>
            {editingGeom ? (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography
                  variant="caption"
                  color="info.main"
                  sx={{ mr: 0.5 }}
                >
                  Газрын зураг дээр засаж байна…
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => commitMapEdit()}
                >
                  Хадгалах
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => cancelMapEdit()}
                >
                  Болих
                </Button>
              </Stack>
            ) : (
              <Button
                size="small"
                variant="outlined"
                onClick={handleEditGeom}
                sx={{ textTransform: "none" }}
              >
                Байрлал засах
              </Button>
            )}
          </Box>
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
              {parseStatusIds(name.status_ids).map((id) => {
                const st = rStatuses.find((s) => String(s.id) === String(id));
                if (!st) return null;
                const c = statusColorByName(st.name);
                return (
                  <Chip
                    key={id}
                    size="small"
                    variant="filled"
                    label={st.name}
                    sx={{ bgcolor: c, color: "#fff", fontWeight: 600 }}
                  />
                );
              })}
            </Stack>

            {/* Холбогдох ТӨСЛИЙН мэдээлэл */}
            {rcDetail?.project?.name && (
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: "background.neutral",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Төсөл:
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {rcDetail.project.name}
                  {rcDetail.project.dugaar &&
                  rcDetail.project.dugaar !== "un"
                    ? ` · №${rcDetail.project.dugaar}`
                    : ""}
                </Typography>
                {rcDetail.step?.name && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="default"
                    label={rcDetail.step.name}
                    sx={{ height: 18, fontSize: 10 }}
                  />
                )}
              </Stack>
            )}

            {/* Тодруулалт засах/устгах — ЗӨВХӨН төслийн газрын зурагт.
                /dashboard/map дээр зөвхөн харах (readonly). */}
            {!recountProjectId ? null : rcConfirm ? (
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
                  onClick={() => (rcEdit ? setRcEdit(false) : openRcEdit())}
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
              <Stack spacing={0.5}>
                <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                  {rStatuses
                    /* Засах үед "шинэ" хэрэггүй (зөвхөн шинээр бүртгэхэд) */
                    /* "шинэ"‑г зөвхөн анх байсан бол харуулна (засахад шинэ нэмэхгүй) */
                    .filter((s) => s.name !== "шинэ" || hadShine)
                    .map((s) => {
                      const c = statusColorByName(s.name);
                      return (
                        <FormControlLabel
                          key={s.id}
                          sx={{ mr: 1 }}
                          control={
                            <Checkbox
                              size="small"
                              checked={rcStatusIds.has(s.id)}
                              onChange={(e) =>
                                toggleRcStatus(s.id, e.target.checked)
                              }
                              sx={{ color: c, "&.Mui-checked": { color: c } }}
                            />
                          }
                          label={
                            <Typography
                              variant="body2"
                              sx={{ color: c, fontWeight: 600 }}
                            >
                              {s.name}
                            </Typography>
                          }
                        />
                      );
                    })}

                  {/* Хилийн цэс (GeoName.is_border) — мөрийн БАРУУН ХЯЗГААРТ */}
                  {!!name.name_id && (
                    <FormControlLabel
                      sx={{ ml: "auto", mr: 0 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={rcBorder}
                          onChange={(e) => setRcBorder(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Хилийн цэс
                        </Typography>
                      }
                    />
                  )}
                </Box>
                {showDraftField && (
                  <TextField
                    size="small"
                    fullWidth
                    label="Засварласан нэр"
                    value={rcDraft}
                    onChange={(e) => setRcDraft(e.target.value)}
                  />
                )}
                <Button
                  size="small"
                  variant="contained"
                  disabled={saving}
                  onClick={saveRecountStatuses}
                >
                  Хадгалах
                </Button>
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
            {name?.id && approved === true && (
              <Button
                variant="contained"
                fullWidth
                size="small"
                color="primary"
                disabled={inquireLoading}
                startIcon={<DescriptionRounded fontSize="small" />}
                onClick={handleInquire}
                sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
              >
                Лавлагаа авах
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
      )}

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
    </>
  );
}

NameDetailCard.propTypes = {
  name: PropTypes.object,
  onSelect: PropTypes.func,
  onAfterAction: PropTypes.func,
  onFormOpenChange: PropTypes.func,
};
