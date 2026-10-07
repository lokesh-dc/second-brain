import DesktopSidebar from "@/components/desktop-sidebar";
import TabDock from "@/components/tab-dock";
import { CaptureFab, CaptureProvider } from "@/components/capture";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <CaptureProvider>
      <div className="min-h-dvh bg-paper">
        <DesktopSidebar />
        <div className="md:ml-[var(--sidebar-w)]">{children}</div>
        <TabDock />
        <CaptureFab />
      </div>
    </CaptureProvider>
  );
}
