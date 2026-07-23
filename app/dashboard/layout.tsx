import Sidebar from "@/components/Sidebar";
import SupportWidget from "@/components/SupportWidget";
import PrefsInit from "@/components/PrefsInit";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <PrefsInit />
      <Sidebar />
      <div className="main">{children}</div>
      <SupportWidget />
    </div>
  );
}
