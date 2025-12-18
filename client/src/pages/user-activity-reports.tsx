import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Activity, UserCheck, History, Loader2, RefreshCw, Calendar, Clock, Eye, Edit, Plus, Trash2 } from "lucide-react";
import { format, subDays } from "date-fns";

interface ActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface UserActivitySummary {
  userId: string;
  userName: string;
  userRole: string;
  totalActions: number;
  lastActivityAt: string;
  actionBreakdown: {action: string; count: number}[];
}

interface ActivityStats {
  totalActivities: number;
  uniqueUsers: number;
  byAction: {action: string; count: number}[];
  byEntityType: {entityType: string; count: number}[];
  byUser: UserActivitySummary[];
}

export default function UserActivityReportsPage() {
  const [dateRange, setDateRange] = useState("7");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ActivityStats>({
    queryKey: ["/api/lead-management/reports/activity-stats", dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const res = await fetch(`/api/lead-management/reports/activity-stats?startDate=${startDate.toISOString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch activity stats");
      return res.json();
    },
  });

  const { data: activities, isLoading: activitiesLoading, refetch: refetchActivities } = useQuery<ActivityLog[]>({
    queryKey: ["/api/lead-management/reports/activity-logs", dateRange, filterUserId, filterAction],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        limit: "200",
      });
      if (filterUserId !== "all") params.append("userId", filterUserId);
      if (filterAction !== "all") params.append("action", filterAction);
      
      const res = await fetch(`/api/lead-management/reports/activity-logs?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
  });

  const { data: users } = useQuery<{id: string; name: string; role: string}[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchActivities();
  };

  const handleExportCSV = () => {
    if (!activities) return;
    
    const headers = ["User", "Role", "Action", "Entity Type", "Details", "Timestamp"];
    const rows = activities.map(a => [
      a.userName,
      a.userRole,
      a.action,
      a.entityType,
      JSON.stringify(a.details),
      format(new Date(a.createdAt), "yyyy-MM-dd HH:mm:ss"),
    ]);
    
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
      case "assign":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "update":
      case "reassign":
        return <Edit className="h-4 w-4 text-blue-600" />;
      case "delete":
      case "unassign":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case "view":
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-700 border-green-200",
      assign: "bg-green-100 text-green-700 border-green-200",
      update: "bg-blue-100 text-blue-700 border-blue-200",
      reassign: "bg-blue-100 text-blue-700 border-blue-200",
      delete: "bg-red-100 text-red-700 border-red-200",
      unassign: "bg-red-100 text-red-700 border-red-200",
      view: "bg-gray-100 text-gray-700 border-gray-200",
      bulk_assign: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return (
      <Badge variant="outline" className={colors[action] || "bg-gray-100 text-gray-700"}>
        <span className="flex items-center gap-1">
          {getActionIcon(action)}
          {action.replace("_", " ")}
        </span>
      </Badge>
    );
  };

  const formatDetails = (details: Record<string, unknown>) => {
    const keys = Object.keys(details);
    if (keys.length === 0) return "-";
    
    return keys.slice(0, 3).map(key => {
      const value = details[key];
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      return `${key}: ${displayValue.slice(0, 30)}${displayValue.length > 30 ? '...' : ''}`;
    }).join(", ");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Member Reports</h1>
            <p className="text-muted-foreground">Track team member actions and system activity</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Total Activities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.totalActivities}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    In selected period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.uniqueUsers}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Team members with activity
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Assignment Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {stats.byAction.filter(a => a.action === "assign" || a.action === "bulk_assign").reduce((sum, a) => sum + a.count, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lead assignments made
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Avg Daily Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(stats.totalActivities / parseInt(dateRange))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per day average
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="by-user">
              <TabsList>
                <TabsTrigger value="by-user">By Team Member</TabsTrigger>
                <TabsTrigger value="all-activities">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="by-user" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Team Member Activity Summary</CardTitle>
                    <CardDescription>Actions performed by each team member</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.byUser.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No activity found in selected period
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Team Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-center">Total Actions</TableHead>
                            <TableHead>Action Breakdown</TableHead>
                            <TableHead>Last Activity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.byUser.map((user) => (
                            <TableRow key={user.userId}>
                              <TableCell className="font-medium">{user.userName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{user.userRole}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{user.totalActions}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {user.actionBreakdown.slice(0, 4).map(ab => (
                                    <Badge 
                                      key={ab.action} 
                                      variant="outline" 
                                      className="text-xs"
                                    >
                                      {ab.action}: {ab.count}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {user.lastActivityAt 
                                  ? format(new Date(user.lastActivityAt), "MMM d, HH:mm")
                                  : "N/A"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="all-activities" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>Detailed log of all user activities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <Select value={filterUserId} onValueChange={setFilterUserId}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          {users?.map(user => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={filterAction} onValueChange={setFilterAction}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          <SelectItem value="assign">Assign</SelectItem>
                          <SelectItem value="bulk_assign">Bulk Assign</SelectItem>
                          <SelectItem value="unassign">Unassign</SelectItem>
                          <SelectItem value="reassign">Reassign</SelectItem>
                          <SelectItem value="update">Update</SelectItem>
                          <SelectItem value="view">View</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {activitiesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : !activities || activities.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No activities found matching filters
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Entity Type</TableHead>
                              <TableHead>Details</TableHead>
                              <TableHead>Timestamp</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activities.map((activity) => (
                              <TableRow key={activity._id}>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{activity.userName}</div>
                                    <div className="text-xs text-muted-foreground">{activity.userRole}</div>
                                  </div>
                                </TableCell>
                                <TableCell>{getActionBadge(activity.action)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {activity.entityType}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                  {formatDetails(activity.details)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                                  {format(new Date(activity.createdAt), "MMM d, HH:mm:ss")}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2" />
                <p>Failed to load activity data. Please try again.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
