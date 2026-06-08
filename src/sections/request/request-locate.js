import { useState, useEffect } from "react";
import { useWatch, useFormContext } from "react-hook-form";

import {
  Box,
  Stack,
  Alert,
  Chip,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Icon } from "@iconify/react";

import axiosInstance, { endpoints } from "src/utils/axios";

// ----------------------------------------------------------------------
// Солбицол (lat/lon) оруулахад түүгээр AdminUnit (Баг/Хороо) олж,
// аймаг → сум → баг шатлалыг доор нь харуулна. Олдохгүй бол анхааруулна.
// ----------------------------------------------------------------------

export default function RequestLocate() {
  const { control } = useFormContext();
  const lat = useWatch({ control, name: "lat" });
  const lon = useWatch({ control, name: "lon" });

  const [state, setState] = useState({
    loading: false,
    chain: null,
    notFound: false,
  });

  useEffect(() => {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      setState({ loading: false, chain: null, notFound: false });
      return undefined;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      try {
        const url = endpoints.request.locate(`lat=${latNum}&lon=${lonNum}`);
        const res = await axiosInstance.get(url);
        if (!active) return;
        if (res.data?.found) {
          setState({
            loading: false,
            chain: res.data.chain || [],
            notFound: false,
          });
        } else {
          setState({ loading: false, chain: null, notFound: true });
        }
      } catch (e) {
        if (active) setState({ loading: false, chain: null, notFound: true });
      }
    }, 500);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [lat, lon]);

  if (state.loading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">
          Солбицлыг шалгаж байна...
        </Typography>
      </Stack>
    );
  }

  if (state.notFound) {
    return (
      <Alert
        severity="warning"
        icon={<Icon icon="solar:danger-triangle-bold" />}
        sx={{ mt: 0.5, py: 0.25 }}
      >
        Энэ солбицолд харьяалагдах нэгж олдсонгүй. Солбицлоо шалгана уу.
      </Alert>
    );
  }

  if (state.chain?.length) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={0.5}
        sx={{ mt: 0.5 }}
      >
        <Icon icon="solar:map-point-bold" style={{ color: "#22c55e" }} />
        {state.chain.map((c, i) => (
          <Chip
            key={c.id}
            size="small"
            variant="soft"
            color={i === state.chain.length - 1 ? "success" : "default"}
            label={`${c.unit}${c.level ? ` ` : ""}`}
          />
        ))}
      </Stack>
    );
  }

  return <Box sx={{ display: "none" }} />;
}
