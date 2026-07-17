import Sidebar from "@/components/Sidebar";
import SupportWidget from "@/components/SupportWidget";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">{children}</div>
      <SupportWidget />
    </div>
  );
}
