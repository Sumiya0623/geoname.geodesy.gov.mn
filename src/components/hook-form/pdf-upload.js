import { Box, IconButton, Paper, Typography } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { Icon } from "@iconify/react";
import { PDFDocument } from "pdf-lib";
export default function UploadPDFField({ name, label = "Файл", onPageCount }) {
  const { control, setValue } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { value } }) => {
        const hasFile =
          value && (typeof value === "string" || value instanceof File);

        const handleFileChange = async (file) => {
          setValue(name, file, {
            shouldValidate: true,
            shouldDirty: true,
          });

          if (file?.type === "application/pdf") {
            const buffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(buffer);
            const pages = pdfDoc.getPageCount();

            // 🎯 pages утгыг form-д дамжуулах
            if (onPageCount) onPageCount(pages);
          }
        };

        return (
          <Box>
            {hasFile ? (
              <Paper
                variant="outlined"
                sx={{
                  position: "relative",
                  p: 1.5,
                  display: "flex",
                  alignItems: "center",
                  minHeight: 56,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    flexGrow: 1,
                    fontWeight: 500,
                  }}
                >
                  {label}
                  <Icon
                    icon="mdi:file-pdf-box"
                    width={20}
                    height={20}
                    color="red"
                  />
                </Typography>

                <IconButton
                  size="small"
                  onClick={() =>
                    setValue(name, null, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  sx={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    backgroundColor: "white",
                    boxShadow: 1,
                    "&:hover": { backgroundColor: "#fefefe" },
                  }}
                >
                  <Icon icon="mdi:close-circle" color="#d32f2f" />
                </IconButton>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                  py: 0.75,
                  minHeight: 56,
                  cursor: "pointer",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    cursor: "pointer",
                  }}
                >
                  <Icon
                    icon="mdi:file-pdf-box"
                    width={22}
                    height={22}
                    color="red"
                  />
                  <Typography variant="body2" fontWeight={500}>
                    {label} сонгох
                  </Typography>
                  <input
                    hidden
                    accept=".pdf"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file);
                    }}
                  />
                </label>
              </Paper>
            )}
          </Box>
        );
      }}
    />
  );
}
