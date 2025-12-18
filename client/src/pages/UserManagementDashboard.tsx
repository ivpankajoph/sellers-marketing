import React, { useState, useEffect } from 'react';
import { Users, LogIn, Eye, Calendar, Clock, Shield, Search, Plus, X, Check } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// Types
interface PageAccess {
  pageId: string;
  pageName: string;
  grantedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin: string;
  pagesAccess: PageAccess[];
}

// Mock data - Replace with API call
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Your Name',
    email: 'Your Email',
    role: 'Admin',
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    lastLogin: '2024-12-17T08:45:00Z',
    pagesAccess: [
      { pageId: 'dashboard', pageName: 'Dashboard', grantedAt: '2024-01-15T10:30:00Z' },
      { pageId: 'analytics', pageName: 'Analytics', grantedAt: '2024-01-15T10:30:00Z' },
      { pageId: 'reports', pageName: 'Reports', grantedAt: '2024-02-10T14:20:00Z' },
      { pageId: 'settings', pageName: 'Settings', grantedAt: '2024-01-15T10:30:00Z' },
    ]
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'User',
    status: 'active',
    createdAt: '2024-02-20T14:15:00Z',
    lastLogin: '2024-12-16T16:30:00Z',
    pagesAccess: [
      { pageId: 'dashboard', pageName: 'Dashboard', grantedAt: '2024-02-20T14:15:00Z' },
      { pageId: 'analytics', pageName: 'Analytics', grantedAt: '2024-02-20T14:15:00Z' },
    ]
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    role: 'Viewer',
    status: 'inactive',
    createdAt: '2024-03-10T09:00:00Z',
    lastLogin: '2024-11-30T12:00:00Z',
    pagesAccess: [
      { pageId: 'dashboard', pageName: 'Dashboard', grantedAt: '2024-03-10T09:00:00Z' },
    ]
  },
];

export default function UserManagementDashboard() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAccessDialog, setShowAccessDialog] = useState(false);

  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Handle login as user
  const handleLoginAsUser = async (userId: string, userName: string) => {
    setLoading(true);
    try {
      // API call to switch user context
      const response = await fetch(`/api/admin/login-as-user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Redirect to user's dashboard or store token
        alert(`Logging in as ${userName}...`);
        // window.location.href = `/dashboard?token=${data.token}`;
      }
    } catch (error) {
      console.error('Login failed:', error);
      alert('Failed to login as user');
    } finally {
      setLoading(false);
    }
  };

  // Fetch users from API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // fetchUsers(); // Uncomment when API is ready
  }, []);

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              User Management
            </h1>
            <p className="text-gray-500 mt-1">Manage user access and permissions</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add New User
          </Button>
        </div>

        {/* Stats Cards */}
     

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
            <CardDescription>All users with access to your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">User</th>
                    <th className="text-left p-3 font-semibold">Role</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold">Pages Access</th>
                    <th className="text-left p-3 font-semibold">Created</th>
                    <th className="text-left p-3 font-semibold">Last Login</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const created = formatDateTime(user.createdAt);
                    const lastLogin = formatDateTime(user.lastLogin);
                    
                    return (
                      <tr key={user.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-semibold">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={user.role === 'Admin' ? 'default' : 'secondary'}
                            className={
                              user.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'User' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={user.status === 'active' ? 'default' : 'secondary'}
                            className={
                              user.status === 'active' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }
                          >
                            {user.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowAccessDialog(true);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View ({user.pagesAccess.length})
                          </Button>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {created.date}
                            </div>
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="h-3 w-3" />
                              {created.time}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {lastLogin.date}
                            </div>
                            <div className="flex items-center gap-1 text-gray-500">
                              <Clock className="h-3 w-3" />
                              {lastLogin.time}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleLoginAsUser(user.id, user.name)}
                            disabled={loading || user.status === 'inactive'}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <LogIn className="h-3 w-3 mr-1" />
                            Login As
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No users found matching your search.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
   <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Users</p>
                  <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Users</p>
                  <p className="text-2xl font-bold text-green-600">
                    {users.filter(u => u.status === 'active').length}
                  </p>
                </div>
                <Check className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Inactive Users</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {users.filter(u => u.status === 'inactive').length}
                  </p>
                </div>
                <X className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Admins</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {users.filter(u => u.role === 'Admin').length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Page Access Dialog */}
        <Dialog open={showAccessDialog} onOpenChange={setShowAccessDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Page Access Details</DialogTitle>
              <DialogDescription>
                {selectedUser?.name} ({selectedUser?.email})
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {selectedUser?.pagesAccess.map((page) => {
                const granted = formatDateTime(page.grantedAt);
                return (
                  <div 
                    key={page.pageId} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold">{page.pageName}</div>
                        <div className="text-sm text-gray-500">ID: {page.pageId}</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="h-3 w-3" />
                        {granted.date}
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3 w-3" />
                        {granted.time}
                      </div>
                    </div>
                  </div>
                );
              })}

              {selectedUser?.pagesAccess.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No page access granted yet.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowAccessDialog(false)}>
                Close
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Manage Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}