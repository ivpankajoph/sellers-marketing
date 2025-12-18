// src/app/user-management/UserManagement.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Users, UserCheck, UserX, File, UserCog, UserPlus } from "lucide-react";


export interface SystemUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  pageAccess: string[];
  isActive: boolean;
  createdAt: string;
  whatsappCredits?: number;
  aiTokens?: number;
}

export interface Page {
  id: string;
  name: string;
  icon: string;
  path: string;
  children?: { id: string; name: string }[];
}

export interface Role {
  id: string;
  name: string;
}

const saveLocalUserCredit = (userId: string, field: 'whatsappCredits' | 'aiTokens', value: number) => {
  const key = `user_credits_${userId}`;
  const existing = JSON.parse(localStorage.getItem(key) || '{}');
  localStorage.setItem(key, JSON.stringify({ ...existing, [field]: value }));
};

const getLocalUserCredits = (userId: string): { whatsappCredits?: number; aiTokens?: number } => {
  const key = `user_credits_${userId}`;
  return JSON.parse(localStorage.getItem(key) || '{}');
};

export default function UserManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [newCredentials, setNewCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
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
      return serverUsers.map(user => ({
        ...user,
        ...getLocalUserCredits(user.id)
      }));
    }
  });

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

  // === Mutations ===
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

  // === Helpers ===
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
          <Card icon={Users} title="Total Users" value={users.length} />
          <Card icon={UserCheck} title="Active Users" value={activeUsers} />
          <Card icon={UserX} title="Inactive Users" value={inactiveUsers} />
          <Card icon={File} title="Total Pages" value={pages.length} />
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
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>

        <UserTable
          users={users}
          roles={roles}
          pages={pages}
          isLoading={usersLoading}
          onEdit={handleEditUser}
          onViewDetails={handleViewDetails}
          onDelete={(user) => { setSelectedUser(user); setIsDeleteOpen(true); }}
          onManageCredits={(user) => {
            setSelectedUser(user);
            setCreditFormData({
              whatsappCredits: user.whatsappCredits || 0,
              aiTokens: user.aiTokens || 0
            });
            setIsCreditModalOpen(true);
          }}
          onResetPassword={(userId) => resetPasswordMutation.mutate(userId)}
          onImpersonate={(userId) => impersonateUserMutation.mutate(userId)}
          isDetailOpen={isDetailOpen}
          setIsDetailOpen={setIsDetailOpen}
          selectedUser={selectedUser}
          formatDateTime={formatDateTime}
          getPageNames={getPageNames}
          getRoleName={getRoleName}
        />

        <UserModals
          // Create
          isCreateOpen={isCreateOpen}
          setIsCreateOpen={setIsCreateOpen}
          formData={formData}
          setFormData={setFormData}
          pages={pages}
          roles={roles}
          handlePageToggle={handlePageToggle}
          handleChildToggle={handleChildToggle}
          handleSelectAllPages={handleSelectAllPages}
          createUserMutation={createUserMutation}
          resetForm={resetForm}
          // Edit
          isEditOpen={isEditOpen}
          setIsEditOpen={setIsEditOpen}
          selectedUser={selectedUser}
          updateUserMutation={updateUserMutation}
          // Credentials
          isCredentialsOpen={isCredentialsOpen}
          setIsCredentialsOpen={setIsCredentialsOpen}
          newCredentials={newCredentials}
          copied={copied}
          copyCredentials={copyCredentials}
          // Delete
          isDeleteOpen={isDeleteOpen}
          setIsDeleteOpen={setIsDeleteOpen}
          deleteUserMutation={deleteUserMutation}
          // Credits
          isCreditModalOpen={isCreditModalOpen}
          setIsCreditModalOpen={setIsCreditModalOpen}
          creditFormData={creditFormData}
          setCreditFormData={setCreditFormData}
          saveLocalUserCredit={saveLocalUserCredit}
          queryClient={queryClient}
        />
      </div>
    </DashboardLayout>
  );
}

// --- Reused Card Component ---
import { Card as CardUI, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UserTable from "@/components/UserTable";
import UserModals from "@/components/UserModals";
const Card = ({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: number }) => (
  <CardUI>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </CardUI>
);