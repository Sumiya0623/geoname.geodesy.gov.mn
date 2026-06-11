"use client";

import PropTypes from "prop-types";
import React, { useState } from "react";

import { useTheme } from "@mui/material/styles";
import {
  Box,
  Tooltip,
  InputBase,
  IconButton,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  TuneRounded as TuneIcon,
  LayersRounded as LayersIcon,
} from "@mui/icons-material";

import Guide from "src/utils/guide";
import AccountPopover from "src/layouts/common/account-popover";
import NotificationsPopover from "src/layouts/common/notifications-popover";

import MapNavDrawer from "./MapNavDrawer";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн портал — дээд толгой. Зүүн талд цэс нээх товч + лого + нэр,
// голд нь нэр хайх + дэлгэрэнгүй хайлт, баруунд нэвтрэх / хэрэглэгч.
// ----------------------------------------------------------------------

const BLUE = "#0b4ea2";

export default function MapHeader({ onMenu, onAdvanced, onSearchText }) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));
  const [text, setText] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const submit = () => onSearchText && onSearchText(text.trim());

  return (
    <Box
      sx={{
        height: 60,
        flexShrink: 0,
        px: { xs: 1, md: 2 },
        bgcolor: BLUE,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: { xs: 0.5, md: 1.5 },
        boxShadow: "0 2px 10px rgba(0,0,0,.15)",
        zIndex: 30,
      }}
    >
      {/* Зүүн: үндсэн цэс + хяналт + лого + нэр */}
      <Tooltip title="Үндсэн цэс">
        <IconButton onClick={() => setNavOpen(true)} sx={{ color: "#fff" }}>
          <MenuIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Удирдлага">
        <IconButton onClick={onMenu} sx={{ color: "#fff" }}>
          <LayersIcon />
        </IconButton>
      </Tooltip>

      {!isSmall && (
        <Box sx={{ lineHeight: 1.1, mr: 1 }}>
          <Typography
            sx={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 0.2 }}
          >
            ГАЗАР ЗҮЙН НЭРИЙН ДЭД СИСТЕМ
          </Typography>
        </Box>
      )}

      {/* Гол: хайх */}
      <Box
        sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            bgcolor: "#fff",
            borderRadius: 999,
            pl: 1.5,
            pr: 0.5,
            py: 0.4,
            width: { xs: "100%", md: 520 },
            maxWidth: "100%",
            boxShadow: "0 1px 4px rgba(0,0,0,.12)",
          }}
        >
          <SearchIcon sx={{ color: "#94a3b8", fontSize: 20 }} />
          <InputBase
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Газар зүйн нэр хайх..."
            sx={{ ml: 1, flex: 1, fontSize: 14, color: "#0f172a" }}
          />
          {/* Хайх товч — mobile дээр Enter байхгүй тул товчоор хайлт эхлүүлнэ */}
          <Tooltip title="Хайх">
            <IconButton
              size="small"
              onClick={submit}
              sx={{
                bgcolor: BLUE,
                color: "#fff",
                mr: 0.5,
                "&:hover": { bgcolor: "#0a3f82" },
              }}
            >
              <SearchIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Дэлгэрэнгүй хайлт">
            <IconButton
              size="small"
              onClick={() => onAdvanced && onAdvanced(text.trim())}
              sx={{
                bgcolor: BLUE,
                color: "#fff",
                "&:hover": { bgcolor: "#0a3f82" },
              }}
            >
              <TuneIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Баруун: тусламж, мэдэгдэл, хэрэглэгч (dashboard‑ийнх шиг) */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.25, sm: 0.75 },
          "& .MuiIconButton-root": { color: "#fff" },
          "& .MuiBadge-badge": { color: "#fff" },
        }}
      >
        <Guide />
        <NotificationsPopover />
        <AccountPopover />
      </Box>

      <MapNavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </Box>
  );
}

MapHeader.propTypes = {
  onMenu: PropTypes.func,
  onAdvanced: PropTypes.func,
  onSearchText: PropTypes.func,
};
