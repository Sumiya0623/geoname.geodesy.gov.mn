import PropTypes from "prop-types";
import React, { useState, useEffect } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Dialog,
  Typography,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import {
  CheckOutlined,
  AddShoppingCart,
  OpenInNewRounded as OpenInNewIcon,
} from "@mui/icons-material";
import { enqueueSnackbar } from "notistack";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useGetRequestStatuses } from "src/api/request";

import RequestChangeForm from "src/sections/request/request-change-form";

// ----------------------------------------------------------------------
// Газар зүйн нэрийн дэлгэрэнгүй карт — ангиллын зам (level1/2/3), дугаар,
// нэр, дэлгэрэнгүй линк, батлагдсан төлөв, Сагсанд нэмэх / Өөрчлөх хүсэлт.
// NameSidebar болон FeatureSelector (олон нэрийн пейжер) хоёулаа ашиглана.
// ----------------------------------------------------------------------

export default function NameDetailCard({ name, onSelect, onAfterAction }) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [typePath, setTypePath] = useState([]);
  const [approved, setApproved] = useState(undefined);
  const [createdDate, setCreatedDate] = useState(null);
  const { statuses } = useGetRequestStatuses();
  const changeStatus =
    statuses.find((s) => (s?.name || "").includes("Өөрчл")) || null;

  useEffect(() => {
    let active = true;
    const id = name?.id;
    if (!id) {
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
  }, [name?.id]);

  // Худалдан авалтын дэд систем устсан тул "Сагсанд нэмэх" одоохондоо идэвхгүй.
  function addToCart() {
    enqueueSnackbar("Сагсны үйлдэл одоохондоо идэвхгүй байна", {
      variant: "info",
    });
  }

  if (!name) return null;

  return (
    <>
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

        {name?.id && (
          <Button
            component="a"
            href={`/dashboard/geoname/${name.id}`}
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

        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {name?.id && (
            <Button
              variant="contained"
              fullWidth
              size="small"
              color="primary"
              startIcon={<AddShoppingCart fontSize="small" />}
              onClick={() => {
                onSelect?.(name);
                addToCart();
              }}
              sx={{ textTransform: "none", fontWeight: 600, fontSize: 12 }}
            >
              Сагсанд нэмэх
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
      </Box>

      <Dialog
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        fullWidth
        maxWidth="md"
        scroll="body"
      >
        <DialogTitle
          sx={{ bgcolor: "primary.main", color: "common.white", py: 1.5 }}
        >
          Нэр өөрчлөх хүсэлт
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <RequestChangeForm
            onClose={() => setRequestModalOpen(false)}
            selectedStatus={changeStatus}
            geonameId={name?.id || null}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

NameDetailCard.propTypes = {
  name: PropTypes.object,
  onSelect: PropTypes.func,
  onAfterAction: PropTypes.func,
};
