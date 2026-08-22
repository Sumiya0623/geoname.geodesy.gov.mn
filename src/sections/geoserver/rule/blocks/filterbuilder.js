import PropTypes from "prop-types";
import React, { useMemo, useEffect, useRef } from "react";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";

import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

import FilterRow from "./filterrow";
import { buildECQL } from "./ecql";

export default function FilterBuilder({ fields, disabled }) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext();

  const {
    fields: rows,
    append,
    remove,
    replace,
  } = useFieldArray({ control, name: "filters" });

  const logic = useWatch({ control, name: "filtersLogic" }) || "AND";
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  const filters = useWatch({ control, name: "filters" }) || [];
  const ecql = useMemo(() => buildECQL(filters, logic), [filters, logic]);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    const initial = getValues("filters");
    if (Array.isArray(initial) && initial.length > 0 && rows.length === 0) {
      replace(initial);
    }
    didInitRef.current = true;
  }, [getValues, replace, rows.length]);

  const didAddInitialRowRef = useRef(false);
  useEffect(() => {
    if (didAddInitialRowRef.current) return;
    
    const currentFilters = getValues("filters");
    const hasFields = Array.isArray(fields) && fields.length > 0;
    const hasRows = rows.length > 0;
    const hasFormFilters = Array.isArray(currentFilters) && currentFilters.length > 0;
    
    if (hasFields && !hasRows && !hasFormFilters) {
      const firstFieldName = typeof fields[0] === "string" ? fields[0] : fields[0]?.name || "";
      
      if (firstFieldName) {
        append({
          field: firstFieldName,
          operator: "eq",
          value: "",
        });
        didAddInitialRowRef.current = true;
      }
    }
  }, [fields, getValues, append, rows.length]);

  // 4) ECQL-ийг form state-д автоматаар бичнэ
  useEffect(() => {
    setValue("cql_filter", ecql ?? "", { shouldDirty: true });
  }, [ecql, setValue]);

  // 4) Нэг мөр нэмэх
  const firstFieldName =
    (Array.isArray(fields) && fields.length > 0
      ? // fields нь [{name:'state_id', ...}] эсвэл ['state_id', ...] хоёрын аль нь ч байж болно:
        typeof fields[0] === "string"
        ? fields[0]
        : fields[0]?.name
      : "") || "";

  const addRow = () =>
    append({
      field: firstFieldName,
      operator: "eq",
      value: "",
    });

  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Ангилал (cql_filter)
        </Typography>
        <Button
          variant="primary"
          onClick={addRow}
          disabled={disabled || (Array.isArray(fields) && fields.length === 0)}
        >
          Нэмэх
        </Button>
      </Stack>

      {errors.filters && (
        <Alert severity="error" sx={{ fontSize: 13 }}>
          Шүүлтийн талбаруудыг бүрэн бөглөнө үү
        </Alert>
      )}

      <Stack spacing={1}>
        {rows.length === 0 ? (
          <Box sx={{ color: "text.secondary", fontSize: 13 }}>
            Шүүлт нэмэгдээгүй байна.
          </Box>
        ) : (
          rows.map((row, i) => (
            <FilterRow
              key={row.id ?? i}
              index={i}
              fieldsOptions={fields}
              canRemove={rows.length > 1}
              onRemove={() => remove(i)}
              setValue={setValue}
            />
          ))
        )}
      </Stack>
    </Stack>
  );
}

FilterBuilder.propTypes = {
  fields: PropTypes.array.isRequired,
  disabled: PropTypes.bool,
};
