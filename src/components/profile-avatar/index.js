import {
  Avatar,
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Tooltip,
  Typography,
  IconButton,
  Chip,
} from "@mui/material";
import React, { useState } from "react";
import CustomPopover, { usePopover } from "../custom-popover";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

function ProfileAvatar({ user, size = 40, avatarSx = {} }) {
  const userPopover = usePopover();
  const [copiedStates, setCopiedStates] = useState({});

  const handleCopyToClipboard = async (e, text, field) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedStates((prev) => ({ ...prev, [field]: true }));

      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [field]: false }));
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const rawPhoto = user?.photo;
  const photoSrc =
    rawPhoto && typeof rawPhoto === "string"
      ? rawPhoto.startsWith("http")
        ? rawPhoto
        : `${process.env.NEXT_PUBLIC_HOST_API}${rawPhoto}`
      : undefined;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: user ? "pointer" : "default",
          alignSelf: "flex-start",
          minWidth: size,
          minHeight: size,
        }}
        onClick={
          user
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                userPopover.onOpen(e);
              }
            : undefined
        }
      >
        <Tooltip title={"Дэлгэрэнгүй"} arrow>
          <Avatar
            alt={user?.full_name || user?.first_name}
            src={photoSrc || user?.photo}
            sx={{
              width: size,
              height: size,
              lineHeight: 1,
              ...avatarSx,
            }}
          />
        </Tooltip>
      </Box>
      {user && (
        <CustomPopover
          open={userPopover.open}
          onClose={userPopover.onClose}
          arrow="left-top"
          sx={{ p: 0, width: 300 }}
        >
          <Card elevation={0} sx={{ boxShadow: "none" }}>
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Avatar
                  alt={user?.full_name || user?.first_name}
                  src={photoSrc || user?.photo}
                  sx={{ width: 56, height: 56 }}
                />
                <Box>
                  <Typography variant="subtitle2">
                    {user?.full_name || user?.first_name}
                  </Typography>
                  {user?.roles?.length > 0 && (
                    <Box
                      sx={{
                        mt: 0.1,
                        display: "flex-start",
                        flexDirection: "column",
                        gap: 0.1,
                        maxWidth: "100%",
                      }}
                    >
                      {user.roles.map((role) => (
                        <Chip
                          key={role.id || role.name}
                          label={role.name}
                          variant="filled"
                          color="primary"
                          sx={{
                            mt: 0.5,
                            p: 0.5,
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            maxWidth: "100%",
                            height: "auto",
                            "& .MuiChip-label": {
                              px: 1,
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              lineHeight: 1.2,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  )}
                  {user?.is_citizen === true && user?.org && (
                    <Typography variant="caption" color="text.secondary">
                      {user?.org?.full_name}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {user?.register && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      "&:hover .copy-icon": { opacity: 1 },
                    }}
                    onClick={(e) =>
                      handleCopyToClipboard(e, user.register, "register")
                    }
                  >
                    <Typography variant="caption" color="text.secondary">
                      Регистр:{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.primary"
                      >
                        {user?.register}
                      </Typography>
                    </Typography>
                    <Tooltip
                      title={copiedStates.register ? "Хуулагдлаа!" : "Хуулах"}
                      arrow
                    >
                      <IconButton
                        className="copy-icon"
                        sx={{
                          opacity: 0,
                          transition: "opacity 0.2s",
                          ml: 1,
                          p: 0.25,
                          "&:hover": { backgroundColor: "action.hover" },
                        }}
                      >
                        {copiedStates.register ? (
                          <CheckIcon
                            sx={{ fontSize: 14, color: "success.main" }}
                          />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                {user?.email && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      "&:hover .copy-icon": { opacity: 1 },
                    }}
                    onClick={(e) =>
                      handleCopyToClipboard(e, user.email, "email")
                    }
                  >
                    <Typography variant="caption" color="text.secondary">
                      Имейл:{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.primary"
                      >
                        {user?.email}
                      </Typography>
                    </Typography>
                    <Tooltip
                      title={copiedStates.email ? "Хуулагдлаа!" : "Хуулах"}
                      arrow
                    >
                      <IconButton
                        className="copy-icon"
                        sx={{
                          opacity: 0,
                          transition: "opacity 0.2s",
                          ml: 1,
                          p: 0.25,
                          "&:hover": { backgroundColor: "action.hover" },
                        }}
                      >
                        {copiedStates.email ? (
                          <CheckIcon
                            sx={{ fontSize: 14, color: "success.main" }}
                          />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                {user?.phone && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      "&:hover .copy-icon": { opacity: 1 },
                    }}
                    onClick={(e) =>
                      handleCopyToClipboard(e, user.phone, "phone")
                    }
                  >
                    <Typography variant="caption" color="text.secondary">
                      Дугаар:{" "}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.primary"
                      >
                        {user?.phone}
                      </Typography>
                    </Typography>
                    <Tooltip
                      title={copiedStates.phone ? "Хуулагдлаа!" : "Хуулах"}
                      arrow
                    >
                      <IconButton
                        className="copy-icon"
                        sx={{
                          opacity: 0,
                          transition: "opacity 0.2s",
                          ml: 1,
                          p: 0.25,
                          "&:hover": { backgroundColor: "action.hover" },
                        }}
                      >
                        {copiedStates.phone ? (
                          <CheckIcon
                            sx={{ fontSize: 14, color: "success.main" }}
                          />
                        ) : (
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </CustomPopover>
      )}
    </>
  );
}

export default ProfileAvatar;
