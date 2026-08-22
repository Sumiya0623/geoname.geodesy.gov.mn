import * as React from "react";
import PropTypes from "prop-types";
import { useFormContext, useWatch } from "react-hook-form";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import { RHFSelect, RHFTextField } from "src/components/hook-form";
import { useGetGeoServerFields } from "src/api/constant";

export default function FilterRow({
  index,
  fieldsOptions,
  onRemove,
  canRemove,
}) {
  const { control, setValue, watch } = useFormContext();
  const fieldName = useWatch({ control, name: `filters.${index}.field` });
  const operator = useWatch({ control, name: `filters.${index}.operator` });
  const prevFieldNameRef = React.useRef();
  const { fields: rawChoices = [], fieldsLoading: isLoading } =
    useGetGeoServerFields(fieldName, {
      enabled: !!fieldName,
    });

  const hasChoices = Array.isArray(rawChoices) && rawChoices.length > 0;
  const hideValue = operator === "isnull" || operator === "isnotnull";

  React.useEffect(() => {
    if (prevFieldNameRef.current !== undefined && prevFieldNameRef.current !== fieldName) {
      setValue(`filters.${index}.value`, null);
    }
    prevFieldNameRef.current = fieldName;
  }, [fieldName, index, setValue]);

  return (
    <Stack
      spacing={1}
      direction={{ xs: "column", sm: "row" }}
      sx={{ width: 1 }}
    >
      {/* Талбар */}
      <RHFSelect
        name={`filters.${index}.field`}
        label="Талбар"
        variant="filled"
      >
        {fieldsOptions.map((f) => (
          <MenuItem key={f} value={f}>
            {f}
          </MenuItem>
        ))}
      </RHFSelect>

      {/* Нөхцөл */}
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

      {/* Утга */}
      {!hideValue &&
        (hasChoices ? (
          <RHFSelect
            name={`filters.${index}.value`}
            label="Утга"
            variant="filled"
            disabled={isLoading}
            sx={{ minWidth: 220, flex: 1 }}
            onChange={(e) => {
              const selectedId = e.target.value;
              const selected = rawChoices.find((c) => c.id === selectedId);

              // original field value
              setValue(`filters.${index}.value`, selectedId, {
                shouldValidate: true,
              });

              // bonus
              setValue(`name`, selected?.name ?? "", {
                shouldValidate: true,
              });
            }}
          >
            {isLoading && <MenuItem disabled>Уншиж байна…</MenuItem>}
            {!isLoading &&
              rawChoices.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
          </RHFSelect>
        ) : (
          <RHFTextField
            name={`filters.${index}.value`}
            label="Утга"
            variant="filled"
            sx={{ minWidth: 220, flex: 1 }}
            placeholder="ж: 123 | abc | 10..20 | A,B,C"
          />
        ))}

      <IconButton
        color="error"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="remove-filter"
        sx={{ ml: { sm: "auto" } }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

FilterRow.propTypes = {
  index: PropTypes.number.isRequired,
  fieldsOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      name: PropTypes.string.isRequired, // 'system_id', 'network_id', ...
      key: PropTypes.string, // 'GSCONSTANTS' гэх мэт
      desc: PropTypes.string, // 'GEODETICSYSTEM' гэх мэт (group code)
    })
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
  canRemove: PropTypes.bool,
};

// Operators
export const OPERATORS = [
  { value: "eq", label: "Тэнцүү" },
  { value: "neq", label: "Тэнцүү биш" },
  { value: "lt", label: "Бага" },
  { value: "lte", label: "Бага/Тэнцүү" },
  { value: "gt", label: "Их" },
  { value: "gte", label: "Их/Тэнцүү" },
  { value: "contains", label: "Агуулсан" },
  { value: "startsWith", label: "Эхэлсэн" },
  { value: "endsWith", label: "Төгссөн" },
  { value: "between", label: "Хооронд" },
  { value: "in", label: "Жагсаалтад" },
  { value: "isnull", label: "NULL" },
  { value: "isnotnull", label: "NULL биш" },
];
