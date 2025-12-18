import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Loader2, MessageSquare, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface DeliveryReportData {
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  dailyData: Array<{ date: string; fullDate: string; sent: number; delivered: number; read: number; failed: number }>;
  hourlyData: Array<{ hour: string; sent: number; delivered: number }>;
}

export default function DeliveryReport() {
  const [period, setPeriod] = useState("30");

  const { data: reportData, isLoading } = useQuery<DeliveryReportData>({
    queryKey: ["/api/reports/delivery", period],
    queryFn: async () => {
      const res = await fetch(`/api/reports/delivery?days=${period}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const handleExportCSV = () => {
    if (!reportData) return;
    
    const headers = ['Date', 'Sent', 'Delivered', 'Read', 'Failed'];
    const rows = reportData.dailyData.map(d => [
      d.fullDate,
      d.sent.toString(),
      d.delivered.toString(),
      d.read.toString(),
      d.failed.toString(),
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delivery-report-${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
  const delivered = reportData?.delivered || 0;
  const read = reportData?.read || 0;
  const failed = reportData?.failed || 0;
  const deliveryRate = reportData?.deliveryRate || 0;
  const readRate = reportData?.readRate || 0;
  const failureRate = reportData?.failureRate || 0;
  const dailyData = reportData?.dailyData || [];
  const hourlyData = reportData?.hourlyData || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Message Delivery Report</h2>
            <p className="text-muted-foreground">Detailed analysis of message delivery rates over time.</p>
          </div>
          <div className="flex items-center gap-2">
             <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 24 Hours</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                </SelectContent>
             </Select>
             <Button variant="outline" onClick={handleExportCSV}>
               <Download className="mr-2 h-4 w-4" />
               Export CSV
             </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Total Sent</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold">{totalSent.toLocaleString()}</div>
             </CardContent>
           </Card>
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-green-600">{delivered.toLocaleString()}</div>
               <div className="text-xs text-muted-foreground">{deliveryRate}% Delivery Rate</div>
             </CardContent>
           </Card>
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Read</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-blue-600">{read.toLocaleString()}</div>
               <div className="text-xs text-muted-foreground">{readRate}% Read Rate</div>
             </CardContent>
           </Card>
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="text-2xl font-bold text-destructive">{failed.toLocaleString()}</div>
               <div className="text-xs text-muted-foreground">{failureRate}% Failure Rate</div>
             </CardContent>
           </Card>
        </div>

        <Card>
          <CardHeader>
             <CardTitle>Delivery Timeline</CardTitle>
             <CardDescription>Message status trends over the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              {dailyData.length > 0 && dailyData.some(d => d.sent > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="sent" stroke="#8884d8" fillOpacity={1} fill="url(#colorSent)" name="Sent" />
                    <Area type="monotone" dataKey="delivered" stroke="#22c55e" fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
                    <Area type="monotone" dataKey="read" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRead)" name="Read" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No message data available for this period</p>
                    <p className="text-sm">Send messages to see delivery trends here.</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <CardTitle>Hourly Distribution</CardTitle>
             <CardDescription>Message volume by hour of day.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {hourlyData.length > 0 && hourlyData.some(d => d.sent > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
                    />
                    <Legend />
                    <Bar dataKey="sent" name="Sent" fill="#8884d8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delivered" name="Delivered" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hourly data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
