import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
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
} from '@mui/material';
import { Icon } from '@iconify/react';
import { useFormContext } from 'react-hook-form';
import { useGetConstantsFordropdown, useGetConstantsForParent } from 'src/api/constant';
import axiosInstance, { endpoints } from 'src/utils/axios';

export default function RecursiveConstantSelector({ name = 'task', label, childLabel='',rootKey = 'GEODETIC_NETWORK', initialId = null }) {
  const { setValue, watch, formState: { errors, isSubmitted } } = useFormContext();

  const [path, setPath] = useState([]);

  const { constants: rootConstants = [], constantsLoading: rootLoading } = useGetConstantsFordropdown(rootKey);

  const lastSelected = path[path.length - 1] || null;

  const {
    constants: childConstants = [],
    constantsLoading: childLoading,
  } = useGetConstantsForParent(lastSelected?.id || null);

  const isLeaf = !!lastSelected && !childLoading && childConstants.length === 0;

  useEffect(() => {
    if (isLeaf) {
      setValue(name, lastSelected?.id ?? null, { shouldValidate: isSubmitted, shouldDirty: true });
    } else {
      setValue(name, null, { shouldValidate: isSubmitted && false, shouldDirty: false });
    }
  }, [isLeaf, lastSelected, name, setValue, isSubmitted]);

  const prefilledIdRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    async function buildPath() {
      if (!initialId) return;
      if (prefilledIdRef.current === initialId) return;
      const chain = [];
      let cursor = initialId;
      const safetyLimit = 20;
      let guard = 0;
      while (cursor && guard < safetyLimit) {
        try {
          const res = await axiosInstance.get(endpoints.constant.details(cursor));
          const data = res.data;
          chain.unshift(data);
          cursor = data.parent || null;
        } catch (e) {
          break;
        }
        guard += 1;
      }
      if (!cancelled && chain.length) {
        setPath(chain);
        setValue(name, chain[chain.length - 1]?.id ?? null, { shouldValidate: false, shouldDirty: false });
        prefilledIdRef.current = initialId;
      }
    }
    buildPath();
    return () => { cancelled = true; };
  }, [initialId, name, setValue]);

  const truncateExclusive = (index) => {
    setPath((prev) => prev.slice(0, index));
  };
  const truncateInclusive = (index) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  const handleSelect = useCallback(
    (e) => {
      const raw = e.target.value;
      if (!raw) return;
      const parsed = Number(raw);
      const valueId = !Number.isNaN(parsed) && String(parsed) === raw ? parsed : raw;
      const options = path.length === 0 ? rootConstants : childConstants;
      const node = options.find((o) => String(o.id) === String(valueId));
      if (!node) return;
  setPath((prev) => [...prev, node]);
    },
    [path.length, rootConstants, childConstants]
  );

  const resetAll = () => {
    setPath([]);
    setValue(name, null, { shouldValidate: isSubmitted, shouldDirty: true });
    setSelectKey((k) => k + 1);
  };

  const optionsToShow = path.length === 0 ? rootConstants : childConstants;
  const loading = path.length === 0 ? rootLoading : childLoading;
  const [selectKey, setSelectKey] = useState(0); // force reset

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
        {path.map((node, idx) => (
          <Chip
            key={node.id}
            label={node.name}
            onClick={() => truncateInclusive(idx)}
            onDelete={() => truncateExclusive(idx)}
            deleteIcon={<Icon icon="mdi:close" />}
            color={idx === path.length - 1 ? 'primary' : 'default'}
            variant={idx === path.length - 1 ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
        ))}
        {path.length > 0 && (
          <IconButton onClick={resetAll} title="Эхнээс нь сонгох">
            <Icon icon="mdi:backup-restore" />
          </IconButton>
        )}
      </Stack>

      <Box sx={{ position: 'relative' }}>
        {!isLeaf && (
          <FormControl fullWidth error={!!errors?.[name]}>
            <InputLabel shrink>{path.length === 0 ? childLabel || 'Ажил' : 'Дараагийн түвшин'}</InputLabel>
            <Select
              key={selectKey}
              notched
              displayEmpty
              value=""
              label={path.length === 0 ? childLabel || 'Ажил' : 'Дараагийн түвшин'}
              onChange={(e) => {
                handleSelect(e);
                setSelectKey((k) => k + 1);
              }}
              renderValue={(val) => {
                if (val === '') {
                  return (
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                      {loading
                        ? 'Ачааллаж байна...'
                        : optionsToShow.length === 0
                        ? 'Дараагийн түвшин байхгүй'
                        : path.length === 0
                        ? label || 'Ажил сонгох'
                        : 'Дараагийн түвшин сонгох'}
                    </Typography>
                  );
                }
                return val;
              }}
              disabled={loading || optionsToShow.length === 0}
            >
              {optionsToShow.map((opt) => (
                <MenuItem key={opt.id} value={String(opt.id)}>
                  {opt.name}
                  {/* {opt.name} | {opt?.code || ''} */}
                </MenuItem>
              ))}
            </Select>
            {isSubmitted && errors?.[name] && <FormHelperText>{errors[name]?.message}</FormHelperText>}
          </FormControl>
        )}
        {loading && (
          <CircularProgress size={20} sx={{ position: 'absolute', top: 8, right: 8 }} />
        )}
      </Box>
    </Box>
  );
}

RecursiveConstantSelector.propTypes = {
  name: PropTypes.string,
  rootKey: PropTypes.string,
  initialId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
