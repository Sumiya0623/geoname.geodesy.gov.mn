'use client';

import { m } from 'framer-motion';

import Typography from '@mui/material/Typography';

import CompactLayout from 'src/layouts/compact';
import { SeverErrorIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';
import ErrorControl from 'src/components/error/error-controller';

// ----------------------------------------------------------------------

export default function Error() {
  return (
    <CompactLayout>
      <MotionContainer>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            500 Системийн алдаа
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            Алдаа гарлаа. Бид удахгүй хэвийн байдалд оруулах болно. Та түр хүлээгээд дахин хандаарай.
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <SeverErrorIllustration sx={{ height: 260, my: { xs: 5, sm: 10 } }} />
        </m.div>

        <ErrorControl />
      </MotionContainer>
    </CompactLayout>
  );
}
