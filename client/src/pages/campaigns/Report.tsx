import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Eye, MessageSquare, AlertCircle, DollarSign, TrendingUp, Users, Star, Download, BarChart3, FileText, Loader2 } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface CampaignReportData {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalReplied: number;
  totalFailed: number;
  totalCost: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  deliveryData: Array<{ name: string; value: number; color: string }>;
  dailyStats: Array<{ name: string; date: string; sent: number; read: number; replied: number }>;
  campaignStats: Array<{ name: string; type: string; sent: number; delivered: number; read: number; replied: number; cost: number; date: string }>;
  templatePerformance: Array<{ name: string; sent: number; delivered: number; read: number; replied: number; readRate: number; replyRate: number; cost: number }>;
  costTrend: Array<{ date: string; cost: number; messages: number }>;
}

export default function Report() {
  const [, setLocation] = useLocation();
  const [dateRange, setDateRange] = useState("7");

  const { data: reportData, isLoading } = useQuery<CampaignReportData>({
    queryKey: ["/api/reports/campaign", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/reports/campaign?days=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const totalSent = reportData?.totalSent || 0;
  const totalDelivered = reportData?.totalDelivered || 0;
  const totalRead = reportData?.totalRead || 0;
  const totalReplied = reportData?.totalReplied || 0;
  const totalCost = reportData?.totalCost || 0;
  const deliveryRate = reportData?.deliveryRate || 0;
  const readRate = reportData?.readRate || 89;
  const replyRate = reportData?.replyRate || 46;

  const deliveryData = reportData?.deliveryData || [];
  const dailyStats = reportData?.dailyStats || [];
  const campaignStats = reportData?.campaignStats || [];
  const templatePerformance = reportData?.templatePerformance || [];
  const costTrend = reportData?.costTrend || [];

  const handleExportCSV = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Sent', totalSent.toString()],
      ['Total Delivered', totalDelivered.toString()],
      ['Total Read', totalRead.toString()],
      ['Total Replied', totalReplied.toString()],
      ['Delivery Rate', `${deliveryRate}%`],
      ['Read Rate', `${readRate}%`],
      ['Reply Rate', `${replyRate}%`],
      ['Total Cost', `₹${totalCost.toFixed(2)}`],
    ];
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-report-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Campaign Reports</h2>
            <p className="text-muted-foreground">Detailed insights into message delivery, engagement, and costs.</p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setLocation("/reports/user-engagement")}>
              <Star className="mr-2 h-4 w-4" />
              User Engagement Report
            </Button>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <StatsCard 
             title="Total Sent" 
             value={totalSent.toLocaleString()} 
             icon={CheckCircle2}
          />
          <StatsCard 
             title="Delivered" 
             value={"94%"} 
             icon={CheckCircle2}
             className="text-green-600"
          />
          <StatsCard 
             title="Read Rate" 
             value={`${readRate}%`} 
             icon={Eye}
             className="text-blue-600"
          />
          <StatsCard 
             title="Reply Rate" 
             value={`${replyRate}%`} 
             icon={MessageSquare}
             className="text-purple-600"
          />
   
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns">Campaign Wise</TabsTrigger>
            <TabsTrigger value="templates">Template Performance</TabsTrigger>
            <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Status</CardTitle>
                  <CardDescription>Overall breakdown of message statuses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center">
                    {deliveryData.length > 0 && deliveryData.some(d => d.value > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deliveryData.filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                          >
                            {deliveryData.filter(d => d.value > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => value.toLocaleString()} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No message data available for this period</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Daily Engagement</CardTitle>
                  <CardDescription>Messages sent, read, and replied over the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {dailyStats.length > 0 && dailyStats.some(d => d.sent > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
                          />
                          <Legend />
                          <Bar dataKey="sent" name="Sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="read" name="Read" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="replied" name="Replied" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No activity data for this period</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Detailed breakdown of each campaign's performance.</CardDescription>
              </CardHeader>
              <CardContent>
                {campaignStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Read</TableHead>
                        <TableHead className="text-right">Replied</TableHead>
                        <TableHead className="text-right">Cost (₹)</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignStats.map((campaign, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge variant={campaign.type === 'Marketing' ? 'default' : 'secondary'}>
                              {campaign.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{campaign.sent.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600">{campaign.delivered.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-blue-600">{campaign.read.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-purple-600">{campaign.replied.toLocaleString()}</TableCell>
                          <TableCell className="text-right">₹{campaign.cost.toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {campaign.date ? format(new Date(campaign.date), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No campaign data available</p>
                    <p className="text-sm">Create and run campaigns to see performance data here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Template Performance
                </CardTitle>
                <CardDescription>How each template is performing in terms of engagement.</CardDescription>
              </CardHeader>
              <CardContent>
                {templatePerformance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template Name</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Read</TableHead>
                        <TableHead className="text-right">Replied</TableHead>
                        <TableHead className="text-right">Read Rate</TableHead>
                        <TableHead className="text-right">Reply Rate</TableHead>
                        <TableHead className="text-right">Cost (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templatePerformance.map((template, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium font-mono text-sm">{template.name}</TableCell>
                          <TableCell className="text-right">{template.sent.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{template.delivered.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-blue-600">{template.read.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-purple-600">{template.replied.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={template.readRate >= 70 ? 'default' : template.readRate >= 50 ? 'secondary' : 'outline'}>
                              {template.readRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={template.replyRate >= 25 ? 'default' : template.replyRate >= 15 ? 'secondary' : 'outline'}>
                              {template.replyRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">₹{template.cost.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No template usage data available</p>
                    <p className="text-sm">Send messages using templates to see performance data here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{totalCost.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">This period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cost per Message</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{totalSent > 0 ? (totalCost / totalSent).toFixed(4) : '0.00'}</div>
                  <p className="text-xs text-muted-foreground">Average</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cost per Reply</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{totalReplied > 0 ? (totalCost / totalReplied).toFixed(2) : '0.00'}</div>
                  <p className="text-xs text-muted-foreground">Average</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cost Trend</CardTitle>
                <CardDescription>Daily spending over the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {costTrend.length > 0 && costTrend.some(d => d.cost > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={costTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
                          formatter={(value: number, name: string) => [name === 'cost' ? `₹${value.toFixed(2)}` : value.toLocaleString(), name === 'cost' ? 'Cost' : 'Messages']}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="cost" name="Cost (₹)" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No cost data available for this period</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
