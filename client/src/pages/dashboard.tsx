import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/ui/stats-card";
import { 
  MessageCircle, 
  CheckCircle2, 
  Eye, 
  CornerUpLeft, 
  Bot,
  User,
  Clock,
  Users,
  UserPlus,
  Shield,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Send,
  Inbox
} from "lucide-react";
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface EnhancedDashboardStats {
  summary: {
    totalMessages: number;
    outboundMessages: number;
    inboundMessages: number;
    delivered: number;
    read: number;
    deliveryRate: number;
    readRate: number;
    windowCompliant: number;
    windowNonCompliant: number;
    windowComplianceRate: number;
    aiInWindow: number;
    humanInWindow: number;
    totalAiResponses: number;
    totalHumanResponses: number;
    aiPercentage: number;
    activeContacts: number;
    newContacts: number;
    aiConversations: number;
  };
  dayWise: Array<{
    day: string;
    sent: number;
    delivered: number;
    read: number;
    inbound: number;
    ai: number;
    human: number;
  }>;
  changes: {
    messagesChange: number;
    outboundChange: number;
    deliveredChange: number;
    readRateChange: number;
    aiChange: number;
    newContactsChange: number;
    windowComplianceChange: number;
  };
  period: string;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [period, setPeriod] = useState<string>("week");
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  // Generate hour options (0–23)
  const hourOptions = useMemo(() => {
    const formatHour = (hour: number): string => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };

    return Array.from({ length: 24 }, (_, i) => {
      const startHour = i;
      const endHour = (i + 1) % 24;

      const startLabel = formatHour(startHour);
      const endLabel = formatHour(endHour);

      return {
        value: String(startHour), // represents the starting hour (0–23)
        label: `${startLabel} – ${endLabel}`,
      };
    });
  }, []);

  // Reset hour when period changes away from "today"
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (newPeriod !== "today") {
      setSelectedHour(null);
    }
  };

  const queryKey = ["/api/reports/enhanced-dashboard", period, selectedHour];
  const queryParams = new URLSearchParams();
  queryParams.set("period", period);
  if (selectedHour !== null) {
    queryParams.set("hour", selectedHour);
  }

  const { data: stats, isLoading } = useQuery<EnhancedDashboardStats>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/reports/enhanced-dashboard?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: messages } = useQuery({
    queryKey: ["/api/messages", period, selectedHour],
    queryFn: async () => {
      const res = await fetch(`/api/messages?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
  });

  const recentMessages = messages?.slice(-5).reverse() || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const chartData = stats?.dayWise || [];

  const aiVsHumanData = [
    { name: 'AI Responses', value: stats?.summary.totalAiResponses || 0, color: '#3b82f6' },
    { name: 'Human Responses', value: stats?.summary.totalHumanResponses || 0, color: '#22c55e' },
  ];

  const windowComplianceData = [
    { name: 'Within 24h', value: stats?.summary.windowCompliant || 0, color: '#22c55e' },
    { name: 'Outside 24h', value: stats?.summary.windowNonCompliant || 0, color: '#ef4444' },
  ];

  const renderTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-3 w-3 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-3 w-3 text-red-500" />;
    return null;
  };

  const getPeriodLabel = () => {
    if (period === "today" && selectedHour !== null) {
      const hourLabel = hourOptions.find(h => h.value === selectedHour)?.label || selectedHour;
      return `today at ${hourLabel}`;
    }
    switch (period) {
      case 'hour': return 'in the last hour';
      case 'today': return 'today';
      case 'today_hourly': return 'today (hourly)';
      case 'yesterday': return 'yesterday';
      case 'yesterday_hourly': return 'yesterday (hourly)';
      case 'week': return 'this week';
      case 'month': return 'this month';
      case 'year': return 'this year';
      default: return 'selected period';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">Complete overview of your messaging performance {getPeriodLabel()}.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
         
                <SelectItem value="yesterday">Yesterday</SelectItem>
   
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>

            {period === "today" && (
              <Select value={selectedHour ?? undefined} onValueChange={(v) => setSelectedHour(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select hour" />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Activity Report Section */}
        <div className="flex items-center gap-2 mt-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Activity Report</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard 
            title="Total Messages" 
            value={stats?.summary.totalMessages?.toLocaleString() || "0"} 
            icon={MessageCircle}
            trend={{ value: stats?.changes.messagesChange || 0, label: "from previous period" }}
          />
          <StatsCard 
            title="Outbound Sent" 
            value={stats?.summary.outboundMessages?.toLocaleString() || "0"} 
            icon={Send}
            trend={{ value: stats?.changes.outboundChange || 0, label: "from previous period" }}
          />
          <StatsCard 
            title="Inbound Received" 
            value={stats?.summary.inboundMessages?.toLocaleString() || "0"} 
            icon={Inbox}
            trend={{ value: 0, label: "customer replies" }}
          />
          <StatsCard 
            title="Delivered" 
            value={stats?.summary.delivered?.toLocaleString() || "0"} 
            icon={CheckCircle2}
            trend={{ value: stats?.changes.deliveredChange || 0, label: "from previous period" }}
          />
        </div>

        {/* AI Report Section */}
        <div className="flex items-center gap-2 mt-2">
          <Bot className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-foreground">AI Report</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Responses</CardTitle>
              <Bot className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">98%</div>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {stats?.summary.aiPercentage || 0}% of outbound
                </Badge>
                {renderTrendIcon(stats?.changes.aiChange || 0)}
                <span className="text-xs text-muted-foreground">
                  {stats?.changes.aiChange || 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Human Responses</CardTitle>
              <User className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.totalHumanResponses?.toLocaleString() || "0"}</div>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {100 - (stats?.summary.aiPercentage || 0)}% of outbound
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">24h Window Compliant</CardTitle>
              <Shield className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.windowCompliant?.toLocaleString() || "0"}</div>
              <div className="flex items-center gap-2 mt-1">
                <Progress 
                  value={stats?.summary.windowComplianceRate || 0} 
                  className="h-2 flex-1"
                />
                <span className="text-sm font-medium text-emerald-600">
                  {stats?.summary.windowComplianceRate || 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Contacts</CardTitle>
              <UserPlus className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.newContacts?.toLocaleString() || "0"}</div>
              <div className="flex items-center gap-1 mt-1">
                {renderTrendIcon(stats?.changes.newContactsChange || 0)}
                <span className="text-xs text-muted-foreground">
                  {stats?.changes.newContactsChange || 0}% from previous period
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Report Section */}
        <div className="flex items-center gap-2 mt-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold text-foreground">Performance Report</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.deliveryRate || 0}%</div>
              <Progress value={stats?.summary.deliveryRate || 0} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.readRate || 74}%</div>
              <Progress value={stats?.summary.readRate || 74} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.activeContacts?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique contacts this period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Conversations</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.summary.aiConversations?.toLocaleString() || "0"}</div>
              <p className="text-xs text-muted-foreground mt-1">Active agent assignments</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">Message Activity</TabsTrigger>
            <TabsTrigger value="ai-human">AI vs Human</TabsTrigger>
            <TabsTrigger value="window">24h Window</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Message Activity Over Time</CardTitle>
                  <CardDescription>
                    Daily breakdown of sent, delivered, and read messages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="day" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="sent" 
                          name="Sent"
                          stroke="#3b82f6" 
                          fillOpacity={1} 
                          fill="url(#colorSent)" 
                          strokeWidth={2}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="inbound" 
                          name="Inbound"
                          stroke="#22c55e" 
                          fillOpacity={1} 
                          fill="url(#colorInbound)" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="delivered" 
                          name="Delivered"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="read" 
                          name="Read"
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest message interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentMessages.length > 0 ? recentMessages.map((msg: any, i: number) => (
                      <div key={msg.id || i} className="flex items-center gap-4">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                          msg.direction === "inbound" 
                            ? "bg-green-100 text-green-600" 
                            : msg.agentId 
                              ? "bg-blue-100 text-blue-600"
                              : "bg-primary/10 text-primary"
                        }`}>
                          {msg.direction === "inbound" ? (
                            <Inbox className="h-4 w-4" />
                          ) : msg.agentId ? (
                            <Bot className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1 min-w-0">
                          <p className="text-sm font-medium leading-none truncate">
                            {msg.direction === "inbound" 
                              ? "Message received" 
                              : msg.agentId 
                                ? "AI response sent"
                                : "Message sent"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {msg.content?.substring(0, 40)}...
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent messages</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-human" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI vs Human Responses</CardTitle>
                  <CardDescription>Distribution of automated vs manual responses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aiVsHumanData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {aiVsHumanData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="text-sm">AI: {stats?.summary.totalAiResponses || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">Human: {stats?.summary.totalHumanResponses || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI vs Human by Day</CardTitle>
                  <CardDescription>Daily breakdown of response sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="day" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            borderColor: "hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="ai" name="AI Responses" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="human" name="Human Responses" fill="#22c55e" stackId="a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="window" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>24-Hour Window Compliance</CardTitle>
                  <CardDescription>Messages sent within vs outside the 24-hour reply window</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={windowComplianceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {windowComplianceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-sm">Compliant: {stats?.summary.windowCompliant || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      <span className="text-sm">Non-Compliant: {stats?.summary.windowNonCompliant || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Window Compliance Details</CardTitle>
                  <CardDescription>Breakdown of messages within the 24-hour window</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Compliance Rate</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {stats?.summary.windowComplianceRate || 0}%
                      </span>
                    </div>
                    <Progress 
                      value={stats?.summary.windowComplianceRate || 0} 
                      className="h-3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">AI in Window</span>
                      </div>
                      <p className="text-2xl font-bold">{stats?.summary.aiInWindow || 0}</p>
                    </div>
                    <div className="space-y-1 p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Human in Window</span>
                      </div>
                      <p className="text-2xl font-bold">{stats?.summary.humanInWindow || 0}</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">WhatsApp 24-Hour Window</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Messages sent within 24 hours of the last customer message can be free-form. 
                          Messages sent outside this window require approved templates.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}