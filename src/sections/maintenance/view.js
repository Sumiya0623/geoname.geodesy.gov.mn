'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MaintenanceIllustration } from 'src/assets/illustrations';
import ErrorControl from 'src/components/error/error-controller';

export default function MaintenanceView() {
  return (
    <Stack sx={{ alignItems: 'center', textAlign: 'center', py: 6 }}>
      <MaintenanceIllustration sx={{ mb: 5, height: 220 }} />

      <Typography variant="h4" sx={{ mb: 1 }}>
        Танд хандах эрх байхгүй байна
      </Typography>

      <Typography sx={{ color: 'text.secondary', mb: 4 }}>
        Зөвхөн зөвшөөрөгдсөн хэрэглэгчид хандана. Хэрэв хандах шаардлагатай бол та системийн админд хандана уу.
      </Typography>
      
      <ErrorControl />
    </Stack>
  );
}
