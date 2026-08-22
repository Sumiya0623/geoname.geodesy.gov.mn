"use client";

import PropTypes from "prop-types";
import { useFormContext, useFieldArray } from "react-hook-form";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

// Танай RHF wrapper-ууд
import { RHFSelect, RHFTextField } from "src/components/hook-form";

// GeoServer-д таарах операторууд
const OPERATORS = [
  { value: "eq", label: "Тэнцүү" },
  { value: "neq", label: "Тэнцүү биш" },
  { value: "lt", label: "Бага" },
  { value: "lte", label: "Бага/Тэнцүү" },
  { value: "gt", label: "Их" },
  { value: "gte", label: "Их/Тэнцүү" },
  { value: "contains", label: "Агуулсан" }, // LIKE *v*
  { value: "startsWith", label: "Эхэлсэн" }, // LIKE v*
  { value: "endsWith", label: "Төгссөн" }, // LIKE *v
  { value: "in", label: "Жагсаалтад (v1,v2…)" }, // олон утга ,-аар салгаад оруулна
  { value: "between", label: "Хооронд (a..b)" }, // түр хялбар: "a..b" гэж бичих
  { value: "isnull", label: "NULL" },
  { value: "isnotnull", label: "NULL биш" },
];

function FilterRow({ index, fieldsOptions, onRemove, canRemove }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "stretch", sm: "center" }}
      spacing={1.5}
      sx={{ width: 1 }}
    >
      <RHFSelect
        name={`filters.${index}.field`}
        label="Талбар"
        variant="filled"
        sx={{ minWidth: 160 }}
      >
        {fieldsOptions.map((o) => (
          <MenuItem key={o} value={o}>
            {o}
          </MenuItem>
        ))}
      </RHFSelect>

      <RHFSelect
        name={`filters.${index}.operator`}
        label="Нөхцөл"
        variant="filled"
        sx={{ minWidth: 160 }}
      >
        {OPERATORS.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </RHFSelect>

      <RHFTextField
        name={`filters.${index}.value`}
        label="Утга"
        variant="filled"
        sx={{ flex: 1 }}
        placeholder="Ж: 123  |  abc  |  10..20  |  a,b,c"
      />

      <IconButton
        color="error"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="remove-row"
        sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

FilterRow.propTypes = {
  index: PropTypes.number.isRequired,
  fieldsOptions: PropTypes.array.isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool,
};

export default function FilterList({ fields }) {
  const { control } = useFormContext();

  // filters: [{ field, operator, value }]
  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    control,
    name: "filters",
  });

  const addRow = () =>
    append({
      field: fields?.[0] ?? "",
      operator: "eq",
      value: "",
    });

  return (
    <Box sx={{ width: 1 }}>
      <Stack spacing={1.5} divider={<Divider flexItem />}>
        {rows.length === 0 && (
          <Box sx={{ color: "text.secondary", fontSize: 13, px: 1 }}>
            Одоогоор шүүлт хоосон байна. “Мөр нэмэх”-ийг дарна уу.
          </Box>
        )}

        {rows.map((row, i) => (
          <FilterRow
            key={row.id ?? i}
            index={i}
            fieldsOptions={fields}
            canRemove={rows.length > 1}
            onRemove={() => remove(i)}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          variant="soft"
          color="primary"
          startIcon={<AddIcon />}
          onClick={addRow}
        >
          Мөр нэмэх
        </Button>
      </Stack>
    </Box>
  );
}

FilterList.propTypes = {
  fields: PropTypes.array.isRequired,
};
