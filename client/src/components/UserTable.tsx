// src/app/user-management/UserTable.tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, MoreVertical, Edit, Key, Trash2, Zap, LogIn, Plus } from "lucide-react";
import { SystemUser, Page, Role } from "../pages/UserManagement";
import { Users } from "lucide-react";
import { Label } from "@/components/ui/label";

interface UserTableProps {
  users: SystemUser[];
  roles: Role[];
  pages: Page[];
  isLoading: boolean;
  onEdit: (user: SystemUser) => void;
  onViewDetails: (user: SystemUser) => void;
  onDelete: (user: SystemUser) => void;
  onManageCredits: (user: SystemUser) => void; // ← used for "Add Token"
  onResetPassword: (userId: string) => void;
  onImpersonate: (userId: string) => void;
  isDetailOpen: boolean;
  setIsDetailOpen: (open: boolean) => void;
  selectedUser: SystemUser | null;
  formatDateTime: (date: string) => string;
  getPageNames: (pageAccess: string[]) => string[];
  getRoleName: (roleId: string) => string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-red-200",
  sub_admin: "bg-purple-100 text-purple-800 border-purple-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  user: "bg-gray-100 text-gray-800 border-gray-200"
};

export default function UserTable({
  users,
  roles,
  pages,
  isLoading,
  onEdit,
  onViewDetails,
  onDelete,
  onManageCredits,
  onResetPassword,
  onImpersonate,
  isDetailOpen,
  setIsDetailOpen,
  selectedUser,
  formatDateTime,
  getPageNames,
  getRoleName,
}: UserTableProps) {
  return (
    <>
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
          {isLoading ? (
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
                  <TableHead className="text-center">Add Token</TableHead>
                  <TableHead className="text-center">Login</TableHead>
                  <TableHead className="text-center">Available Tokens</TableHead>
                  <TableHead className="w-[60px]"></TableHead> {/* Actions overflow */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => onViewDetails(user)}
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
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageCredits(user);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Token
                      </Button>
                    </TableCell>

                    {/* NEW: Login As */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImpersonate(user.id);
                        }}
                        disabled={!user.isActive}
                      >
                        <LogIn className="h-3 w-3" />
                      </Button>
                    </TableCell>

                    {/* NEW: Available Tokens (static for now) */}
                    <TableCell className="text-center text-sm">
                      <div>WA: ₹{user.whatsappCredits || 0}</div>
                      <div>AI: {user.aiTokens?.toLocaleString() || 0}</div>
                    </TableCell>

                    {/* Existing Actions (More menu) */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(user); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onResetPassword(user.id); }}>
                            <Key className="mr-2 h-4 w-4" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onManageCredits(user);
                            }}
                          >
                            <Zap className="mr-2 h-4 w-4" />
                            Manage Credits
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); onDelete(user); }}
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
                <div className="mt-2">
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
                  onClick={() => onImpersonate(selectedUser.id)}
                  disabled={!selectedUser.isActive}
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
    </>
  );
}