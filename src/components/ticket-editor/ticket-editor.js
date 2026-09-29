"use client";

import PropTypes from "prop-types";

import TextField from "@mui/material/TextField";

// ----------------------------------------------------------------------
// Тусламжийн хүсэлтийн бичвэр. Төв систем HTML хүлээж авдаг тул мөр таслалыг
// догол мөр болгож хадгална. Нэмэлт сан шаардахгүй, энгийн талбар.
// ----------------------------------------------------------------------

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function htmlToText(html) {
  return String(html || "")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function textToHtml(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export default function TicketEditor({
  id,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  minHeight = 180,
  sx,
}) {
  return (
    <TextField
      id={id}
      fullWidth
      multiline
      minRows={6}
      value={htmlToText(value)}
      onChange={(event) => onChange?.(textToHtml(event.target.value))}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      sx={{ "& .MuiInputBase-root": { minHeight }, ...sx }}
    />
  );
}

TicketEditor.propTypes = {
  id: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  error: PropTypes.bool,
  helperText: PropTypes.node,
  minHeight: PropTypes.number,
  sx: PropTypes.object,
};
