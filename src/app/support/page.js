import SupportView from "src/sections/support/support-view";
import SupportShell from "src/sections/support/support-shell";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Тусламжийн хүсэлт",
};

export default function SupportPage() {
  return (
    <SupportShell>
      <SupportView initialTab="ticket" />
    </SupportShell>
  );
}
