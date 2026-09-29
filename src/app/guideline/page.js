import SupportView from "src/sections/support/support-view";
import SupportShell from "src/sections/support/support-shell";

// ----------------------------------------------------------------------

export const metadata = {
  title: "Заавар",
};

export default function GuidelinePage() {
  return (
    <SupportShell>
      <SupportView initialTab="guide" />
    </SupportShell>
  );
}
