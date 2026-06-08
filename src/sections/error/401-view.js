"use client";

import { m } from "framer-motion";
import Typography from "@mui/material/Typography";
import CompactLayout from "src/layouts/compact";
import { varBounce, MotionContainer } from "src/components/animate";
import MotivationIllustration from "src/assets/illustrations/motivation-illustration";
import ErrorControl from "src/components/error/error-controller";

// ----------------------------------------------------------------------

export default function View401() {
  return (
    <CompactLayout>
      <MotionContainer>
        <m.div variants={varBounce().in}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Та нэвтэрнэ үү.
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <Typography sx={{ color: "text.secondary" }}>
            Систем ашиглахын тулд та порталаар нэвтрэх шаардлагатай.
            <br />
          </Typography>
        </m.div>

        <m.div variants={varBounce().in}>
          <MotivationIllustration sx={{ height: 260, my: { xs: 5, sm: 10 } }} />
        </m.div>
        <ErrorControl />
      </MotionContainer>
    </CompactLayout>
  );
}
