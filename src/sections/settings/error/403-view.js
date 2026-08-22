'use client';

import { m } from 'framer-motion';

import Typography from '@mui/material/Typography';

import CompactLayout from 'src/layouts/compact';
import { ForbiddenIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';
import ErrorControl from 'src/components/error/error-controller';

// ----------------------------------------------------------------------

export default function View403() {
  return (
    <CompactLayout>
      <MotionContainer>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Уучлаарай, Танд хандах эрх байхгүй байна
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            Системийн админд хандана уу.
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <ForbiddenIllustration sx={{ height: 260, my: { xs: 5, sm: 10 } }} />
        </m.div>
        
        <ErrorControl />
      </MotionContainer>
    </CompactLayout>
  );
}
