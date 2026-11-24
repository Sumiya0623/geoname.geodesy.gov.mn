import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Collapse,
  Checkbox,
  IconButton,
  Typography,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Public as AimagIcon,
  AccountBalance as SumIcon,
} from "@mui/icons-material";

// ----------------------------------------------------------------------
// Шалгах шаардлагатай хэсгүүд (map-ml tags, todo > 0, Recount-гүй) — Аймаг → Сум мод
// (хэрэглэгч 2026-11-16: «Тодруулалтын газрын зураг шиг аймаг сумаар нь шалгадаг болгомоор»).
// Чагт = газрын зурагт харуулах; сумын нэр дээр дарах = тэр сум руу очиж, дараалан шалгах сум болгох.
// ----------------------------------------------------------------------

function AimagNode({ aimag, items, checked, onToggle, active, onPick }) {
  const [open, setOpen] = useState(true);
  const tags = items.map((x) => x.tag);
  const all = tags.every((t) => checked.has(t));
  const some = tags.some((t) => checked.has(t));
  const total = items.reduce((s, x) => s + x.todo, 0);
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", py: 0.15 }}>
        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setOpen((o) => !o)}>
          {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
        <Checkbox
          size="small"
          sx={{ p: 0.25 }}
          checked={all}
          indeterminate={!all && some}
          onChange={() => onToggle(tags, !all)}
        />
        <AimagIcon sx={{ fontSize: 18, color: "#0675c9", mx: 0.5 }} />
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
          {aimag || "—"}
        </Typography>
        <Chip size="small" label={total} sx={{ height: 20, fontSize: 11 }} />
      </Box>
      <Collapse in={open} unmountOnExit>
        {items.map((x) => (
          <Box
            key={x.tag}
            sx={{
              display: "flex",
              alignItems: "center",
              pl: 3.5,
              py: 0.1,
              borderRadius: 1,
              bgcolor: active === x.tag ? "#7c3aed14" : undefined,
              "&:hover": { bgcolor: "#0675c90d" },
            }}
          >
            <Checkbox
              size="small"
              sx={{ p: 0.25 }}
              checked={checked.has(x.tag)}
              onChange={() => onToggle([x.tag], !checked.has(x.tag))}
            />
            <SumIcon sx={{ fontSize: 16, color: "#7c3aed", mx: 0.5 }} />
            <Typography
              variant="body2"
              sx={{ flex: 1, cursor: "pointer", fontWeight: active === x.tag ? 700 : 400 }}
              noWrap
              onClick={() => onPick(active === x.tag ? "" : x.tag)}
              title="Дарж тэр сум руу очих / дараалан шалгах"
            >
              {x.unit || x.tag}
            </Typography>
            <Chip
              size="small"
              color={active === x.tag ? "secondary" : "default"}
              label={x.todo}
              sx={{ height: 20, fontSize: 11 }}
            />
          </Box>
        ))}
      </Collapse>
    </>
  );
}
AimagNode.propTypes = {
  aimag: PropTypes.string,
  items: PropTypes.array,
  checked: PropTypes.object,
  onToggle: PropTypes.func,
  active: PropTypes.string,
  onPick: PropTypes.func,
};

export default function SumTree({ sums, checked, onToggle, active, onPick }) {
  const groups = useMemo(() => {
    const g = {};
    // төсөл тус бүр тусдаа бүлэг: o<сум> = «1 M100k Open» (машинаар хэвлэсэн зургаас, 2026-11-24)
    sums.forEach((x) => {
      const k = x.project === "open" ? `1 M100k Open · ${x.aimag || ""}` : x.aimag || "";
      (g[k] = g[k] || []).push(x);
    });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0], "mn"));
  }, [sums]);
  if (!sums.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        Шалгах шаардлагатай хэсэг алга.
      </Typography>
    );
  }
  return (
    <Box>
      {groups.map(([aimag, items]) => (
        <AimagNode
          key={aimag}
          aimag={aimag}
          items={items}
          checked={checked}
          onToggle={onToggle}
          active={active}
          onPick={onPick}
        />
      ))}
    </Box>
  );
}
SumTree.propTypes = {
  sums: PropTypes.array,
  checked: PropTypes.object,
  onToggle: PropTypes.func,
  active: PropTypes.string,
  onPick: PropTypes.func,
};
