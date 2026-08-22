"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  TextField,
  Typography,
  MenuItem,
  Stack,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Clear as ClearIcon } from "@mui/icons-material";

const KLM = ["K", "L", "M", "N"];
const RANGE_1M = [45, 50];
const RANGE_100K = [1, 144];
const RANGE_10K = [1, 4];
const UPPER = ["А", "Б", "В", "Г"];
const LOWER = ["а", "б", "в", "г"];

const pad3 = (n) => String(n).padStart(3, "0");
const within = (n, [min, max]) => n >= min && n <= max;

function validateNomek(nomekString) {
  if (!nomekString || nomekString.trim() === "") {
    return { isValid: true, error: "" };
  }

  const parts = nomekString.trim().split("-");

  if (parts.length < 2 || parts.length > 6) {
    return { isValid: false, error: "Нэрлэвэр 2-6 хэсэгтэй байх ёстой" };
  }

  const [klmPart, m1mPart, m100kPart, upperPart, lowerPart, m10kPart] = parts;

  if (!KLM.includes(klmPart)) {
    return { isValid: false, error: `Зөв оруулна уу` };
  }

  const m1mNum = Number(m1mPart);
  if (!m1mPart || Number.isNaN(m1mNum) || !within(m1mNum, RANGE_1M)) {
    return {
      isValid: false,
      error: `1:1М хэсэг ${RANGE_1M[0]}-${RANGE_1M[1]} хооронд байх ёстой`,
    };
  }

  if (parts.length === 2) return { isValid: true, error: "" };

  if (m100kPart) {
    const m100kNum = Number(m100kPart);
    if (Number.isNaN(m100kNum) || !within(m100kNum, RANGE_100K)) {
      return {
        isValid: false,
        error: `1:100К хэсэг ${RANGE_100K[0]}-${RANGE_100K[1]} хооронд байх ёстой`,
      };
    }

    if (m100kPart.length !== 3) {
      return {
        isValid: false,
        error: "1:100К хэсэг 3 оронтой тоо байх ёстой (001–144)",
      };
    }
  }

  if (parts.length === 3) return { isValid: true, error: "" };

  if (upperPart && !UPPER.includes(upperPart)) {
    return {
      isValid: false,
      error: `1:50К хэсэг буруу (${UPPER.join(", ")})`,
    };
  }

  if (parts.length === 4) return { isValid: true, error: "" };

  if (lowerPart && !LOWER.includes(lowerPart)) {
    return {
      isValid: false,
      error: `1:25К хэсэг буруу (${LOWER.join(", ")})`,
    };
  }

  if (parts.length === 5) return { isValid: true, error: "" };

  if (m10kPart) {
    const m10kNum = Number(m10kPart);
    if (Number.isNaN(m10kNum) || !within(m10kNum, RANGE_10K)) {
      return {
        isValid: false,
        error: `1:10К хэсэг ${RANGE_10K[0]}-${RANGE_10K[1]} хооронд`,
      };
    }
  }

  return { isValid: true, error: "" };
}

function buildNomek({ klm, m1m, m100k, upper, lower, m10k }) {
  const parts = [];
  if (klm) parts.push(klm);
  if (m1m != null && within(m1m, RANGE_1M)) parts.push(m1m);
  if (m100k != null && within(m100k, RANGE_100K)) parts.push(pad3(m100k));
  if (upper) parts.push(upper);
  if (lower) parts.push(lower);
  if (m10k != null && within(m10k, RANGE_10K)) parts.push(m10k);
  return parts.join("-");
}

function parseNomek(str) {
  const parts = str.trim().split("-");
  const [klmPart, m1mPart, m100kPart, upperPart, lowerPart, m10kPart] = parts;

  return {
    klm: KLM.includes(klmPart) ? klmPart : "",
    m1m: !isNaN(Number(m1mPart)) ? Number(m1mPart) : null,
    m100k: !isNaN(Number(m100kPart)) ? Number(m100kPart) : null,
    upper: UPPER.includes(upperPart) ? upperPart : "",
    lower: LOWER.includes(lowerPart) ? lowerPart : "",
    m10k: !isNaN(Number(m10kPart)) ? Number(m10kPart) : null,
  };
}

