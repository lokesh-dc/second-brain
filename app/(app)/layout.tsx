import TabDock from "@/components/tab-dock";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-paper">
      {children}
      <TabDock />
    </div>
  );
}
