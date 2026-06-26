"use client";

import PropTypes from "prop-types";
import { useMemo, useState } from "react";

import {
  Box,
  Chip,
  Stack,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
  IconButton,
  ListItemText,
  CircularProgress,
} from "@mui/material";

import axiosInstance, { endpoints } from "src/utils/axios";
import { useDebounce } from "src/hooks/use-debounce";
import { useGetLegalOrders, useGetLegalTypes } from "src/api/legal";

import Iconify from "src/components/iconify";
import { useSnackbar } from "src/components/snackbar";

import LegalNewEditForm from "src/sections/legal/legal-new-edit-form";

// ----------------------------------------------------------------------
// Бэлтгэл — орд нэмэх: ЭХЛЭЭД сангаас (одоо байгаа бүх LegalOrder) төрөл, нэр,
// дугаар, огноогоор хайж, олдвол тухайн төсөлд холбоно. Олдохгүй бол "Шинээр
// үүсгэх" форм. projectId байхгүй бол шууд үүсгэх форм (ерөнхий /dashboard/legal).
// ----------------------------------------------------------------------

const emptyCriteria = { org: "", name: "", order_number: "", order_date: "" };

export default function BeltgelAdd({ projectId, onDone, onClose }) {
  const { enqueueSnackbar } = useSnackbar();

  const [criteria, setCriteria] = useState(emptyCriteria);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);

  const { legalTypes } = useGetLegalTypes();

  const dc = useDebounce(criteria, 400);
  const searchBody = useMemo(() => {
    const has =
      dc.org ||
      dc.name?.trim() ||
      dc.order_number?.trim() ||
      dc.order_date;
    if (!has) return null;
    return {
      page_size: 20,
      ...(dc.org ? { org: dc.org } : {}),
      ...(dc.name?.trim() ? { name: dc.name.trim() } : {}),
      ...(dc.order_number?.trim()
        ? { order_number: dc.order_number.trim() }
        : {}),
      ...(dc.order_date ? { order_date: dc.order_date } : {}),
    };
  }, [dc]);

  const { legalOrders: results, legalOrdersLoading: loading } =
    useGetLegalOrders(searchBody);

  const set = (k) => (e) =>
    setCriteria((prev) => ({ ...prev, [k]: e.target.value }));

  const handleAttach = async (order) => {
    if (!order?.id) return;
    setBusyId(order.id);
    try {
      await axiosInstance.post(endpoints.legal.attachProject(order.id), {
        project: projectId,
      });
      enqueueSnackbar("Сангаас холбогдлоо");
      onDone && onDone();
      onClose && onClose();
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.detail || "Холбоход алдаа гарлаа", {
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  // projectId БАЙХГҮЙ → сангаас холбох утгагүй тул шууд шинээр үүсгэх форм.
  if (!projectId) {
    return (
      <Box
        sx={{
          mb: 2,
          borderLeft: "4px solid",
          borderColor: "primary.main",
          borderRadius: 1,
        }}
      >
        <LegalNewEditForm
          projectId=""
          selectedType={null}
          onClose={onClose}
          refetch={onDone}
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        mb: 2,
        borderLeft: "4px solid",
        borderColor: "primary.main",
        bgcolor: "background.neutral",
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Сангаас хайх
      </Typography>

      {/* Хайх талбарууд: төрөл, нэр, дугаар, огноо */}
      <Box
        gap={1.5}
        display="grid"
        gridTemplateColumns={{
          xs: "repeat(1, 1fr)",
          sm: "repeat(2, 1fr)",
          md: "repeat(4, 1fr)",
        }}
        sx={{ mb: 2 }}
      >
        <TextField
          select
          label="Төрөл"
          value={criteria.org}
          onChange={set("org")}
        >
          <MenuItem value="">Бүгд</MenuItem>
          {legalTypes.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.label || t.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Нэр"
          value={criteria.name}
          onChange={set("name")}
        />
        <TextField
          label="Дугаар"
          value={criteria.order_number}
          onChange={set("order_number")}
        />
        <TextField
          type="date"
          label="Огноо"
          InputLabelProps={{ shrink: true }}
          value={criteria.order_date}
          onChange={set("order_date")}
        />
      </Box>

      {/* Үр дүн — холбох товчтой */}
      <Box sx={{ maxHeight: 260, overflow: "auto", mb: 1 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={20} />
          </Stack>
        ) : !searchBody ? (
          <Typography variant="caption" color="text.secondary">
            Төрөл, нэр, дугаар эсвэл огноогоор хайна уу.
          </Typography>
        ) : results.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Сангаас олдсонгүй — доор шинээр үүсгэнэ үү.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0.5}>
            {results.map((o) => (
              <Stack
                key={o.id}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ py: 0.5 }}
              >
                {o.org?.label && (
                  <Chip size="small" label={o.org.label} variant="outlined" />
                )}
                <ListItemText
                  primary={o.name}
                  secondary={[o.order_number, o.order_date]
                    .filter(Boolean)
                    .join(" · ")}
                  primaryTypographyProps={{ variant: "body2", noWrap: true }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
                <IconButton
                  size="small"
                  color="primary"
                  disabled={busyId === o.id}
                  onClick={() => handleAttach(o)}
                  title="Төсөлд холбох"
                >
                  {busyId === o.id ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Iconify icon="mingcute:link-line" />
                  )}
                </IconButton>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>

      <Divider sx={{ my: 2 }}>эсвэл</Divider>

      {!creating ? (
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button
            variant="outlined"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => setCreating(true)}
          >
            Шинээр үүсгэх
          </Button>
          <Button color="inherit" onClick={onClose}>
            Хаах
          </Button>
        </Stack>
      ) : (
        <LegalNewEditForm
          projectId={projectId}
          selectedType={null}
          onClose={onClose}
          refetch={onDone}
        />
      )}
    </Box>
  );
}

BeltgelAdd.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onDone: PropTypes.func,
  onClose: PropTypes.func,
};
