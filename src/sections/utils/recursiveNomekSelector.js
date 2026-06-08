import React, { useEffect, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import { Icon } from "@iconify/react";
import { useFormContext } from "react-hook-form";
import {
  useGetNomeks,
} from "src/api/constant";
import axiosInstance, { endpoints } from "src/utils/axios";

export default function RecursiveNomekSelector({
  name = "nomek",
  label = "Номек",
  childLabel = "Номек",
  initialId = null,
  onChange = null,
  value = null,
}) {
  const formContext = useFormContext();
  const { setValue, watch, formState = {} } = formContext || {};
  const { errors = {}, isSubmitted = false } = formState;

  const [path, setPath] = useState([]);
  const [selectKey, setSelectKey] = useState(0);
  const prefilledIdRef = useRef(null);

  const { nomeks: rootConstants = [], nomeksLoading: rootLoading } =
    useGetNomeks({ pagination: false });
  const lastSelected = path[path.length - 1] || null;
  const { nomeks: childConstants = [], nomeksLoading: childLoading } =
    useGetNomeks({
      parent: lastSelected?.id || "",
      pagination: false,
    });

  const isLeaf = !!lastSelected && !childLoading && childConstants.length === 0;
  const lastEmittedValueRef = useRef(null);
  useEffect(() => {
    const selectedId = lastSelected?.id ?? null;

    if (lastEmittedValueRef.current === selectedId) {
      return;
    }

    if (isLeaf) {
      if (setValue) {
        setValue(name, selectedId, {
          shouldValidate: isSubmitted,
          shouldDirty: true,
        });
      } else if (onChange) {
        onChange(selectedId);
      }
      lastEmittedValueRef.current = selectedId;
    } else {
      if (setValue) {
        setValue(name, null, { shouldValidate: false, shouldDirty: false });
      } else if (onChange) {
        onChange(null);
      }
      lastEmittedValueRef.current = null;
    }
  }, [isLeaf, lastSelected?.id, name, setValue, isSubmitted, onChange]);

  useEffect(() => {
    let cancelled = false;

    async function buildPath() {
      if (!initialId || prefilledIdRef.current === initialId) return;

      const chain = [];
      let cursor = initialId;
      const safetyLimit = 20;
      let guard = 0;

      while (cursor && guard < safetyLimit) {
        try {
          const res = await axiosInstance.get(
            endpoints.constant.details(cursor)
          );
          const data = res.data;
          chain.unshift(data);
          cursor = data.parent || null;
        } catch (e) {
          console.error("Error building path:", e);
          break;
        }
        guard += 1;
      }

      if (!cancelled && chain.length) {
        setPath(chain);
        const finalId = chain[chain.length - 1]?.id ?? null;
        lastEmittedValueRef.current = finalId;
        if (setValue) {
          setValue(name, finalId, {
            shouldValidate: false,
            shouldDirty: false,
          });
        } else if (onChange) {
          onChange(finalId);
        }
        prefilledIdRef.current = initialId;
      }
    }

    buildPath();
    return () => {
      cancelled = true;
    };
  }, [initialId, name, setValue, onChange]);

  const truncateExclusive = useCallback((index) => {
    setPath((prev) => prev.slice(0, index));
  }, []);

  const truncateInclusive = useCallback((index) => {
    setPath((prev) => prev.slice(0, index + 1));
  }, []);

  const handleSelect = useCallback(
    (e) => {
      const raw = e.target.value;
      if (!raw) return;

      const parsed = Number(raw);
      const valueId =
        !Number.isNaN(parsed) && String(parsed) === raw ? parsed : raw;
      const options = path.length === 0 ? rootConstants : childConstants;
      const node = options.find((o) => String(o.id) === String(valueId));

      if (!node) return;

      setPath((prev) => [...prev, node]);
    },
    [path.length, rootConstants, childConstants]
  );

  const resetAll = useCallback(() => {
    setPath([]);
    lastEmittedValueRef.current = null;
    if (setValue) {
      setValue(name, null, { shouldValidate: isSubmitted, shouldDirty: true });
    } else if (onChange) {
      onChange(null);
    }
    setSelectKey((k) => k + 1);
  }, [name, setValue, isSubmitted, onChange]);

  const optionsToShow = path.length === 0 ? rootConstants : childConstants;
  const loading = path.length === 0 ? rootLoading : childLoading;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mb: 1 }}
      >
        {path && path.length > 0 && (
          <Box sx={{ width: "100%", display: "flex", alignItems: "center" }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {label || ""}:
            </Typography>
          </Box>
        )}
        {path.map((node, idx) => (
          <Chip
            key={`${node.id}-${idx}`}
            label={node?.nomek}
            onClick={() => truncateInclusive(idx)}
            onDelete={() => truncateExclusive(idx)}
            deleteIcon={<Icon icon="mdi:close" />}
            color={idx === path.length - 1 ? "primary" : "default"}
            variant={idx === path.length - 1 ? "filled" : "outlined"}
            sx={{ cursor: "pointer" }}
          />
        ))}
        {path.length > 0 && (
          <IconButton size="small" onClick={resetAll} title="Эхнээс нь сонгох">
            <Icon icon="mdi:backup-restore" />
          </IconButton>
        )}
      </Stack>

      <Box sx={{ position: "relative" }}>
        {!isLeaf && (
          <FormControl fullWidth size="small" error={!!errors?.[name]}>
            <InputLabel shrink>
              {path.length === 0 ? childLabel : "Дараагийн түвшин"}
            </InputLabel>
            <Select
              key={selectKey}
              notched
              displayEmpty
              value=""
              label={path.length === 0 ? childLabel : "Дараагийн түвшин"}
              onChange={(e) => {
                handleSelect(e);
                setSelectKey((k) => k + 1);
              }}
              renderValue={(val) => {
                if (val === "") {
                  return (
                    <Typography variant="body2" sx={{ color: "text.disabled" }}>
                      {loading
                        ? "Ачааллаж байна..."
                        : optionsToShow.length === 0
                          ? "Дараагийн түвшин байхгүй"
                          : path.length === 0
                            ? label
                            : "Дараагийн түвшин сонгох"}
                    </Typography>
                  );
                }
                return val;
              }}
              disabled={loading || optionsToShow.length === 0}
            >
              {optionsToShow.map((opt) => (
                <MenuItem key={opt.id} value={String(opt.id)}>
                  {opt?.nomek}
                  {opt.code && ` (${opt.code})`}
                </MenuItem>
              ))}
            </Select>
            {isSubmitted && errors?.[name] && (
              <FormHelperText>{errors[name]?.message}</FormHelperText>
            )}
          </FormControl>
        )}

        {loading && (
          <CircularProgress
            size={20}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 1,
            }}
          />
        )}
      </Box>
    </Box>
  );
}

RecursiveNomekSelector.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  childLabel: PropTypes.string,
  initialId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
