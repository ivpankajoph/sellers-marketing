import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  UserPlus,
  UserCog,
  MoreVertical,
  Key,
  Trash2,
  Edit,
  Shield,
  Copy,
  Check,
  Loader2,
  Users,
  LayoutDashboard,
  Clock,
  MessageSquare,
  Radio,
  FileText,
  Bot,
  Zap,
  GitBranch,
  BarChart3,
  Ban,
  TrendingUp,
  Settings,
  Facebook,
  LogIn,
  UserCheck,
  UserX,
  File
} from "lucide-react";

interface SystemUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  pageAccess: string[];
  isActive: boolean;
  createdAt: string;
  whatsappCredits?: number;   // ← new
  aiTokens?: number;
}

interface Page {
  id: string;
  name: string;
  icon: string;
  path: string;
  children?: { id: string; name: string }[];
}

interface Role {
  id: string;
  name: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  Clock: <Clock className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Radio: <Radio className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Bot: <Bot className="h-4 w-4" />,
  UserPlus: <UserPlus className="h-4 w-4" />,
  Facebook: <Facebook className="h-4 w-4" />,
  Zap: <Zap className="h-4 w-4" />,
  GitBranch: <GitBranch className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Ban: <Ban className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  UserCog: <UserCog className="h-4 w-4" />
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-red-200",
  sub_admin: "bg-purple-100 text-purple-800 border-purple-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-gray-100 text-gray-800 border-gray-200"
};