export default function NomekProgressive({
  value = "",
  onChange,
  onValidationChange,
  disabled = false,
}) {
  const [klm, setKlm] = useState("");
  const [m1m, setM1m] = useState(null);
  const [m100k, setM100k] = useState(null);
  const [upper, setUpper] = useState("");
  const [lower, setLower] = useState("");
  const [m10k, setM10k] = useState(null);
  const [manualInput, setManualInput] = useState(value);
  const [validation, setValidation] = useState({ isValid: true, error: "" });

  const [isTyping, setIsTyping] = useState(false);

  const setK = (v) => {
    setKlm(v);
    setM1m(null);
    setM100k(null);
    setUpper("");
    setLower("");
    setM10k(null);
  };

  const progressiveNomek = useMemo(
    () => buildNomek({ klm, m1m, m100k, upper, lower, m10k }),
    [klm, m1m, m100k, upper, lower, m10k]
  );

  const handleManualInputChange = (e) => {
    const newValue = e.target.value.toUpperCase();
    setIsTyping(true);
    setManualInput(newValue);

    const validationResult = validateNomek(newValue);
    setValidation(validationResult);

    const parsed = parseNomek(newValue);
    setKlm(parsed.klm);
    setM1m(parsed.m1m);
    setM100k(parsed.m100k);
    setUpper(parsed.upper);
    setLower(parsed.lower);
    setM10k(parsed.m10k);

    onChange?.(newValue);
  };

  const handleProgressiveChange = useCallback(
    (newNomek) => {
      setManualInput(newNomek);
      onChange?.(newNomek);
    },
    [onChange]
  );

  useEffect(() => {
    if (!isTyping && progressiveNomek !== manualInput) {
      handleProgressiveChange(progressiveNomek);
    }
  }, [progressiveNomek, manualInput, isTyping, handleProgressiveChange]);

  // typing timeout
  useEffect(() => {
    const t = setTimeout(() => setIsTyping(false), 1000);
    return () => clearTimeout(t);
  }, [manualInput]);

  useEffect(() => {
    const validationResult = validateNomek(manualInput);
    setValidation(validationResult);
    onValidationChange?.(validationResult);
  }, [manualInput, onValidationChange]);

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        label="Нэрлэвэр"
        value={manualInput}
        onChange={handleManualInputChange}
        placeholder="Жишээ: М-46-125-А-а-1"
        disabled={disabled}
        error={!validation.isValid}
        helperText={validation.error || "Жишээ формат: L-48-125-А-а-1"}
        sx={{
          "& .MuiInputBase-input": {
            fontFamily: "monospace",
            fontSize: "0.9rem",
          },
        }}
      />

      <Box
        sx={{
          p: 2,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="body1"
          sx={{
            fontFamily: "monospace",
            fontSize: "1.1rem",
            p: 1,
            bgcolor: "grey.50",
            borderRadius: 0.5,
            minHeight: "2rem",
            display: "flex",
            alignItems: "center",
            mb: 2,
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          {progressiveNomek || "—"}
        </Typography>

        <Stack spacing={1.5}>
          <TextField
            select
            fullWidth
            label="KLM"
            value={klm}
            onChange={(e) => setK(e.target.value)}
            disabled={disabled}
            InputProps={{
              endAdornment: klm && (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setK("")}
                    disabled={disabled}
                    edge="end"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="">Сонго</MenuItem>
            {KLM.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>

          {klm && (
            <TextField
              select
              fullWidth
              label={`1:1 000 000 (${RANGE_1M[0]}–${RANGE_1M[1]})`}
              value={m1m ?? ""}
              onChange={(e) =>
                setM1m(e.target.value === "" ? null : Number(e.target.value))
              }
              disabled={disabled}
              InputProps={{
                endAdornment: m1m != null && (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setM1m(null)}
                      disabled={disabled}
                      edge="end"
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            >
              <MenuItem value="">Сонго</MenuItem>
              {Array.from(
                { length: RANGE_1M[1] - RANGE_1M[0] + 1 },
                (_, i) => i + RANGE_1M[0]
              ).map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
          )}

          {m1m != null && within(m1m, RANGE_1M) && (
            <TextField
              fullWidth
              type="number"
              label={`1:100 000 (${RANGE_100K[0]}–${RANGE_100K[1]})`}
              value={m100k ?? ""}
              onChange={(e) =>
                setM100k(e.target.value === "" ? null : Number(e.target.value))
              }
              inputProps={{
                min: RANGE_100K[0],
                max: RANGE_100K[1],
              }}
              disabled={disabled}
            />
          )}

          {m100k != null && within(m100k, RANGE_100K) && (
            <TextField
              select
              fullWidth
              label="1:50 000 (АБВГ)"
              value={upper}
              onChange={(e) => setUpper(e.target.value)}
              disabled={disabled}
            >
              <MenuItem value="">Сонго</MenuItem>
              {UPPER.map((l) => (
                <MenuItem key={l} value={l}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
          )}

          {upper && (
            <TextField
              select
              fullWidth
              label="1:25 000 (абвг)"
              value={lower}
              onChange={(e) => setLower(e.target.value)}
              disabled={disabled}
            >
              <MenuItem value="">Сонго</MenuItem>
              {LOWER.map((l) => (
                <MenuItem key={l} value={l}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
          )}

          {lower && (
            <TextField
              select
              fullWidth
              label="1:10 000 (1–4)"
              value={m10k ?? ""}
              onChange={(e) => setM10k(Number(e.target.value))}
              disabled={disabled}
            >
              <MenuItem value="">Сонго</MenuItem>
              {Array.from(
                { length: RANGE_10K[1] - RANGE_10K[0] + 1 },
                (_, i) => i + RANGE_10K[0]
              ).map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
