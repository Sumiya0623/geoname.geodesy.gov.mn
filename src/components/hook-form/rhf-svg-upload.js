import PropTypes from "prop-types";
import { Controller, useFormContext } from "react-hook-form";
import FormHelperText from "@mui/material/FormHelperText";

import { Upload } from "../upload";

export default function RHFSvgUpload({ name, multiple = false, helperText, showOnlyInput = false, ...other }) {
  const { control, setValue } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const commonProps = {
          error: !!error,
          helperText: (!!error || helperText) && (
            <FormHelperText error={!!error} sx={{ px: 2 }}>
              {error?.message || helperText}
            </FormHelperText>
          ),
          accept: other.accept || { "image/svg+xml": [".svg"] },
          thumbnail: other.thumbnail ?? false,
          ...other,
        };

        return multiple ? (
          <Upload
            multiple
            showOnlyInput={showOnlyInput}
            files={field.value}
            onDrop={(acceptedFiles) => {
              setValue(name, acceptedFiles, { shouldValidate: true });
            }}
            onRemoveFile={(index) => {
              const updated = [...(field.value || [])];
              updated.splice(index, 1);
              setValue(name, updated, { shouldValidate: true });
            }}
            {...commonProps}
          />
        ) : (
          <Upload
            file={field.value}
            showOnlyInput={showOnlyInput}
            onDrop={(acceptedFiles) => {
              const file = acceptedFiles[0];
              const preview = URL.createObjectURL(file);
              setValue(name, Object.assign(file, { preview }), { shouldValidate: true });
            }}
            onDelete={() => setValue(name, null, { shouldValidate: true })}
            {...commonProps}
          />
        );
      }}
    />
  );
}

RHFSvgUpload.propTypes = {
  name: PropTypes.string.isRequired,
  multiple: PropTypes.bool,
  helperText: PropTypes.node,
};
