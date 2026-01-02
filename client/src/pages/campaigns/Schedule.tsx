
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Calendar, Clock, Plus, PauseCircle, PlayCircle, Trash2, Loader2, FileSpreadsheet, Bot, MessageSquare, FileText, RefreshCw, X, BarChart2, PieChart, TrendingUp, Users, CheckCircle, AlertTriangle, Info, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

// Chart components
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

interface ScheduledMessage {
  id: string;
  name: string;
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  customMessage?: string;
  agentId?: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

interface ScheduledBroadcast {
  id: string;
  campaignName: string;
  messageType: "template" | "custom" | "ai_agent";
  templateName?: string;
  customMessage?: string;
  agentId?: string;
  contacts: Array<{ name: string; phone: string }>;
  scheduledAt: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled";
  createdAt: string;
  sentCount?: number;
  failedCount?: number;
}

interface Template {
  id: string;
  name: string;
  content: string;
  status: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface ImportedContact {
  name: string;
  phone: string;
  email?: string;
}

// Define statistics interface
interface CampaignStats {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  successRate: number;
  failureRate: number;
  averageRecipientsPerCampaign: number;
  recentCampaigns: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
}

export default function Schedule() {
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [messageType, setMessageType] = useState<"template" | "custom" | "ai_agent">("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [importedContacts, setImportedContacts] = useState<ImportedContact[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  // State for report view
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "analytics">("overview");

  // Fetch data
  const { data: schedules = [], isLoading } = useQuery<ScheduledMessage[]>({
    queryKey: ["/api/broadcast/schedules"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/schedules");
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return res.json();
    },
  });

  const { data: scheduledBroadcasts = [], isLoading: isLoadingBroadcasts, refetch: refetchBroadcasts } = useQuery<ScheduledBroadcast[]>({
    queryKey: ["/api/broadcast/scheduled-broadcasts"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/scheduled-broadcasts");
      if (!res.ok) throw new Error("Failed to fetch scheduled broadcasts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const approvedTemplates = templates.filter(t => t.status === "approved");
  const activeAgents = agents.filter(a => a.isActive);

  // Calculate statistics
  const calculateStats = (): CampaignStats => {
    const allCampaigns = [...schedules, ...scheduledBroadcasts];
    
    const totalCampaigns = allCampaigns.length;
    const totalSent = allCampaigns.reduce((sum, campaign) => sum + (campaign.sentCount || 0), 0);
    const totalFailed = allCampaigns.reduce((sum, campaign) => sum + (campaign.failedCount || 0), 0);
    const totalDelivered = totalSent; // Assuming sent = delivered in this context
    
    const completedCampaigns = allCampaigns.filter(campaign => 
      campaign.status === 'sent' || campaign.status === 'failed' || campaign.status === 'cancelled'
    ).length;
    
    const scheduledCampaigns = allCampaigns.filter(campaign => 
      campaign.status === 'scheduled' || campaign.status === 'sending'
    ).length;
    
    const recentCampaigns = allCampaigns.filter(campaign => {
      const createdAt = new Date(campaign.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7; // Last 7 days
    }).length;
    
    const successRate = totalCampaigns > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 0;
    const failureRate = totalCampaigns > 0 ? (totalFailed / (totalSent + totalFailed)) * 100 : 0;
    const averageRecipientsPerCampaign = totalCampaigns > 0 ? 
      allCampaigns.reduce((sum, campaign) => {
        const recipientCount = 'recipientCount' in campaign ? campaign.recipientCount : (campaign.contacts?.length || 0);
        return sum + recipientCount;
      }, 0) / totalCampaigns : 0;
    
    return {
      totalCampaigns,
      totalSent,
      totalDelivered,
      totalFailed,
      successRate,
      failureRate,
      averageRecipientsPerCampaign,
      recentCampaigns,
      scheduledCampaigns,
      completedCampaigns
    };
  };

  const stats = calculateStats();

  // Data for charts
  const campaignStatusData = [
    { name: 'Scheduled', value: stats.scheduledCampaigns, fill: '#3b82f6' },
    { name: 'Completed', value: stats.completedCampaigns, fill: '#10b981' },
    { name: 'Failed', value: schedules.filter(s => s.status === 'failed').length + scheduledBroadcasts.filter(b => b.status === 'failed').length, fill: '#ef4444' },
  ];

  const messageTypesData = [
    { name: 'Template', value: [...schedules, ...scheduledBroadcasts].filter(c => c.messageType === 'template').length, fill: '#8b5cf6' },
    { name: 'Custom', value: [...schedules, ...scheduledBroadcasts].filter(c => c.messageType === 'custom').length, fill: '#f59e0b' },
    { name: 'AI Agent', value: [...schedules, ...scheduledBroadcasts].filter(c => c.messageType === 'ai_agent').length, fill: '#10b981' },
  ];

  const dailyStatsData = [
    { date: 'Mon', sent: 12, failed: 2 },
    { date: 'Tue', sent: 8, failed: 1 },
    { date: 'Wed', sent: 15, failed: 3 },
    { date: 'Thu', sent: 10, failed: 2 },
    { date: 'Fri', sent: 20, failed: 4 },
    { date: 'Sat', sent: 5, failed: 1 },
    { date: 'Sun', sent: 7, failed: 1 },
  ];

  const importExcelMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/broadcast/import-excel", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to import file");
      return res.json();
    },
    onSuccess: (data) => {
      setImportedContacts(data.contacts);
      toast.success(`Imported ${data.validContacts} contacts`);
    },
    onError: () => {
      toast.error("Failed to import file");
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/broadcast/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/schedules"] });
      toast.success("Schedule created successfully");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Failed to create schedule");
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/broadcast/schedules/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/schedules"] });
      toast.success("Schedule deleted");
    },
    onError: () => {
      toast.error("Failed to delete schedule");
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/broadcast/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/schedules"] });
      toast.success("Schedule updated");
    },
    onError: () => {
      toast.error("Failed to update schedule");
    },
  });

  const cancelScheduledBroadcastMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/broadcast/scheduled-broadcasts/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to cancel scheduled broadcast");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/scheduled-broadcasts"] });
      toast.success("Scheduled broadcast cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel scheduled broadcast");
    },
  });

  const deleteScheduledBroadcastMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/broadcast/scheduled-broadcasts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete scheduled broadcast");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/scheduled-broadcasts"] });
      toast.success("Scheduled broadcast deleted");
    },
    onError: () => {
      toast.error("Failed to delete scheduled broadcast");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importExcelMutation.mutate(file);
    }
  };

  const handleCloseDialog = () => {
    setShowNewSchedule(false);
    setScheduleName("");
    setScheduleTime("");
    setMessageType("template");
    setSelectedTemplateId("");
    setSelectedAgentId("");
    setCustomMessage("");
    setImportedContacts([]);
  };

  const handleCreateSchedule = () => {
    if (!scheduleName.trim()) {
      toast.error("Please enter a schedule name");
      return;
    }

    if (!scheduleTime) {
      toast.error("Please select a schedule time");
      return;
    }

    if (importedContacts.length === 0) {
      toast.error("Please import contacts from Excel/CSV");
      return;
    }

    if (messageType === "template" && !selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    if (messageType === "custom" && !customMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (messageType === "ai_agent" && !selectedAgentId) {
      toast.error("Please select an AI agent");
      return;
    }

    createScheduleMutation.mutate({
      name: scheduleName,
      messageType,
      templateName: messageType === "template" ? (templates.find(t => t.id === selectedTemplateId)?.name || "hello_world") : undefined,
      customMessage: messageType === "custom" ? customMessage : undefined,
      agentId: messageType === "ai_agent" ? selectedAgentId : undefined,
      scheduledAt: scheduleTime,
      recipientCount: importedContacts.length,
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    sending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Schedule Messages</h2>
            <p className="text-muted-foreground">Manage your upcoming scheduled campaigns and view performance metrics.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetchBroadcasts()}
              disabled={isLoadingBroadcasts}
            >
              {isLoadingBroadcasts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
            <Dialog open={showNewSchedule} onOpenChange={setShowNewSchedule}>
              <DialogTrigger asChild>
                {/* <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Schedule
                </Button> */}
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Scheduled Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>Campaign Name *</Label>
                    <Input
                      placeholder="e.g., Weekly Newsletter"
                      value={scheduleName}
                      onChange={(e) => setScheduleName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Schedule Time *</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Import Contacts *</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importExcelMutation.isPending}
                    >
                      {importExcelMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                      )}
                      Upload Excel/CSV
                    </Button>
                    {importedContacts.length > 0 && (
                      <p className="text-sm text-green-600">
                        {importedContacts.length} contacts imported
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Message Type</Label>
                    <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                      <TabsList className="w-full">
                        <TabsTrigger value="template" className="flex-1">
                          <FileText className="mr-1 h-4 w-4" />
                          Template
                        </TabsTrigger>
                        <TabsTrigger value="custom" className="flex-1">
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Custom
                        </TabsTrigger>
                        <TabsTrigger value="ai_agent" className="flex-1">
                          <Bot className="mr-1 h-4 w-4" />
                          AI Agent
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="template" className="mt-4">
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hello_world">hello_world (Default)</SelectItem>
                            {approvedTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TabsContent>

                      <TabsContent value="custom" className="mt-4">
                        <Textarea
                          placeholder="Type your message..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </TabsContent>

                      <TabsContent value="ai_agent" className="mt-4">
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an AI agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {activeAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSchedule}
                    disabled={createScheduleMutation.isPending}
                  >
                    {createScheduleMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Schedule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground">
                {stats.recentCampaigns} in last 7 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSent}</div>
              <p className="text-xs text-muted-foreground">
                Success rate: {stats.successRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages Failed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFailed}</div>
              <p className="text-xs text-muted-foreground">
                Failure rate: {stats.failureRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Recipients</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.averageRecipientsPerCampaign)}</div>
              <p className="text-xs text-muted-foreground">
                Per campaign
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5" />
                Campaign Status Distribution
              </CardTitle>
              <CardDescription>Breakdown of campaign statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={campaignStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {campaignStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Message Types
              </CardTitle>
              <CardDescription>Distribution by message type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={messageTypesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Daily Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AreaChart className="h-5 w-5" />
              Weekly Performance
            </CardTitle>
            <CardDescription>Messages sent and failed over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyStatsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="sent" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Scheduled Broadcasts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Broadcasts
            </CardTitle>
            <CardDescription>
              Broadcasts scheduled from the Broadcast page. These will be sent automatically at the scheduled time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingBroadcasts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : scheduledBroadcasts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No scheduled broadcasts</p>
                <p className="text-sm">Go to Broadcast page and schedule a message to see it here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledBroadcasts
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map((broadcast) => {
                      const scheduledDate = new Date(broadcast.scheduledAt);
                      const isPast = scheduledDate <= new Date();
                      
                      return (
                        <TableRow key={broadcast.id}>
                          <TableCell className="font-medium">{broadcast.campaignName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {broadcast.messageType === "template" && <FileText className="mr-1 h-3 w-3" />}
                              {broadcast.messageType === "custom" && <MessageSquare className="mr-1 h-3 w-3" />}
                              {broadcast.messageType === "ai_agent" && <Bot className="mr-1 h-3 w-3" />}
                              {broadcast.messageType === "template" 
                                ? broadcast.templateName || "hello_world"
                                : broadcast.messageType === "custom"
                                  ? "Custom"
                                  : "AI Agent"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className={isPast && broadcast.status === "scheduled" ? "text-amber-600 dark:text-amber-400" : ""}>
                                {formatDateTime(broadcast.scheduledAt)}
                                {isPast && broadcast.status === "scheduled" && " (Processing...)"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{broadcast.contacts?.length || 0}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[broadcast.status]}`}>
                              {broadcast.status.charAt(0).toUpperCase() + broadcast.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {broadcast.status === "sent" || broadcast.status === "failed" ? (
                              <span className="text-sm">
                                {broadcast.sentCount || 0} sent, {broadcast.failedCount || 0} failed
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {broadcast.status === "scheduled" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Cancel"
                                  onClick={() => cancelScheduledBroadcastMutation.mutate(broadcast.id)}
                                  disabled={cancelScheduledBroadcastMutation.isPending}
                                >
                                  {cancelScheduledBroadcastMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {(broadcast.status === "sent" || broadcast.status === "failed" || broadcast.status === "cancelled") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  title="Delete"
                                  onClick={() => deleteScheduledBroadcastMutation.mutate(broadcast.id)}
                                  disabled={deleteScheduledBroadcastMutation.isPending}
                                >
                                  {deleteScheduledBroadcastMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Schedules (Legacy) */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedules (Legacy)</CardTitle>
            <CardDescription>View and manage your automated dispatch queue.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scheduled messages. Create one using the "New Schedule" button above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Scheduled Time</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{schedule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {schedule.messageType === "template" && <FileText className="mr-1 h-3 w-3" />}
                          {schedule.messageType === "custom" && <MessageSquare className="mr-1 h-3 w-3" />}
                          {schedule.messageType === "ai_agent" && <Bot className="mr-1 h-3 w-3" />}
                          {schedule.messageType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDateTime(schedule.scheduledAt)}
                        </div>
                      </TableCell>
                      <TableCell>{schedule.recipientCount}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={schedule.status === 'scheduled' ? 'default' : schedule.status === 'sent' ? 'secondary' : 'outline'}
                          className={schedule.status === 'scheduled' ? 'bg-blue-500' : schedule.status === 'sent' ? 'bg-green-500' : ''}
                        >
                          {schedule.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {schedule.status === 'scheduled' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Cancel"
                              onClick={() => updateScheduleMutation.mutate({ id: schedule.id, status: 'cancelled' })}
                            >
                              <PauseCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive" 
                            title="Delete"
                            onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
