import PropTypes from "prop-types";
import { useMemo, useState, useEffect, useCallback } from "react";

import {
  Box,
  Stack,
  Button,
  Dialog,
  Switch,
  Divider,
  IconButton,
  Typography,
  ToggleButton,
  FormControlLabel,
  ToggleButtonGroup,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import axiosInstance, { endpoints } from "src/utils/axios";
import SumTree from "src/sections/map-ml/sum-tree";
import NameGrid from "src/sections/map-ml/name-grid";

// ----------------------------------------------------------------------
// Тодруулалт → «Машин» (хэрэглэгч 2026-11-16: «map-ml гэж тусдаа хуудасгүй, тодруулалтын санд Машин/Гараар switch»).
// Шалгах шаардлагатай хэсгүүд (Recount-гүй, todo > 0) Аймаг → Сум модоор; чагт = газрын зурагт харуулах,
// нэр дээр дарах = тэр сум руу очих / идэвхтэй сум. Давхаргууд, дарж засах нь үндсэн газрын зураг (index.js) дээр.
// ----------------------------------------------------------------------

export default function MlPanel({ onState, onFlyTo }) {
  const [sums, setSums] = useState([]);
  const [shown, setShown] = useState(null); // null = бүгд
  const [active, setActive] = useState("");
  const [layers, setLayers] = useState({ places: true, texts: true, syms: false, confirmed: false });
  const [grid, setGrid] = useState(false);
  const [proj, setProj] = useState("nameqc"); // nameqc = Машин сургалт, hydro = УСЗҮЙ-МАШИН СУРГАЛТ (тусдаа)

  const reload = useCallback(() => {
    axiosInstance
      .get(endpoints.ml.nameRevTags)
      .then(({ data }) => setSums(data || []))
      .catch(() => setSums([]));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const manual = useMemo(
    () => sums.filter((x) => x.todo > 0 && !x.auto && (x.project || "nameqc") === proj),
    [sums, proj],
  );
  const tags = useMemo(() => {
    if (active) return [active];
    const all = manual.map((x) => x.tag);
    return shown ? all.filter((t) => shown.has(t)) : all;
  }, [manual, shown, active]);

  useEffect(() => {
    onState({ tags, layers, reload });
  }, [tags, layers, reload, onState]);
  // самбар хаагдахад давхаргуудыг арилгана
  useEffect(() => () => onState(null), [onState]);

  const pick = (t) => {
    setActive(t);
    const s = sums.find((x) => x.tag === t);
    const lon = s?.lon ?? s?.lon_all;
    const lat = s?.lat ?? s?.lat_all;
    if (t && lon != null) onFlyTo({ center: [lon, lat], zoom: 11 });
  };

  const sw = (k, label) => (
    <FormControlLabel
      sx={{ ml: 0 }}
      control={
        <Switch
          size="small"
          checked={layers[k]}
          onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))}
        />
      }
      label={<Typography variant="body2">{label}</Typography>}
    />
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ px: 1.5, pt: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={proj}
          onChange={(_e, v) => {
            if (!v) return;
            setProj(v);
            setActive("");
            setShown(null);
          }}
          sx={{ mb: 0.5, "& .MuiToggleButton-root": { py: 0.25, fontSize: 12 } }}
        >
          <ToggleButton value="nameqc">Машин сургалт</ToggleButton>
          <ToggleButton value="hydro">УСЗҮЙ</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="overline" color="text.secondary">
          Шалгах хэсэг — {manual.reduce((n, x) => n + x.todo, 0)} мөр
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1 }}>
        <SumTree
          sums={manual}
          checked={shown || new Set(manual.map((x) => x.tag))}
          onToggle={(ts, on) =>
            setShown((prev) => {
              const n = new Set(prev || manual.map((x) => x.tag));
              ts.forEach((t) => (on ? n.add(t) : n.delete(t)));
              return n;
            })
          }
          active={active}
          onPick={pick}
        />
      </Box>
      <Divider />
      <Stack sx={{ px: 1.5, py: 1 }} spacing={0.25}>
        <Button
          variant="contained"
          size="small"
          disabled={!active}
          onClick={() => setGrid(true)}
          sx={{ mb: 0.5 }}
        >
          {active ? "▶ Нэрийг дараалан шалгах" : "Сумаа сонгоно уу (нэр дээр нь дарна)"}
        </Button>
        {sw("places", "Шинэ таамаг (улаан)")}
        {sw("texts", "Тулгаж чадаагүй бичвэр (саарал)")}
        {sw("syms", "Олсон тэмдэг")}
        {sw("confirmed", "Батлагдсан таамаг (бүдэг)")}
        <Typography variant="caption" color="text.secondary">
          Газрын зураг дээр цэг/бичвэр дээр дарж нэрийг засна.
        </Typography>
      </Stack>
      <Dialog fullScreen open={grid} onClose={() => setGrid(false)}>
        <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
          <IconButton
            onClick={() => {
              setGrid(false);
              reload();
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 2, overflow: "auto", height: "100%" }}>{active && <NameGrid tag={active} />}</Box>
      </Dialog>
    </Box>
  );
}
MlPanel.propTypes = { onState: PropTypes.func, onFlyTo: PropTypes.func };
