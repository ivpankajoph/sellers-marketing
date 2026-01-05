// src/components/layout/SidebarNav.tsx
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
  ChevronLeft,
  User,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Chat {
  id: string;
  lastInboundMessageTime?: string;
  unreadCount: number;
}

interface NavItemProps {
  item: any;
  isCollapsed: boolean;
}

const NavItem = ({ item, isCollapsed }: NavItemProps) => {
  const [location, navigate] = useLocation();
  const isActive =
    location === item.href ||
    (item.subItems && item.subItems.some((sub: any) => location === sub.href));
  const [isOpen, setIsOpen] = useState(isActive);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    if (open && itemRef.current) {
      setTimeout(() => {
        itemRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const handleNavigation = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    // Check if it's a special click (new tab, new window, etc.)
    const isSpecialClick =
      e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;

    if (!isSpecialClick) {
      // Normal click - use client-side routing
      e.preventDefault();
      navigate(href);
    }
    // For special clicks, let the browser handle it naturally with the href
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
              title={isCollapsed ? item.label : ""}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && item.label}
              </div>
              {!isCollapsed &&
                (isOpen ? (
                  <ChevronDown className="h-3 w-3 opacity-50" />
                ) : (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                ))}
            </div>
          </CollapsibleTrigger>
          {!isCollapsed && (
            <CollapsibleContent className="pl-9 space-y-1 animate-in slide-in-from-top-2 duration-200">
              {item.subItems.map((sub: any) => (
                <a
                  key={sub.href}
                  href={sub.href}
                  onClick={(e) => handleNavigation(e, sub.href)}
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
                </a>
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>
      </div>
    );
  }

  return (
    <a
      href={item.href}
      onClick={(e) => handleNavigation(e, item.href)}
      className={`
        flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer
        ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-black hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }
      `}
      title={isCollapsed ? item.label : ""}
    >
      <div className="flex items-center gap-3">
        <item.icon className="h-4 w-4 shrink-0" />
        {!isCollapsed && item.label}
      </div>
      {!isCollapsed && item.badge && (
        <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
          {item.badge > 99 ? "99+" : item.badge}
        </Badge>
      )}
      {isCollapsed && item.badge && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></div>
      )}
    </a>
  );
};

interface SidebarNavProps {
  isMobile: boolean;
  onLogout: () => void;
}

interface SidebarUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function SidebarNav({ isMobile, onLogout }: SidebarNavProps) {
  const AUTH_USER_KEY = "whatsapp_auth_user";

  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  const { data: users = [], isLoading } = useQuery<SidebarUser[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users/all");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const updateAuthUserInStorage = (user: any) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  };

  const getInitialUser = () => {
    try {
      const raw = localStorage.getItem("whatsapp_auth_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  };

  const [selectedUser, setSelectedUser] = useState<any>(getInitialUser());
  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      setSelectedUser(users[0]);
      updateAuthUserInStorage(users[0]);
    }
  }, [users]);

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
    { icon: MessageSquare, label: "Inbox", href: "/inbox", pageId: "inbox" },
    {
      icon: Megaphone,
      label: "Campaigns",
      href: "/campaigns",
      pageId: "broadcast",
      subItems: [
        { label: "Broadcasts", href: "/campaigns/broadcast" },
        { label: "Schedule Messages", href: "/campaigns/schedule" },
        { label: "Single Messages", href: "/campaigns/past" },
      ],
    },
    {
      icon: GitBranch,
      label: "Automation",
      href: "/automation/dashboard",
      pageId: "auto-reply",
      subItems: [
        { label: "Facebook Lead Automation", href: "/automation/triggers" },
        { label: "Flows", href: "/whatsapp/flows" },
          { label: "Create Flows", href: "/create-whatsappflow" },
        { label: "Drip Campaigns", href: "/automation/campaigns" },
        // { label: "Analytics", href: "/automation/analytics" },
        { label: "Interest Lists", href: "/automation/interest" },
        // { label: "Follow-up", href: "/automation/follow-up" },
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
        { label: "Manage Templates", href: "/templates/manage" },
      ],
    },
    {
      icon: FileText,
      label: "Usage & Billings",
      href: "/templates",
      subItems: [
        { label: "Billing & Credits", href: "/settings/billing" },
        { label: "Spendings", href: "/reports/spending" },
        // { label: "Contact Usage Dashboard", href: "/contactusagedashboard" },
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
        { label: "Pre-filled Text", href: "/ai/prefilled" },
      ],
    },
    {
      icon: Facebook,
      label: "Facebook",
      href: "/facebook",
      pageId: "facebook-leads",
      subItems: [
        { label: "Lead Forms", href: "/facebook/forms" },
        // { label: "Leads", href: "/facebook/leads" },
      ],
    },
    {
      icon: BarChart3,
      label: "Reports",
      href: "/reports",
      pageId: "reports-campaign",
      subItems: [
        { label: "Broadcast Report", href: "/reports/broadcast" },
        // { label: "Campaign Perf.", href: "/reports/campaign" },
        { label: "Agent Perf.", href: "/reports/agents" },
        { label: "Contact Analytics", href: "/reports/contacts" },
        { label: "Lead Assignments", href: "/reports/lead-assignments" },
        { label: "Team Member Report", href: "/reports/user-activity" },
        { label: "Blocked Contacts", href: "/reports/blocked" },
        {
          label: "Fb Lead Automation Report",
          href: "/fblead-automation-report",
        },
        { label: "User Engagement", href: "/reports/user-engagement" },
      ],
    },
    { icon: Users, label: "Contacts", href: "/contacts", pageId: "contacts" },
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
        { label: "Profile Details", href: "/settings/profile" },
        { label: "Webhook & API", href: "/settings/api" },
      ],
    },
  ];

  const isSystemUser = user?.pageAccess && user.pageAccess.length > 0;
  const isAdmin = user?.role === "super_admin" || user?.role === "sub_admin";

  const filteredNavStructure = navStructure.filter((item) => {
    if (!isSystemUser) return true;
    if (item.adminOnly && !isAdmin) return false;
    if (!item.pageId) return true;
    return user?.pageAccess?.includes(item.pageId) ?? false;
  });

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`p-6 flex items-center ${
          isCollapsed ? "justify-center" : "gap-3"
        }`}
      >
        {!isCollapsed ? (
          <>
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
          </>
        ) : (
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
        )}
      </div>

      <div className={`px-4 pb-4 ${isCollapsed ? "flex justify-center" : ""}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full flex items-center border border-black justify-between ${
                isCollapsed ? "px-2" : ""
              }`}
            >
              {!isCollapsed && (
                <>
                  <User className="h-4 w-4" />
                  <span className="truncate">
                    {selectedUser ? selectedUser.name : "Loading..."}
                  </span>
                </>
              )}
              {isCollapsed && <User className="h-4 w-4" />}
              {!isCollapsed && <ChevronDown className="h-3 w-3 opacity-50" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-56 border border-black"
          >
            {isLoading && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Loading users...
              </div>
            )}

            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => {
                  setSelectedUser(user);
                  updateAuthUserInStorage(user);
                  window.location.reload();
                }}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
        {filteredNavStructure.map((item, idx) => (
          <NavItem key={idx} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>

      {isMobile && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </div>
      )}
    </div>
  );

  return isMobile ? (
    <NavContent />
  ) : (
    <div className="h-screen">
      <NavContent />
    </div>
  );
}
