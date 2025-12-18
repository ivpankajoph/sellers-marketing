// src/components/layout/Header.tsx
import { useAuth } from "@/contexts/AuthContext";

import { Bell, LogOut, Menu, Search, Settings, Users } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export default function Header({ isSidebarOpen, onToggleSidebar, onLogout }: HeaderProps) {
  const { user } = useAuth();
  const [location] = useLocation();

  return (
    <header className="h-16 border-b border-border bg-background px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

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
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarImage src="https://github.com/shadcn.png" alt="@user" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-white" align="end" forceMount>
            <DropdownMenuLabel className="font-normal bg-white">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">WhatsApp Admin</p>
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
              onClick={onLogout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}