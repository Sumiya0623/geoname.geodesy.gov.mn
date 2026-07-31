import PropTypes from "prop-types";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

import {
  Box,
  Chip,
  Stack,
  Button,
  Dialog,
  Step,
  Stepper,
  Autocomplete,
  Tooltip,
  StepButton,
  StepContent,
  IconButton,
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
import { angleToDirection } from "src/utils/geoDirection";
import PhotoSlider from "src/components/photo-slider";
import PhotoDirectionPicker from "src/components/photo-direction-picker";

import {
  requestMapDraw,
  commitMapEdit,
  cancelMapEdit,
  requestMapEditGeom,
  requestRecountReload,
} from "./mapDraw";
import { statusColor } from "./recountStatus";

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
  // RECOUNT_STATUS‑ыг НЭРЭЭР нь биш КОДООР нь таина (нэр өөрчлөгдөж болно):
  //  1=Алдаагүй (ижил) · 2=Уламжлалт · 3=Нэр зөрүүтэй · 4=Байршил зөрүүтэй
  //  5=Шинээр үүссэн
  const statusIdByCode = (code) =>
    rStatuses.find((s) => String(s.code) === String(code))?.id || null;
  const [saving, setSaving] = useState(false);
  const [draftDlg, setDraftDlg] = useState(null); // {status, text}
  const [rcEdit, setRcEdit] = useState(false); // recount төлөв засах горим
  const [rcConfirm, setRcConfirm] = useState(false); // recount устгах баталгаа
  const [rcStatusIds, setRcStatusIds] = useState(() => new Set()); // сонгосон төлвүүд
  const [rcDraft, setRcDraft] = useState(""); // "алдаатай" үеийн засвар нэр
  // Тодруулалтын АНГИЛАЛ (draft үед) — 3 түвшний хамааралт сонголт
  const [rcT1, setRcT1] = useState(null);
  const [rcT2, setRcT2] = useState(null);
  const [rcT3, setRcT3] = useState(null);
  const [editingGeom, setEditingGeom] = useState(false); // байрлал засах горим
  const [photos, setPhotos] = useState([]); // нэрийн зургууд
  const [rcPhotos, setRcPhotos] = useState([]); // тодруулалтын хээрийн зургууд
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoDlg, setPhotoDlg] = useState(false); // зураг нэмэх диалог
  const [stepView, setStepView] = useState(0); // задарсан үе шат (stepper)
  const [newPhotos, setNewPhotos] = useState([]); // [{file, deg}] — компасаар
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
        if (active) {
          setRcDetail(res?.data || null);
          setRcPhotos(res?.data?.photos || []);
        }
      })
      .catch(() => {
        if (active) {
          setRcDetail(null);
          setRcPhotos([]);
        }
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

  // Үе шат (RECOUNT_STEPS) — тодруулалтын одоогийн үе шат ба «хээрийн» шат
  const curStepIdx = rSteps.findIndex(
    (st) => String(st.id) === String(rcDetail?.step?.id),
  );
  // Хээрийн үе шат — нэрээр нь биш ч болох ганц шинж: «хээр» гэсэн үг
  const isFieldStep = (st) => (st?.name || "").toLowerCase().includes("хээр");
  // Тодруулалт солигдоход одоогийн үе шат руу нь задална
  useEffect(() => {
    setStepView(curStepIdx >= 0 ? curStepIdx : 0);
  }, [curStepIdx]);

  // ── Тодруулалтын хээрийн зураг — нэмэх / устгах ──
  const handleAddPhotos = async () => {
    if (!name?.id || !newPhotos.length) return;
    setPhotoBusy(true);
    try {
      const added = [];
      // Олон зургийг нэг нэгээр (backend PNG 800×800 болгож хадгална)
      for (let i = 0; i < newPhotos.length; i += 1) {
        const fd = new FormData();
        fd.append("file", newPhotos[i].file);
        // Зовхис — компасын өнцгөөс (Хойд, Зүүн урд гэх мэт)
        fd.append("desc", angleToDirection(newPhotos[i].deg));
        // eslint-disable-next-line no-await-in-loop
        const res = await axiosInstance.post(
          endpoints.recount.addPhoto(name.id),
          fd,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        if (res?.data?.id) added.push(res.data);
      }
      setRcPhotos((prev) => [...prev, ...added]);
      setNewPhotos([]);
      setPhotoDlg(false);
      enqueueSnackbar(`${added.length} зураг нэмэгдлээ`);
    } catch (e) {
      enqueueSnackbar(
        e?.response?.data?.detail || "Зураг нэмэхэд алдаа гарлаа",
        {
          variant: "warning",
        },
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleDelPhoto = async (photoId) => {
    if (!name?.id) return;
    try {
      await axiosInstance.post(endpoints.recount.delPhoto(name.id), {
        photo_id: photoId,
      });
      setRcPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (e) {
      enqueueSnackbar("Зураг устгахад алдаа гарлаа", { variant: "warning" });
    }
  };

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
      enqueueSnackbar(
        e?.response?.data?.detail || "Байрлал хадгалахад алдаа гарлаа",
        {
          variant: "warning",
        },
      );
    }
  };

  // ' 1219 1220 ' → [1219,1220]
  const parseStatusIds = (s) =>
    String(s || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);

  // Хилийн цэс (GeoName.is_border) — анхдагч тэмдэглээгүй
  const [rcBorder, setRcBorder] = useState(false);

  // Ангиллын сонголт — ЗӨВХӨН батлагдсан нэргүй (draft) тодруулалтад.
  // Ийм тодруулалтын төрөл нь ReCount.type дээр хадгалагдана.
  const { constants: geoTypes } = useGetConstantsFordropdown("GEONAME_TYPES");
  const childrenOf = useCallback(
    (parentId) =>
      geoTypes.filter((t) => (t.parent ?? null) === (parentId ?? null)),
    [geoTypes],
  );
  const rcTy1 = useMemo(() => childrenOf(null), [childrenOf]);
  const rcTy2 = useMemo(
    () => (rcT1?.id ? childrenOf(rcT1.id) : []),
    [childrenOf, rcT1],
  );
  const rcTy3 = useMemo(
    () => (rcT2?.id ? childrenOf(rcT2.id) : []),
    [childrenOf, rcT2],
  );
  // Хадгалахад — сонгосон хамгийн ГҮН ангилал
  const rcTypeId = rcT3?.id || rcT2?.id || rcT1?.id || null;

  // Ангилал солиход доод түвшнүүдийг цэвэрлэнэ
  const setRcTypeLevel = (level, v) => {
    if (level === 1) {
      setRcT1(v);
      setRcT2(null);
      setRcT3(null);
    } else if (level === 2) {
      setRcT2(v);
      setRcT3(null);
    } else {
      setRcT3(v);
    }
  };

  const showTypeField = !name?.name_id; // draft (батлагдсан нэргүй) тодруулалт

  // Нэр оруулах талбар — Constant(RECOUNT_STATUS).label === "true" бүхий
  // төлвүүдэд гарна. Төлвийн нэр/тоо цаашид өөрчлөгдөхөөс хамаарахгүй:
  // аль төлөв нэр шаардахыг Тогтмол дээрээс л удирдана.
  const needsName = (st) =>
    String(st?.label || "")
      .trim()
      .toLowerCase() === "true";
  const activeNameStatus = rStatuses.find(
    (st) => needsName(st) && rcStatusIds.has(st.id),
  );
  // «Хилийн цэс» нь ЗӨВХӨН GeoName.is_border‑ийг өөрчилнө — нэр оруулахгүй.
  const showDraftField = !!activeNameStatus;
  // Гарчиг нь сонгосон төлвийн НЭРЭЭР бүрдэнэ (статик текст барихгүй)
  const draftLabel = activeNameStatus
    ? `${activeNameStatus.name} — нэр`
    : "Нэр";

  // Засах горимыг нээхэд ХУУЧИН төлвүүдийг set хийнэ. draft default = одоогийн нэр.
  const openRcEdit = () => {
    setRcStatusIds(new Set(parseStatusIds(name.status_ids)));
    // Хилийн цэс (GeoName.is_border) — анхдагч false
    setRcBorder(name.is_border === true || name.is_border === "true");
    // Засварласан нэр = ЗӨВХӨН draft (засвар). Батлагдсан нэр биш. Байхгүй бол хоосон.
    setRcDraft(name.draft || "");
    // Одоогийн ангиллын ЗАМЫГ (l1 → l2 → l3) сэргээж сет хийнэ
    const byId = new Map(geoTypes.map((t) => [t.id, t]));
    const chain = [];
    let cur = rcDetail?.type?.id ? byId.get(rcDetail.type.id) : null;
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parent != null ? byId.get(cur.parent) : null;
    }
    setRcT1(chain[0] || null);
    setRcT2(chain[1] || null);
    setRcT3(chain[2] || null);
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
        // Ангилал — зөвхөн draft тодруулалтад (батлагдсан нэрийнх нь өөрийн type)
        ...(showTypeField && rcTypeId ? { type_id: rcTypeId } : {}),
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

  const saveRecount = async (status, draftText, loc) => {
    setSaving(true);
    try {
      await axiosInstance.post(endpoints.recount.create, {
        project_id: recountProjectId,
        name_id: name.id,
        draft: draftText || "",
        ...(rStep?.id ? { step_id: rStep.id } : {}),
        ...(status?.id ? { status_ids: [status.id] } : {}),
        ...(loc
          ? { loc }
          : coord
            ? { loc: { type: "Point", coordinates: coord } }
            : {}),
      });
      enqueueSnackbar(
        `"${name.name}" — ${status?.name || ""} төлөвөөр бүртгэгдлээ`,
      );
      onAfterAction?.();
    } catch (e) {
      enqueueSnackbar(e?.response?.data?.detail || "Бүртгэхэд алдаа гарлаа", {
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  // Төлөв бүрийн үйлдэл нь Тогтмолын утгуудаас шийдэгдэнэ:
  //   label="true"  → нэр бичих диалог нээнэ (зөв/уламжлалт/шинэ нэр…)
  //   code=LOC_CODE → газрын зураг дээр байрлалыг нь зурна
  //   бусад         → шууд бүртгэнэ
  const LOC_CODE = "4"; // Байршил зөрүүтэй — байрлалыг зурж тэмдэглэнэ
  const handleStatus = async (st) => {
    if (!st) return;
    if (String(st.code) === LOC_CODE) {
      const dtype = olDrawType(geomType);
      enqueueSnackbar(
        `"${name.name}" — газрын зураг дээр ${DRAW_LABEL[dtype]} зурна уу (ESC — болих)`,
        { variant: "info" },
      );
      const geojson = await requestMapDraw(dtype);
      if (!geojson) return; // ESC / болих
      await saveRecount(st, name.name, geojson);
    } else if (
      String(st.label || "")
        .trim()
        .toLowerCase() === "true"
    ) {
      setDraftDlg({ status: st, text: name.name || "" });
    } else {
      await saveRecount(st, name.name);
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
      const res = await axiosInstance.post(
        endpoints.geoname.inquire(geonameId),
        {},
      );
      const code = res?.data?.code;
      // ЗААВАЛ /api/ доогуур — nginx дээр /inquire/<code> нь frontend‑ийн
      // QR шалгах хуудас руу очдог тул баримт харагдахгүй болно.
      if (code) window.open(`${HOST_API}/api/inquire/${code}/`, "_blank");
    } catch (e) {
      enqueueSnackbar(
        e?.response?.data?.detail || "Лавлагаа гаргахад алдаа гарлаа",
        {
          variant: "warning",
        },
      );
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
          {name.name && (
            <Typography variant="body1">
              {name.name}
              {/* Дэлгэрэнгүй — нэрний АРД жижиг icon (шинэ таб).
                  draft (geoname‑гүй) recount дээр харагдахгүй. */}
              {(name?._isRecount ? name?.name_id : name?.id) && (
                <Tooltip title="Дэлгэрэнгүй (шинэ таб)">
                  <IconButton
                    component="a"
                    href={`/dashboard/geoname/${
                      name?._isRecount ? name.name_id : name.id
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    sx={{ ml: 0.5, p: 0.25, verticalAlign: "text-bottom" }}
                  >
                    <OpenInNewIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Typography>
          )}

          {/* Дэлгэрэнгүй — geoname рүү. Recount дээр холбоотой geoname (name_id)‑руу;
            draft (geoname‑гүй) recount дээр линк харагдахгүй. */}

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
              {/* Холбогдох ТӨСЛИЙН мэдээлэл */}
              {rcDetail?.project?.name && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  <Typography variant="caption" color="text.secondary">
                    Төсөл:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {rcDetail.project.name}
                    {rcDetail.project.dugaar && rcDetail.project.dugaar !== "un"
                      ? ` · №${rcDetail.project.dugaar}`
                      : ""}
                  </Typography>
                </Stack>
              )}
              {/* Үе шатууд (RECOUNT_STEPS) — босоо stepper. Тодруулалтын
                  ОДООГИЙН үе шат идэвхтэйгээр нээгдэнэ; толгой дээр нь дарж
                  өөр үе шатыг задалж болно. Хээрийн үе шатанд зургууд slider‑ээр. */}
              {recountProjectId && rSteps.length > 0 && (
                <Stepper
                  nonLinear
                  orientation="vertical"
                  activeStep={stepView}
                  sx={{ mt: 0.5, "& .MuiStepLabel-label": { fontSize: 13 } }}
                >
                  {rSteps.map((st, i) => (
                    <Step key={st.id} completed={i < curStepIdx}>
                      <StepButton onClick={() => setStepView(i)}>
                        {st.name}
                        {i === curStepIdx ? " · одоогийн" : ""}
                      </StepButton>
                      <StepContent>
                        {/* Хээрийн шат — зургууд; эхний шат — төлвүүд;
                            сүүлийн шат — хүлээгдэж буй тэмдэглэгээ */}
                        {isFieldStep(st) ? (
                          <PhotoSlider
                            photos={rcPhotos}
                            height={190}
                            onAdd={() => setPhotoDlg(true)}
                            onDelete={handleDelPhoto}
                          />
                        ) : i === 0 ? (
                          <Stack
                            direction="row"
                            spacing={0.5}
                            flexWrap="wrap"
                            useFlexGap
                          >
                            {parseStatusIds(name.status_ids).length === 0 && (
                              <Typography
                                variant="caption"
                                color="text.disabled"
                              >
                                Төлөв тэмдэглээгүй.
                              </Typography>
                            )}
                            {parseStatusIds(name.status_ids).map((id) => {
                              const sc = rStatuses.find(
                                (x) => String(x.id) === String(id),
                              );
                              if (!sc) return null;
                              const c = statusColor(sc);
                              return (
                                <Chip
                                  key={id}
                                  size="small"
                                  variant="filled"
                                  label={sc.name}
                                  sx={{
                                    bgcolor: c,
                                    color: "#fff",
                                    fontWeight: 600,
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="warning.main">
                            Хүлээгдэж байна
                          </Typography>
                        )}
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              )}

              {/* Байрлал засах — QGIS маягаар геометр засах. ЗӨВХӨН төслийн газрын
            зураг (champaign/<id>/map) дээр — бусад газар харагдахгүй. */}
              {geonameId && recountProjectId && editingGeom && (
                <Box sx={{ mt: 0.5 }}>
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
                      color="primary"
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
                </Box>
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
                  {geonameId && !editingGeom && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleEditGeom}
                      sx={{ textTransform: "none" }}
                    >
                      Байрлал засах
                    </Button>
                  )}
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
                <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                    {rStatuses.map((s) => {
                      const c = statusColor(s);
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
                      label={draftLabel}
                      value={rcDraft}
                      onChange={(e) => setRcDraft(e.target.value)}
                    />
                  )}
                  {/* Ангилал — батлагдсан нэргүй (Уламжлалт / Шинээр үүссэн
                      гэх мэт) тодруулалт ЗААВАЛ ангилалтай байна */}
                  {showTypeField && (
                    <Stack direction="row" spacing={1}>
                      <Autocomplete
                        size="small"
                        sx={{ flex: 1, minWidth: 0 }}
                        value={rcT1}
                        onChange={(_e, v) => setRcTypeLevel(1, v)}
                        options={rcTy1}
                        getOptionLabel={(o) => o?.name || ""}
                        isOptionEqualToValue={(o, v) => o?.id === v?.id}
                        renderInput={(params) => (
                          <TextField {...params} label="Үндсэн" />
                        )}
                      />
                      <Autocomplete
                        size="small"
                        sx={{ flex: 1, minWidth: 0 }}
                        value={rcT2}
                        disabled={!rcT1?.id || !rcTy2.length}
                        onChange={(_e, v) => setRcTypeLevel(2, v)}
                        options={rcTy2}
                        getOptionLabel={(o) => o?.name || ""}
                        isOptionEqualToValue={(o, v) => o?.id === v?.id}
                        renderInput={(params) => (
                          <TextField {...params} label="Дэд" />
                        )}
                      />
                      <Autocomplete
                        size="small"
                        sx={{ flex: 1, minWidth: 0 }}
                        value={rcT3}
                        disabled={!rcT2?.id || !rcTy3.length}
                        onChange={(_e, v) => setRcTypeLevel(3, v)}
                        options={rcTy3}
                        getOptionLabel={(o) => o?.name || ""}
                        isOptionEqualToValue={(o, v) => o?.id === v?.id}
                        renderInput={(params) => (
                          <TextField {...params} label="Ангилал" />
                        )}
                      />
                    </Stack>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      color="inherit"
                      variant="outlined"
                      disabled={saving}
                      onClick={() => setRcEdit(false)}
                      sx={{ flexShrink: 0 }}
                    >
                      Буцах
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      color="primary"
                      disabled={saving}
                      onClick={saveRecountStatuses}
                    >
                      Хадгалах
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Stack>
          ) : recountProjectId ? (
            /* Төслийн газрын зураг — тодруулалтын төлвүүд.
               Жагсаалт, нэр, ӨНГӨ бүгд Constant(RECOUNT_STATUS)‑оос ирнэ. */
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1 }}
            >
              {rStatuses.map((st) => {
                const c = statusColor(st);
                return (
                  <Button
                    key={st.id}
                    variant="outlined"
                    size="small"
                    disabled={saving || !name?.id}
                    onClick={() => handleStatus(st)}
                    sx={{
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: 11,
                      px: 0.75,
                      color: c,
                      borderColor: c,
                      "&:hover": { borderColor: c, bgcolor: `${c}14` },
                    }}
                  >
                    {st.name}
                  </Button>
                );
              })}
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

      {/* Тодруулалтын зураг нэмэх — олон зураг + зовхис (компас) */}
      <Dialog
        open={photoDlg}
        onClose={() => setPhotoDlg(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Хээрийн зураг нэмэх</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary">
            {name?.name || name?.draft} — зураг бүрд объектоос авсан зовхисыг
            компас дээр тааруулна.
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <PhotoDirectionPicker value={newPhotos} onChange={setNewPhotos} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setPhotoDlg(false)}>
            Болих
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={photoBusy || !newPhotos.length}
            onClick={handleAddPhotos}
          >
            Хадгалах
          </Button>
        </DialogActions>
      </Dialog>

      {/* Зөрүүтэй / Алдаатай — draft (зөв/тэмдэглэх) бичих диалог */}
      <Dialog
        open={!!draftDlg}
        onClose={() => setDraftDlg(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {draftDlg?.status?.name || "Тодруулалт"} — нэр
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
            color="primary"
            disabled={saving}
            onClick={() => {
              const d = draftDlg;
              setDraftDlg(null);
              saveRecount(d.status, d.text);
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
