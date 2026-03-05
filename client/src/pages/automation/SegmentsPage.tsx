import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Users, 
  Plus, 
  Trash2, 
  Copy, 
  Edit, 
  Search,
  RefreshCw,
  Eye,
  Filter,
  Zap,
  GitBranch,
  Mail,
  Clock
} from "lucide-react";
import { getAuthHeaders } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Segment {
  _id: string;
  name: string;
  description?: string;
  type: 'dynamic' | 'static';
  status: 'active' | 'inactive' | 'computing';
  refreshStrategy: string;
  memberCount: number;
  usedInTriggers: number;
  usedInFlows: number;
  usedInCampaigns: number;
  lastRefreshedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SegmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSegment, setNewSegment] = useState<{
    name: string;
    description: string;
    type: "dynamic" | "static";
    refreshStrategy: string;
  }>({ 
    name: "", 
    description: "",
    type: "dynamic",
    refreshStrategy: "hourly"
  });

  const queryClient = useQueryClient();

  const { data: segmentsData, isLoading } = useQuery<{ segments: Segment[]; total: number }>({
    queryKey: ["/api/automation/segments", typeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (searchQuery) params.append("search", searchQuery);
      const res = await fetch(`/api/automation/segments?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch segments");
      return res.json();
    }
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/automation/segments/stats"],
    queryFn: async () => {
      const res = await fetch("/api/automation/segments/stats", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newSegment) => {
      const res = await fetch("/api/automation/segments", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ruleGroup: { logic: 'AND', rules: [] }
        })
      });
      if (!res.ok) throw new Error("Failed to create segment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/segments"] });
      setIsCreateOpen(false);
      setNewSegment({ name: "", description: "", type: "dynamic", refreshStrategy: "hourly" });
      toast.success("Segment created successfully");
    },
    onError: () => toast.error("Failed to create segment")
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automation/segments/${id}/refresh`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to refresh segment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/segments"] });
      toast.success("Segment refreshed");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automation/segments/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete segment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/segments"] });
      toast.success("Segment deleted");
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automation/segments/${id}/duplicate`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to duplicate segment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/segments"] });
      toast.success("Segment duplicated");
    }
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'dynamic':
        return <Badge className="bg-blue-100 text-blue-800">Dynamic</Badge>;
      default:
        return <Badge variant="secondary">Static</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'computing':
        return <Badge className="bg-yellow-100 text-yellow-800">Computing</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const getUsageCount = (segment: Segment) => {
    return segment.usedInTriggers + segment.usedInFlows + segment.usedInCampaigns;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-500" />
              User Segments
            </h1>
            <p className="text-gray-500 mt-1">Create and manage dynamic user groups for targeting</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Segment</DialogTitle>
                <DialogDescription>Define a new user segment for targeting</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Segment Name</Label>
                  <Input
                    placeholder="e.g., Active Subscribers"
                    value={newSegment.name}
                    onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe this segment..."
                    value={newSegment.description}
                    onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newSegment.type}
                    onValueChange={(value: 'dynamic' | 'static') => setNewSegment({ ...newSegment, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dynamic">Dynamic (auto-updates)</SelectItem>
                      <SelectItem value="static">Static (manual members)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newSegment.type === 'dynamic' && (
                  <div className="space-y-2">
                    <Label>Refresh Strategy</Label>
                    <Select
                      value={newSegment.refreshStrategy}
                      onValueChange={(value) => setNewSegment({ ...newSegment, refreshStrategy: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate(newSegment)} disabled={!newSegment.name}>
                  Create Segment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalSegments || 0}</div>
                  <div className="text-sm text-gray-500">Total Segments</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Filter className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.dynamicSegments || 0}</div>
                  <div className="text-sm text-gray-500">Dynamic</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
                  <div className="text-sm text-gray-500">Total Members</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.avgMembersPerSegment || 0}</div>
                  <div className="text-sm text-gray-500">Avg Members</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Segments</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search segments..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="dynamic">Dynamic</SelectItem>
                    <SelectItem value="static">Static</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Used In</TableHead>
                  <TableHead>Last Refresh</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentsData?.segments?.map((segment) => (
                  <TableRow key={segment._id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{segment.name}</div>
                        {segment.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{segment.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(segment.type)}</TableCell>
                    <TableCell>{getStatusBadge(segment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span>{segment.memberCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {segment.usedInTriggers > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {segment.usedInTriggers}
                          </Badge>
                        )}
                        {segment.usedInFlows > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {segment.usedInFlows}
                          </Badge>
                        )}
                        {segment.usedInCampaigns > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {segment.usedInCampaigns}
                          </Badge>
                        )}
                        {getUsageCount(segment) === 0 && (
                          <span className="text-gray-400 text-sm">Not used</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {segment.lastRefreshedAt 
                        ? new Date(segment.lastRefreshedAt).toLocaleString()
                        : "Never"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {segment.type === 'dynamic' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refreshMutation.mutate(segment._id)}
                            disabled={segment.status === 'computing'}
                          >
                            <RefreshCw className={`h-4 w-4 ${segment.status === 'computing' ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateMutation.mutate(segment._id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(segment._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!segmentsData?.segments || segmentsData.segments.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No segments found</p>
                      <p className="text-sm">Create your first segment to start targeting users</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
