import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import ListItemText from "@mui/material/ListItemText";
import Button from "@mui/material/Button";
import LoadingButton from "@mui/lab/LoadingButton";
import { useTheme } from "@emotion/react";
import Iconify from "src/components/iconify";
import axiosInstance, { endpoints } from "src/utils/axios";

export default function ProfileCover({ user }) {
  const theme = useTheme();
  const fileInputRef = useRef(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      setIsDirty(true);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSave = async () => {
    if (!selectedPhoto || !user?.id) return;
    const formData = new FormData();
    formData.append("id", String(user.id));
    formData.append("photo", selectedPhoto);

    const url = endpoints.user.edit(user.id);
    const method = "patch";

    const debugEntries = [];
    for (const [key, value] of formData.entries()) {
      debugEntries.push([
        key,
        value instanceof File
          ? `${value.name} (${value.type}, ${value.size}b)`
          : value,
      ]);
    }

    try {
      setUploading(true);
      await axiosInstance[method](url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setIsDirty(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <Box>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          left: { md: 24 },
          bottom: { md: 10 },
          zIndex: { md: 10 },
          top: { md: 10 },
          position: { md: "absolute" },
        }}
      >
        {user?.is_citizen ? (
          <Box
            sx={{
              position: "relative",
              display: "inline-flex",
              mx: "auto",
              width: { xs: 64, md: 128 },
              height: { xs: 64, md: 128 },
              borderRadius: "50%",
              overflow: "hidden",
              "&:hover .edit-overlay": { opacity: 1 },
            }}
          >
            <Avatar
              alt={user?.full_name}
              src={previewUrl || user?.photo}
              sx={{
                width: 1,
                height: 1,
                border: `solid 2px ${theme.palette.common.dark}`,
              }}
            >
              {user?.full_name?.charAt(0).toUpperCase()}
            </Avatar>
          </Box>
        ) : (
          <Box
            sx={{
              position: "relative",
              display: "inline-flex",
              mx: "auto",
              width: { xs: 64, md: 128 },
              height: { xs: 64, md: 128 },
              borderRadius: "50%",
              overflow: "hidden",
              "&:hover .edit-overlay": { opacity: 1 },
              cursor: "pointer",
            }}
            onClick={handleAvatarClick}
          >
            <Avatar
              alt={user?.full_name}
              src={previewUrl || user?.photo}
              sx={{
                width: 1,
                height: 1,
                border: `solid 2px ${theme.palette.common.dark}`,
              }}
            />
            <Box
              className="edit-overlay"
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(0,0,0,0.4)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 0.2s ease-in-out",
              }}
            >
              <Button
                size="small"
                variant="contained"
                startIcon={<Iconify icon="solar:pen-bold" />}
              ></Button>
            </Box>
          </Box>
        )}

        <Box
          sx={{
            mt: 3,
            ml: { md: 3 },
            textAlign: { xs: "center", md: "unset" },
          }}
        >
          <ListItemText
            primary={user?.full_name}
            secondary={
              Array.isArray(user?.roles) && user.roles.length
                ? user.roles.map((r) => r.name).join(", ")
                : "Зочин"
            }
            primaryTypographyProps={{
              typography: "h4",
            }}
            secondaryTypographyProps={{
              mt: 0.5,
              color: "inherit",
              component: "span",
              typography: "body2",
              sx: { opacity: 0.48 },
            }}
          />

          {isDirty && (
            <LoadingButton
              variant="contained"
              color="primary"
              size="small"
              sx={{ mt: 1 }}
              onClick={handleSave}
              loading={uploading}
            >
              Хадгалах
            </LoadingButton>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

ProfileCover.propTypes = {
  user: PropTypes.object,
};
