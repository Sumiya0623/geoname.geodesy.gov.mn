import { Box, IconButton, Paper, Typography } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { Icon } from '@iconify/react';
import { PDFDocument } from 'pdf-lib';

export default function ReportPDFField({ name, label = 'Файл', onPageCount, onSplitFiles }) {
  const { control, setValue, getValues } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = field.value;
        const hasFile = value && (value instanceof File || value?.file);

        const handleFileChange = async (file) => {
          if (!file?.type?.includes('pdf')) return;

          const buffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(buffer);
          const totalPages = pdfDoc.getPageCount();

          if (onPageCount) onPageCount(totalPages);

          const chunks = [];
          const existingFiles = getValues('files') || [];
          const baseIndex = existingFiles.length;

          for (let i = 0; i < totalPages; i += 250) {
            const newPdf = await PDFDocument.create();
            const pageIndices = Array.from(
              { length: Math.min(250, totalPages - i) },
              (_, j) => i + j
            );
            const pages = await newPdf.copyPages(pdfDoc, pageIndices);
            pages.forEach((p) => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const partFile = new File([blob], file.name, { type: 'application/pdf' });

            chunks.push({
              name: `Боть ${baseIndex + chunks.length + 1}`,
              file: partFile,
              pages: pageIndices.length,
            });
          }

          if (onSplitFiles) onSplitFiles(chunks);
        };

        return (
          <Box>
            {hasFile ? (
              <Paper
                variant="outlined"
                sx={{
                  position: 'relative',
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 56,
                }}
              >
                <Typography variant="body2" sx={{ display: 'flex', gap: 1, fontWeight: 500 }}>
                  {getValues(name.replace('attach', 'name')) || 'Боть'}{' '}
                  {/* 👈 нэрийг form-оос авна */}
                  <Icon icon="mdi:file-pdf-box" width={20} height={20} color="red" />
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
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    backgroundColor: 'white',
                    boxShadow: 1,
                    '&:hover': { backgroundColor: '#fefefe' },
                  }}
                >
                  <Icon icon="mdi:close-circle" color="#d32f2f" />
                </IconButton>
              </Paper>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.75,
                  minHeight: 56,
                  cursor: 'pointer',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <Icon icon="mdi:file-pdf-box" width={22} height={22} color="red" />
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
