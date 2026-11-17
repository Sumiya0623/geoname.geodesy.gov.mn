"use client";

// «Асуудалтай ▾» — алгасах шалтгаан (хэрэглэгч 2026-11-17: «алгасах» гэдэг нь ойлгомжгүй; нэр мөн боловч өөр төрөл,
// байршил зөрсөн, нуурын талбай тэмдэглээгүй …). verdict = 'later' + reason → дарааллаас гарна, устахгүй, тодруулга
// үүсэхгүй; шалтгаан nameqc_namerev.reason-д үлдэж сургалтад тусад нь ашиглагдана.

import PropTypes from "prop-types";
import { useState } from "react";

import { Menu, Button, MenuItem, ListItemText } from "@mui/material";

export const ISSUES = [
  { k: "othertype", t: "Нэр мөн, өөр төрлийн", d: "толгой, уул, гол … — энэ ажилд хамаарахгүй" },
  { k: "posoff", t: "Байршил зөрсөн", d: "нэр зөв, цэг тэмдэг дээр биш (зөөж чадаагүй)" },
  { k: "noarea", t: "Нуурын талбай тэмдэглээгүй", d: "нэр зөв, хил гараагүй/буруу" },
  { k: "shape", t: "Шугам/талбайн нэр", d: "гуу, жалга, ам … зурах шаардлагатай" },
  { k: "doubt", t: "Эргэлзээтэй", d: "дараа дахин харна" },
];
export const issueLabel = (k) => ISSUES.find((x) => x.k === k)?.t || "алгассан";

export default function IssueMenu({ onPick, disabled, size = "small" }) {
  const [el, setEl] = useState(null);
  return (
    <>
      <Button size={size} color="secondary" disabled={disabled} onClick={(e) => setEl(e.currentTarget)}>
        Асуудалтай ▾
      </Button>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)}>
        {ISSUES.map((x) => (
          <MenuItem
            key={x.k}
            dense
            onClick={() => {
              setEl(null);
              onPick(x.k);
            }}
          >
            <ListItemText primary={x.t} secondary={x.d} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
IssueMenu.propTypes = { onPick: PropTypes.func, disabled: PropTypes.bool, size: PropTypes.string };
