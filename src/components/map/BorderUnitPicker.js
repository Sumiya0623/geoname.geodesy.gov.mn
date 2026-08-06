"use client";

import PropTypes from "prop-types";
import { useMemo, useState, useEffect } from "react";

import {
  Box,
  Stack,
  Chip,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetConstantsFordropdown } from "src/api/constant";

// ----------------------------------------------------------------------
// Хилийн цэсийн ХАРЬЯАЛАЛ — нэг цэг олон аймаг/сум/багийн зааг дээр байж болно.
// Түвшин бүрд (UNITLEVEL) ОЛОН сонголттой, дараалсан (dependent) жагсаалт:
//   • эхний түвшин  — цэгийн ойролцоох нэгжүүд (ЗЗ нэгжийн near API)
//   • дараагийнх нь — сонгосон дээд нэгжүүдийн ДОТОРХ, мөн зурагт ойролцоо нь
// Дээд түвшний сонголт өөрчлөгдвөл доод түвшний харьяалалгүй болсон
// сонголтууд автоматаар хасагдана.
// ----------------------------------------------------------------------

export default function BorderUnitPicker({
  lon,
  lat,
  value,
  onChange,
  km = 30,
  // Хэдэн түвшин хүртэл сонгуулах вэ — хилийн цэс БАГ хүртэл тодорхойлогдоно
  // (суурин хэрэггүй)
  levelDepth = 3,
}) {
  // UNITLEVEL — Аймаг/Нийслэл → Сум/Дүүрэг → Баг/Хороо → Суурин (DB‑ээс)
  const { constants: levels = [] } = useGetConstantsFordropdown("UNITLEVEL");
  const ordered = useMemo(
    () =>
      [...levels]
        .sort((a, b) => (a.id || 0) - (b.id || 0))
        .slice(0, levelDepth),
    [levels, levelDepth],
  );

  // Түвшин бүрийн СОНГОЛТУУД (options) ба СОНГОСОН нэгжүүд
  const [options, setOptions] = useState({}); // {levelId: [unit]}
  const picked = value || []; // [{id, unit, level, parent}]

  const atLevel = (levelName) =>
    picked.filter((u) => (u.level || "") === levelName);

  // Түвшин бүрийн сонголтыг татна — дээд түвшний сонголтоос хамаарна
  useEffect(() => {
    if (lon == null || lat == null || !ordered.length) return;
    let alive = true;
    (async () => {
      const next = {};
      let parentIds = null; // эхний түвшинд хамаарахгүй
      // eslint-disable-next-line no-restricted-syntax
      for (const lv of ordered) {
        // Дээд түвшин сонгогдоогүй бол доод түвшнийг татахгүй (хоосон үлдэнэ)
        if (parentIds !== null && !parentIds.length) {
          next[lv.id] = [];
          // eslint-disable-next-line no-continue
          continue;
        }
        const q = new URLSearchParams({
          lon: String(lon),
          lat: String(lat),
          level: String(lv.id),
          km: String(km),
          ...(parentIds?.length ? { parent: parentIds.join(",") } : {}),
        }).toString();
        try {
          // eslint-disable-next-line no-await-in-loop
          const res = await axiosInstance.get(endpoints.unit.near(q));
          next[lv.id] = res?.data?.results || [];
        } catch (e) {
          next[lv.id] = [];
        }
        parentIds = picked
          .filter((u) => (u.level || "") === lv.name)
          .map((u) => u.id);
      }
      if (alive) setOptions(next);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lon, lat, km, ordered, JSON.stringify(picked.map((u) => u.id))]);

  // Нэг түвшний сонголт солигдоход — доод түвшнүүдээс харьяалалгүй болсныг хасна
  const handleLevel = (lv, vals) => {
    const rest = picked.filter((u) => (u.level || "") !== lv.name);
    const merged = [...rest, ...vals];
    const idx = ordered.findIndex((l) => l.id === lv.id);
    const lowerNames = ordered.slice(idx + 1).map((l) => l.name);
    const keepIds = new Set(vals.map((v) => v.id));
    const cleaned = merged.filter((u) => {
      if (!lowerNames.includes(u.level || "")) return true;
      // Шууд эцэг нь сонгогдсон хэвээр байвал үлдээнэ
      if (u.parent == null) return true;
      // Зөвхөн ЭНЭ түвшний шууд хүүхдүүдийг шалгана
      const isDirectChild = ordered[idx + 1]?.name === (u.level || "");
      return isDirectChild ? keepIds.has(u.parent) : true;
    });
    onChange?.(cleaned);
  };

  if (lon == null || lat == null) return null;

  // Динамик тайлбар — түвшний нэрсийг DB‑ээс (Аймаг, Сум, Баг …)
  const helper = `Дэлгэцэнд харагдах ${ordered
    .map((l) => (l.name || "").split("/")[0].toLowerCase())
    .join(", ")} гэх мэтээр сольж харуул`;

  return (
    <Stack spacing={1}>
      {/* Аймаг · Сум · Баг — НЭГ мөрөнд зэрэгцүүлнэ (нарийн үед доошоо буурна) */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems="flex-start"
      >
        {ordered.map((lv, i) => {
          const sel = atLevel(lv.name);
          // Хадгалсан сонголт нь ойролцоох жагсаалтад (радиусаас гадуур) байхгүй
          // байж болно — тэднийг сонголтын жагсаалтад нэмж оруулна
          const near = options[lv.id] || [];
          const nearIds = new Set(near.map((o) => o.id));
          const opts = [...near, ...sel.filter((o) => !nearIds.has(o.id))];
          // Дээд түвшин сонгоогүй бол доод түвшин ИДЭВХГҮЙ (мөрөнд байрлал нь
          // хадгалагдана — гэнэт нүүхгүй). Хадгалсан сонголттой бол засагдана.
          const noParent = i > 0 && !atLevel(ordered[i - 1].name).length;
          const disabled = noParent && !sel.length;
          return (
            <Autocomplete
              key={lv.id}
              multiple
              size="small"
              sx={{ flex: 1, minWidth: 0 }}
              disabled={disabled}
              options={opts}
              value={sel}
              onChange={(_e, v) => handleLevel(lv, v)}
              getOptionLabel={(o) => o?.unit || ""}
              isOptionEqualToValue={(o, v) => o?.id === v?.id}
              renderTags={(tags, getTagProps) =>
                tags.map((o, idx) => (
                  <Chip
                    size="small"
                    variant="soft"
                    label={o.unit}
                    {...getTagProps({ index: idx })}
                    key={o.id}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField {...params} label={lv.name} placeholder="Сонгох" />
              )}
            />
          );
        })}
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </Box>
    </Stack>
  );
}

BorderUnitPicker.propTypes = {
  levelDepth: PropTypes.number,
  lon: PropTypes.number,
  lat: PropTypes.number,
  value: PropTypes.array,
  onChange: PropTypes.func,
  km: PropTypes.number,
};