export default function UserManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newCredentials, setNewCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditFormData, setCreditFormData] = useState({
    whatsappCredits: 0,
    aiTokens: 0
  });

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    role: "user",
    pageAccess: ["dashboard"] as string[]
  });

  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const serverUsers: SystemUser[] = await res.json();

      // Augment with localStorage credits
      return serverUsers.map(user => ({
        ...user,
        ...getLocalUserCredits(user.id)
      }));
    }
  });


  const saveLocalUserCredit = (userId: string, field: 'whatsappCredits' | 'aiTokens', value: number) => {
    const key = `user_credits_${userId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...existing, [field]: value }));
  };

  const getLocalUserCredits = (userId: string): { whatsappCredits?: number; aiTokens?: number } => {
    const key = `user_credits_${userId}`;
    return JSON.parse(localStorage.getItem(key) || '{}');
  };

  const { data: pages = [] } = useQuery<Page[]>({
    queryKey: ["/api/users/pages"],
    queryFn: async () => {
      const res = await fetch("/api/users/pages", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    }
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/users/roles"],
    queryFn: async () => {
      const res = await fetch("/api/users/roles", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    }
  });

  const activeUsers = users.filter(u => u.isActive).length;
  const inactiveUsers = users.length - activeUsers;

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setNewCredentials(data.credentials);
      setIsCreateOpen(false);
      setIsCredentialsOpen(true);
      resetForm();
      if (data.emailSent) {
        toast.success("User created successfully. Credentials have been emailed.");
      } else {
        toast.success("User created successfully. Email could not be sent - share credentials manually.");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<typeof formData>) => {
      const res = await fetch(`/api/users/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      toast.success("User updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteOpen(false);
      setSelectedUser(null);
      toast.success("User deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete user");
    }
  });

  const impersonateUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}/impersonate`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to impersonate user");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast.error("No redirect URL returned");
      }
    },
    onError: () => {
      toast.error("Failed to login as user");
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return res.json();
    },
    onSuccess: (data) => {
      setNewCredentials(data);
      setIsCredentialsOpen(true);
      if (data.emailSent) {
        toast.success("Password reset successfully. New credentials have been emailed.");
      } else {
        toast.success("Password reset successfully. Email could not be sent - share credentials manually.");
      }
    },
    onError: () => {
      toast.error("Failed to reset password");
    }
  });

  const resetForm = () => {
    setFormData({
      email: "",
      name: "",
      role: "user",
      pageAccess: ["dashboard"]
    });
  };

  const handleEditUser = (user: SystemUser) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      pageAccess: user.pageAccess
    });
    setIsEditOpen(true);
  };

  const handleViewDetails = (user: SystemUser) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const handlePageToggle = (page: Page) => {
    setFormData(prev => {
      const isSelected = prev.pageAccess.includes(page.id);
      const childIds = page.children?.map(c => c.id) || [];
      if (isSelected) {
        return {
          ...prev,
          pageAccess: prev.pageAccess.filter(id => id !== page.id && !childIds.includes(id))
        };
      }
      return {
        ...prev,
        pageAccess: Array.from(new Set([...prev.pageAccess, page.id, ...childIds]))
      };
    });
  };

  const handleChildToggle = (childId: string) => {
    setFormData(prev => ({
      ...prev,
      pageAccess: prev.pageAccess.includes(childId)
        ? prev.pageAccess.filter(id => id !== childId)
        : [...prev.pageAccess, childId]
    }));
  };

  const handleSelectAllPages = () => {
    if (formData.pageAccess.length === pages.length) {
      setFormData(prev => ({ ...prev, pageAccess: ["dashboard"] }));
    } else {
      setFormData(prev => ({ ...prev, pageAccess: pages.map(p => p.id) }));
    }
  };

  const copyCredentials = () => {
    if (newCredentials) {
      navigator.clipboard.writeText(`Username: ${newCredentials.username}\nPassword: ${newCredentials.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Credentials copied to clipboard");
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getPageNames = (pageAccess: string[]) => {
    const allPages = new Map<string, string>();
    pages.forEach(p => {
      allPages.set(p.id, p.name);
      p.children?.forEach(c => allPages.set(c.id, c.name));
    });
    return pageAccess.map(id => allPages.get(id) || id);
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || roleId;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inactiveUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pages</CardTitle>
              <File className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pages.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="h-7 w-7 text-primary" />
              User Management
            </h2>
            <p className="text-muted-foreground">
              Create and manage users, assign roles and page access permissions
            </p>

            <a href="/reports/lead-assignments">
              <Button className="mt-4 cursor-pointer bg-white text-black border border-black">
                See All Reports
              </Button>
            </a>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system. They will receive login credentials after creation.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.filter(r => r.id !== 'super_admin').map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Page Access</Label>
                    <Button variant="ghost" size="sm" onClick={handleSelectAllPages}>
                      {formData.pageAccess.length === pages.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <Card>
                    <ScrollArea className="h-[200px]">
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {pages.map(page => {
                          const parentSelected = formData.pageAccess.includes(page.id);
                          return (
                            <div key={page.id} className="space-y-2">
                              <div
                                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${parentSelected
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-muted"
                                  }`}
                                onClick={() => handlePageToggle(page)}
                              >
                                <Checkbox checked={parentSelected} />
                                <div className="flex items-center gap-2">
                                  {ICON_MAP[page.icon]}
                                  <span className="text-sm font-medium">{page.name}</span>
                                </div>
                              </div>
                              {parentSelected && page.children && (
                                <div className="ml-6 space-y-1 border-l pl-4">
                                  {page.children.map((child) => (
                                    <div
                                      key={child.id}
                                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${formData.pageAccess.includes(child.id)
                                        ? "bg-primary/5 border-primary"
                                        : "hover:bg-muted"
                                        }`}
                                      onClick={() => handleChildToggle(child.id)}
                                    >
                                      <Checkbox checked={formData.pageAccess.includes(child.id)} />
                                      <span className="text-sm">{child.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </Card>
                  <p className="text-xs text-muted-foreground">
                    {formData.pageAccess.length} page(s) selected
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createUserMutation.mutate(formData)}
                  disabled={!formData.name || !formData.email || createUserMutation.isPending}
                >
                  {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              System Users
            </CardTitle>
            <CardDescription>
              {users.length} user{users.length !== 1 ? "s" : ""} in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users created yet</p>
                <p className="text-sm">Create your first user to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Pages</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleViewDetails(user)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{user.username}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[user.role] || ROLE_COLORS.user}>
                          {getRoleName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {user.pageAccess.length} pages
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditUser(user); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); resetPasswordMutation.mutate(user.id); }}>
                              <Key className="mr-2 h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(user);
                                setCreditFormData({
                                  whatsappCredits: user.whatsappCredits || 0,
                                  aiTokens: user.aiTokens || 0
                                });
                                setIsCreditModalOpen(true);
                              }}
                            >
                              <Zap className="mr-2 h-4 w-4" />
                              Manage Credits
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); setSelectedUser(user); setIsDeleteOpen(true); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* User Detail Modal */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>Full access and account information</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Name</Label>
                    <p className="font-medium">{selectedUser.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Email</Label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Username</Label>
                    <code className="bg-muted px-2 py-1 rounded">{selectedUser.username}</code>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Role</Label>
                    <Badge variant="outline" className={ROLE_COLORS[selectedUser.role] || ROLE_COLORS.user}>
                      {getRoleName(selectedUser.role)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Status</Label>
                    <Badge variant={selectedUser.isActive ? "default" : "destructive"}>
                      {selectedUser.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Created</Label>
                    <p className="font-medium">{formatDateTime(selectedUser.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-sm">Page Access</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getPageNames(selectedUser.pageAccess).map((name, idx) => (
                      <Badge key={idx} variant="secondary">{name}</Badge>
                    ))}
                  </div>
                  {/* Inside the grid */}
                  <div>
                    <Label className="text-muted-foreground text-sm">WhatsApp Credits</Label>
                    <p className="font-medium">₹{selectedUser.whatsappCredits || 0} (≈ {selectedUser.whatsappCredits || 0} messages)</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">AI Tokens</Label>
                    <p className="font-medium">{selectedUser.aiTokens?.toLocaleString() || 0} tokens</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => impersonateUserMutation.mutate(selectedUser.id)}
                    disabled={impersonateUserMutation.isPending || !selectedUser.isActive}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Login as User
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Other Dialogs */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          {/* ... same as before ... */}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details and permissions</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email Address</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.id !== 'super_admin').map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Page Access</Label>
                  <Button variant="ghost" size="sm" onClick={handleSelectAllPages}>
                    {formData.pageAccess.length === pages.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <Card>
                  <ScrollArea className="h-[200px]">
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {pages.map(page => {
                        const parentSelected = formData.pageAccess.includes(page.id);
                        return (
                          <div key={page.id} className="space-y-2">
                            <div
                              className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${parentSelected
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted"
                                }`}
                              onClick={() => handlePageToggle(page)}
                            >
                              <Checkbox checked={parentSelected} />
                              <div className="flex items-center gap-2">
                                {ICON_MAP[page.icon]}
                                <span className="text-sm font-medium">{page.name}</span>
                              </div>
                            </div>
                            {parentSelected && page.children && (
                              <div className="ml-6 space-y-1 border-l pl-4">
                                {page.children.map((child) => (
                                  <div
                                    key={child.id}
                                    className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${formData.pageAccess.includes(child.id)
                                      ? "bg-primary/5 border-primary"
                                      : "hover:bg-muted"
                                      }`}
                                    onClick={() => handleChildToggle(child.id)}
                                  >
                                    <Checkbox checked={formData.pageAccess.includes(child.id)} />
                                    <span className="text-sm">{child.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button
                onClick={() => selectedUser && updateUserMutation.mutate({ id: selectedUser.id, ...formData })}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCredentialsOpen} onOpenChange={setIsCredentialsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                User Credentials
              </DialogTitle>
              <DialogDescription>
                Share these credentials with the user. The password cannot be viewed again.
              </DialogDescription>
            </DialogHeader>
            {newCredentials && (
              <div className="space-y-4 py-4">
                <Card className="bg-muted/50">
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Username</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background p-3 rounded-lg font-mono text-lg">
                          {newCredentials.username}
                        </code>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Password</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background p-3 rounded-lg font-mono text-lg">
                          {newCredentials.password}
                        </code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Button className="w-full" variant="outline" onClick={copyCredentials}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Credentials"}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { setIsCredentialsOpen(false); setNewCredentials(null); }}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manage Credits Dialog */}
        <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage User Credits</DialogTitle>
              <DialogDescription>
                Assign WhatsApp message credits and AI usage tokens.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="whatsappCredits">WhatsApp Credits (₹1 per message)</Label>
                <Input
                  id="whatsappCredits"
                  type="number"
                  min="0"
                  value={creditFormData.whatsappCredits}
                  onChange={(e) => setCreditFormData(prev => ({
                    ...prev,
                    whatsappCredits: Number(e.target.value) || 0
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aiTokens">AI Tokens (₹500 per 1 lakh tokens)</Label>
                <Input
                  id="aiTokens"
                  type="number"
                  min="0"
                  value={creditFormData.aiTokens}
                  onChange={(e) => setCreditFormData(prev => ({
                    ...prev,
                    aiTokens: Number(e.target.value) || 0
                  }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUser) {
                    // Save to localStorage
                    saveLocalUserCredit(selectedUser.id, 'whatsappCredits', creditFormData.whatsappCredits);
                    saveLocalUserCredit(selectedUser.id, 'aiTokens', creditFormData.aiTokens);

                    // Update local data without refetch (optional: you can refetch if needed)
                    queryClient.setQueryData<SystemUser[]>(["/api/users"], (old) => {
                      return old?.map(u =>
                        u.id === selectedUser.id
                          ? { ...u, ...creditFormData }
                          : u
                      );
                    });

                    toast.success("Credits updated successfully");
                    setIsCreditModalOpen(false);
                  }
                }}
              >
                Save Credits
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}