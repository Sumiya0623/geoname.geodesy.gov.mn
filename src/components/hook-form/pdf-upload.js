import { Box, IconButton, Paper, Typography } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";
import { Icon } from "@iconify/react";
import { PDFDocument } from "pdf-lib";
// size="small" — MUI‑ийн жижиг талбартай (40px) ижил өндөртэй нягт хувилбар.
// Бусад тохиолдолд хэвийн (56px) хэмжээ — өмнөх дүр төрх хэвээр.
export default function UploadPDFField({
  name,
  label = "Файл",
  onPageCount,
  size = "medium",
}) {
  const { control, setValue } = useFormContext();
  const small = size === "small";

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
                  px: small ? 1 : 1.5,
                  py: small ? 0.5 : 1.5,
                  display: "flex",
                  alignItems: "center",
                  minHeight: small ? 40 : 56,
                }}
              >
                <Typography
                  variant={small ? "caption" : "body2"}
                  noWrap
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: small ? 0.5 : 1,
                    flexGrow: 1,
                    fontWeight: 500,
                  }}
                >
                  {label}
                  <Icon
                    icon="mdi:file-pdf-box"
                    width={small ? 18 : 20}
                    height={small ? 18 : 20}
                    color="red"
                  />
                </Typography>

                <IconButton
                  size={small ? "small" : "medium"}
                  onClick={() =>
                    setValue(name, null, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  sx={{
                    position: "absolute",
                    top: small ? 2 : 4,
                    right: small ? 2 : 4,
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
                  px: small ? 1 : 1.5,
                  py: small ? 0.25 : 0.75,
                  minHeight: small ? 40 : 56,
                  cursor: "pointer",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: small ? 6 : 8,
                    width: "100%",
                    cursor: "pointer",
                  }}
                >
                  <Icon
                    icon="mdi:file-pdf-box"
                    width={small ? 18 : 22}
                    height={small ? 18 : 22}
                    color="red"
                  />
                  <Typography
                    variant={small ? "caption" : "body2"}
                    noWrap
                    fontWeight={500}
                  >
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
