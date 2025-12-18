// src/app/user-management/UserModals.tsx
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    UserPlus,
    Shield,
    Copy,
    Check,
    Loader2,
    Key,
    Zap,
    Edit,
    Trash2,
    MoreVertical
} from "lucide-react";

import { QueryClient } from "@tanstack/react-query";

interface UserModalsProps {
    isCreateOpen: boolean;
    setIsCreateOpen: (open: boolean) => void;
    formData: { email: string; name: string; role: string; pageAccess: string[] };
    setFormData: React.Dispatch<React.SetStateAction<{ email: string; name: string; role: string; pageAccess: string[] }>>;
    pages: Page[];
    roles: Role[];
    handlePageToggle: (page: Page) => void;
    handleChildToggle: (childId: string) => void;
    handleSelectAllPages: () => void;
    createUserMutation: any;
    resetForm: () => void;
    isEditOpen: boolean;
    setIsEditOpen: (open: boolean) => void;
    selectedUser: any;
    updateUserMutation: any;
    isCredentialsOpen: boolean;
    setIsCredentialsOpen: (open: boolean) => void;
    newCredentials: { username: string; password: string } | null;
    copied: boolean;
    copyCredentials: () => void;
    isDeleteOpen: boolean;
    setIsDeleteOpen: (open: boolean) => void;
    deleteUserMutation: any;
    isCreditModalOpen: boolean;
    setIsCreditModalOpen: (open: boolean) => void;
    creditFormData: { whatsappCredits: number; aiTokens: number };
    setCreditFormData: React.Dispatch<React.SetStateAction<{ whatsappCredits: number; aiTokens: number }>>;
    saveLocalUserCredit: (userId: string, field: 'whatsappCredits' | 'aiTokens', value: number) => void;
    queryClient: QueryClient;
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

export default function UserModals({
    // Create
    isCreateOpen,
    setIsCreateOpen,
    formData,
    setFormData,
    pages,
    roles,
    handlePageToggle,
    handleChildToggle,
    handleSelectAllPages,
    createUserMutation,
    resetForm,
    // Edit
    isEditOpen,
    setIsEditOpen,
    selectedUser,
    updateUserMutation,
    // Credentials
    isCredentialsOpen,
    setIsCredentialsOpen,
    newCredentials,
    copied,
    copyCredentials,
    // Delete
    isDeleteOpen,
    setIsDeleteOpen,
    deleteUserMutation,
    // Credits
    isCreditModalOpen,
    setIsCreditModalOpen,
    creditFormData,
    setCreditFormData,
    saveLocalUserCredit,
    queryClient,
}: UserModalsProps) {
    return (
        <>
            {/* Create User Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                                    placeholder="Your Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Your Email"
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

            {/* Edit User Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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

            {/* Credentials Dialog */}
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
                        <Button onClick={() => { setIsCredentialsOpen(false); }}>
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
                                    saveLocalUserCredit(selectedUser.id, 'whatsappCredits', creditFormData.whatsappCredits);
                                    saveLocalUserCredit(selectedUser.id, 'aiTokens', creditFormData.aiTokens);
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

            {/* Delete Confirmation */}
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
        </>
    );
}

import {
    LayoutDashboard,
    Clock,
    MessageSquare,
    Users,
    Radio,
    FileText,
    Bot,
    Facebook,
    GitBranch,
    BarChart3,
    Ban,
    TrendingUp,
    Settings,
    UserCog
} from "lucide-react";

import { Page, Role, SystemUser } from "@/pages/UserManagement";
