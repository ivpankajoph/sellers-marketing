// src/components/layout/DashboardLayout.tsx
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import SidebarNav from "../SidebarNav";
import Header from "../Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [, navigate] = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <SidebarProvider defaultOpen>
      <Sidebar className="bg-[#9fadcc] text-black border-r border-sidebar-border">
        <SidebarNav onLogout={handleLogout} />
      </Sidebar>

      <SidebarInset className="h-screen overflow-hidden">
        <Header onLogout={handleLogout} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
