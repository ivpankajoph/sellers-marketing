import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, DollarSign, Calendar, MessageCircle } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

// Hardcoded WhatsApp account
const whatsappAccount = {
  connected: true,
  name: "Life Changing Networks",
  displayPhoneNumber: "+91 98765 43210",
  phoneNumberId: "848441401690739",
  whatsappBusinessAccountId: "3646219455517188",
};

interface TemplateEntry {
  templateName: string;
  sentCount: number;
  cost: number;
}

interface ReportDay {
  date: string;
  totalSent: number;
  totalCost: number;
  templates: TemplateEntry[];
}

interface TemplateReport {
  currency: string;
  costPerTemplate: number;
  grandTotalSent: number;
  grandTotalCost: number;
  data: ReportDay[];
}

const formatINR = (value: number): string => {
  return `₹${value.toFixed(2)}`;
};

const formatDateLabel = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

const formatDateLong = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function Spending() {
  const { data, isLoading, error } = useQuery<TemplateReport>({
    queryKey: ["/api/broadcast/template-report"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/broadcast/template-report");
      if (!res.ok) throw new Error("Failed to fetch template report");
      return res.json();
    },
  });

  // Prepare chart data: one bar per day (total cost)
  const chartData = data?.data
    .map((day) => ({
      date: formatDateLabel(day.date),
      total: parseFloat(day.totalCost.toFixed(2)),
    }))
    .reverse() || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Failed to load template spending data</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600" />
            Template Spending Report
          </h2>
          <p className="text-muted-foreground">
            Track WhatsApp template costs by campaign and date (INR).
          </p>
        </div>

        {/* WhatsApp Account */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg font-medium">Connected WhatsApp</CardTitle>
              <CardDescription>Business account used for billing</CardDescription>
            </div>
            <MessageCircle className="h-6 w-6 text-green-500" />
          </CardHeader>
          <CardContent>
            {whatsappAccount.connected ? (
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Business:</span> {whatsappAccount.name}</p>
                <p><span className="font-medium">Phone:</span> {whatsappAccount.displayPhoneNumber}</p>
              </div>
            ) : (
              <p className="text-muted-foreground italic">No WhatsApp account connected.</p>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Spent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(data?.grandTotalCost ?? 0)}</div>
              <p className="text-xs text-muted-foreground">All campaigns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Total Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.grandTotalSent.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">Across all templates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Days with Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.data.length || 0}</div>
              <p className="text-xs text-muted-foreground">Active sending days</p>
            </CardContent>
          </Card>
        </div>

        {/* Chart: Daily Total Spend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spending Trend</CardTitle>
            <CardDescription>Total cost per day (INR)</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      formatter={(value) => [`₹${Number(value).toFixed(2)}`, "Cost"]}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No data to display</div>
            )}
          </CardContent>
        </Card>

        {/* Campaign (Template) Breakdown by Day */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
            <CardDescription>Template-wise message count and cost per day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {data?.data.map((day, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">{formatDateLong(day.date)}</h3>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="font-bold">{formatINR(day.totalCost)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {day.templates.map((tmpl, i) => (
                    <div key={i} className="flex justify-between items-center pl-2">
                      <Badge variant="secondary">{tmpl.templateName}</Badge>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{tmpl.sentCount} messages</span>
                        <span className="font-medium">{formatINR(tmpl.cost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {(!data || data.data.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No campaign data available.
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          * All costs are in Indian Rupees (₹). Marketing templates billed at ₹{data?.costPerTemplate || 0.85}/message.
        </p>
      </div>
    </DashboardLayout>
  );
}