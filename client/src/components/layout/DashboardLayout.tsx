import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  GitBranch,
  Users,
  Settings,
  LogOut,
  Menu,
  Bell,
  Search,
  FileText,
  LayoutGrid,
  Bot,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Facebook,
  Clock,
  UserPlus,
  UserCog,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Chat {
  id: string;
  lastInboundMessageTime?: string;
  unreadCount: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const { data: windowUnreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/chats", "window-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/chats");
      if (!res.ok) return 0;
      const allChats: Chat[] = await res.json();
      const now = new Date();
      let totalUnread = 0;
      for (const chat of allChats) {
        if (chat.unreadCount <= 0) continue;
        if (chat.lastInboundMessageTime) {
          const lastInbound = new Date(chat.lastInboundMessageTime);
          const hoursDiff =
            (now.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
          if (hoursDiff <= 24) {
            totalUnread += chat.unreadCount;
          }
        }
      }
      return totalUnread;
    },
    refetchInterval: 10000,
  });

  const navStructure = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/",
      pageId: "dashboard",
    },
    {
      icon: Clock,
      label: "24-Hour Window",
      href: "/inbox/window",
      pageId: "window-inbox",
      badge: windowUnreadCount > 0 ? windowUnreadCount : undefined,
    },

    {
      icon: MessageSquare,
      label: "Inbox",
      href: "/inbox",
      pageId: "inbox",
    },
    {
      icon: Megaphone,
      label: "Campaigns",
      href: "/campaigns",
      pageId: "broadcast",
      subItems: [
        { label: "Broadcasts", href: "/campaigns/broadcast" },
        // { label: "Selected Contacts", href: "/campaigns/selected-contacts" },
        { label: "Schedule Messages", href: "/campaigns/schedule" },
        { label: "Single Message", href: "/campaigns/single" },
        // { label: "Reports", href: "/campaigns/report" },
      ],
    },
    {
      icon: GitBranch,
      label: "Automation",
      href: "/automation/dashboard",
      pageId: "auto-reply",
      subItems: [
        { label: "Dashboard", href: "/automation/dashboard" },
        { label: "Triggers", href: "/automation/triggers" },
        { label: "Flows", href: "/automation/flows" },
        { label: "Drip Campaigns", href: "/automation/campaigns" },
        // { label: "Segments", href: "/automation/segments" },
        { label: "Analytics", href: "/automation/analytics" },
        { label: "Interest Lists", href: "/automation/interest" },
        // { label: "Builder", href: "/automation" },
        // { label: "Auto Leads", href: "/automation/leads" },
        { label: "Follow-up", href: "/automation/follow-up" },
        // { label: "New Lead Alert", href: "/automation/new-leads" },
      ],
    },
    {
      icon: LayoutGrid,
      label: "Connect Apps",
      href: "/apps/connect",
      pageId: "flow-builder",
    },
    {
      icon: FileText,
      label: "Templates",
      href: "/templates",
      pageId: "templates",
      subItems: [
        { label: "Add Template", href: "/templates/add" },
        // { label: "Template Status", href: "/templates/status" },
        { label: "Manage Templates", href: "/templates/manage" },
      ],
    },
    {
      icon: FileText,
      label: "Usage & Billings",
      href: "/templates",

      subItems: [
        { label: "Billing & Credits", href: "/settings/billing" },
        { label: "Credits", href: "/reports/credits" },
        { label: "Spending", href: "/reports/spending" },
        { label: "AI Tokens", href: "/aitokens" },
        { label: "Whatsapp Tokens", href: "/whatsapptokens" },
      ],
    },
    {
      icon: Bot,
      label: "AI Agent",
      href: "/ai",
      pageId: "ai-agents",
      subItems: [
        { label: "All Agents", href: "/ai/agents" },
        { label: "New Agent", href: "/ai/new" },
        // { label: "Agent Mapping", href: "/ai/map" },
        { label: "Pre-filled Text", href: "/ai/prefilled" },
        // { label: "AI Reports", href: "/ai/reports" },
      ],
    },
    {
      icon: Facebook,
      label: "Facebook",
      href: "/facebook",
      pageId: "facebook-leads",
      subItems: [
        { label: "Lead Forms", href: "/facebook/forms" },
        { label: "Leads", href: "/facebook/leads" },
      ],
    },
    {
      icon: Workflow,
      label: "WhatsApp Flows",
      href: "/whatsapp/flows",
      pageId: "whatsapp-flows",
    },
    {
      icon: BarChart3,
      label: "Reports",
      href: "/reports",
      pageId: "reports-campaign",
      subItems: [
        { label: "Delivery Report", href: "/reports/delivery" },
        { label: "Broadcast Report", href: "/reports/broadcast" },
        { label: "Campaign Perf.", href: "/campaigns/report" },
        { label: "Replies", href: "/reports/replies" },
        { label: "Agent Perf.", href: "/reports/agents" },
        { label: "Contact Analytics", href: "/reports/contacts" },
        { label: "Lead Assignments", href: "/reports/lead-assignments" },
        { label: "User Activity", href: "/reports/user-activity" },
        { label: "Blocked Contacts", href: "/reports/blocked" },

        { label: "User Engagement", href: "/reports/user-engagement" },
      ],
    },
    {
      icon: Users,
      label: "Contacts",
      href: "/contacts",
      pageId: "contacts",
    },
    {
      icon: UserCog,
      label: "User Management",
      href: "/user-management",
      pageId: "user-management",
      adminOnly: true,
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/settings",
      pageId: "settings",
      subItems: [
        // { label: "Team Members", href: "/settings/team" },
        // { label: "Permissions", href: "/settings/permissions" },
        // { label: "WhatsApp Number", href: "/settings/whatsapp" },
        { label: "Profile Details", href: "/settings/profile" },
        { label: "Webhook & API", href: "/settings/api" },
      ],
    },
  ];

  const isSystemUser = user?.pageAccess && user.pageAccess.length > 0;
  const isAdmin = user?.role === "super_admin" || user?.role === "sub_admin";

  const filteredNavStructure = navStructure.filter((item) => {
    if (!isSystemUser) {
      return true;
    }
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    if (!item.pageId) {
      return true;
    }
    return user?.pageAccess?.includes(item.pageId) ?? false;
  });

  const NavItem = ({ item }: { item: any }) => {
    const isActive =
      location === item.href ||
      (item.subItems &&
        item.subItems.some((sub: any) => location === sub.href));
    const [isOpen, setIsOpen] = useState(isActive);
    const itemRef = useRef<HTMLDivElement>(null);

    const handleToggle = (open: boolean) => {
      setIsOpen(open);
      if (open && itemRef.current) {
        setTimeout(() => {
          itemRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);
      }
    };

    if (item.subItems) {
      return (
        <div ref={itemRef}>
          <Collapsible
            open={isOpen}
            onOpenChange={handleToggle}
            className="space-y-1"
          >
            <CollapsibleTrigger asChild>
              <div
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer select-none
                  ${
                    isActive
                      ? "bg-sidebar-accent/50 text-sidebar-accent-foreground"
                      : "text-black hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                {isOpen ? (
                  <ChevronDown className="h-3 w-3 opacity-50" />
                ) : (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                )}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
              {item.subItems.map((sub: any) => (
                <Link key={sub.href} href={sub.href}>
                  <div
                    className={`
                      block px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer
                      ${
                        location === sub.href
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-black hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    {sub.label}
                  </div>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    }

    return (
      <Link href={item.href}>
        <div
          className={`
            flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer
            ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-black hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <item.icon className="h-4 w-4" />
            {item.label}
          </div>
          {item.badge && (
            <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
      </Link>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-screen">
      <div className="p-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading font-bold text-lg leading-none tracking-tight">
            WhatsApp
          </h1>
          <span className="text-xs text-sidebar-foreground/60">
            Business API
          </span>
        </div>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNavStructure.map((item, idx) => (
          <NavItem key={idx} item={item} />
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border shrink-0">
        {/* <div className="p-4 rounded-lg bg-sidebar-accent/50"> */}
        {/* <h4 className="text-sm font-medium text-sidebar-foreground mb-1">Need Help?</h4> */}
        {/* <p className="text-xs text-sidebar-foreground/60 mb-3">Check our documentation for guides.</p> */}
        {/* <Button size="sm" variant="secondary" className="w-full text-xs">Documentation</Button> */}
        {/* </div> */}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 bg-[#9fadcc] text-black border-r border-sidebar-border shrink-0">
        <NavContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 w-64 bg-sidebar border-r border-sidebar-border text-black"
              >
                <NavContent />
              </SheetContent>
            </Sheet>

            <div className="relative hidden sm:block w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-black" />
              <Input
                placeholder="Search messages, contacts, campaigns..."
                className="pl-9 bg-secondary/50 border-none focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive border-2 border-background"></span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage
                      src="https://github.com/shadcn.png"
                      alt="@user"
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-white"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal bg-white">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      WhatsApp Admin
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || "admin@whatsapp.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Users className="mr-2 h-4 w-4" />
                  <span>Team Members</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
