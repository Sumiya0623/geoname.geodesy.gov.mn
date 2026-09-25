'use client';

import { m } from 'framer-motion';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import CompactLayout from 'src/layouts/compact';
import Logo from 'src/components/logo';

import { varBounce, MotionContainer } from 'src/components/animate';

import { useAuthContext } from 'src/auth/hooks';
import { coreApi } from 'src/utils/axios';

// ----------------------------------------------------------------------

const FIELD_LABELS = {
  email: 'Имэйл хаяг',
  email_unconfirmed: 'Имэйл хаяг баталгаажаагүй',
  phone: 'Утасны дугаар',
  orgReg: 'Ажил эрхлэлтийн мэдээлэл',
};

const fieldLabel = (field, isCitizen) => {
  if (field === 'photo') {
    return isCitizen ? 'Профайл зураг' : 'Байгууллагын лого';
  }
  return FIELD_LABELS[field] || field;
};

export default function IncompleteProfileView() {
  const { user, logout } = useAuthContext();
  const missing = Array.isArray(user?.missing_fields) ? user.missing_fields : [];

  return (
    <CompactLayout>
      <MotionContainer>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Мэдээлэл бүрэн бус байна
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            Таны бүртгэлийн мэдээлэл бүрэн бус тул дэд системийг ашиглах боломжгүй байна. Дараах
            мэдээллийг үндсэн системд (geodesy.gov.mn) шинэчлэн дахин нэвтэрнэ үү.
          </Typography>
        </m.div>

        {missing.length > 0 && (
          <m.div variants={varBounce().in}>
            <Stack spacing={0.5} sx={{ mt: 3, textAlign: 'left', display: 'inline-block' }}>
              {missing.map((f) => (
                <Typography key={f} variant="subtitle2" sx={{ color: 'error.main' }}>
                  • {fieldLabel(f, user?.is_citizen !== false)}
                </Typography>
              ))}
            </Stack>
          </m.div>
        )}

        <m.div variants={varBounce().in}>
          <Logo disabledLink single sx={{ my: { xs: 5, sm: 10 }, '& img': { height: { xs: 120, sm: 160 } } }} />
        </m.div>

        <m.div variants={varBounce().in}>
          <Button
            size="large"
            variant="outlined"
            color="inherit"
            sx={{ mr: 1.5 }}
            onClick={async () => {
              // main дээр бөглөсөн мэдээлэл шинэ токенд орж ирэхийн тулд refresh хийнэ
              try {
                await coreApi.post('/core/user/refresh/');
              } finally {
                window.location.reload();
              }
            }}
          >
            Дахин шалгах
          </Button>
          <Button
            size="large"
            variant="contained"
            color="primary"
            onClick={async () => {
              try {
                await logout();
              } finally {
                window.location.href = 'https://geodesy.gov.mn';
              }
            }}
          >
            Үндсэн систем рүү шилжих
          </Button>
        </m.div>
      </MotionContainer>
    </CompactLayout>
  );
}
