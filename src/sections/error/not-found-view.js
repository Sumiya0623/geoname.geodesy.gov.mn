'use client';

import { m } from 'framer-motion';

import Typography from '@mui/material/Typography';

import CompactLayout from 'src/layouts/compact';
import { PageNotFoundIllustration } from 'src/assets/illustrations';

import { varBounce, MotionContainer } from 'src/components/animate';
import ErrorControl from 'src/components/error/error-controller';

// ----------------------------------------------------------------------

export default function NotFoundView() {
  return (
    <CompactLayout>
      <MotionContainer>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Уучлаарай хуудас олдсонгүй!
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: 'text.secondary' }}>
            Уучлаарай хуудас олдсонгүй! Таны хайж буй хуудсыг олж чадахгүй байна. Магадгүй та URL буруу бичсэн байж магадгүй. Бичгийн алдаагаа шалгаарай.
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <PageNotFoundIllustration
            sx={{
              height: 260,
              my: { xs: 5, sm: 10 },
            }}
          />
        </m.div>
        
        <ErrorControl />
      </MotionContainer>
    </CompactLayout>
  );
}
