import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, MessageSquare, Clock, FileText, TrendingUp } from "lucide-react";

// Pricing constants (₹500 per 100,000 tokens)
const TOKEN_PRICE_PER_LAKH = 500;
const TOKEN_PRICE_PER_TOKEN = TOKEN_PRICE_PER_LAKH / 100000;

interface Agent {
  id: string;
  name: string;
  model: string;
  chatsHandled: number;
  messagesGenerated: number;
  avgResponseTime: string;
  avgResponseTimeMs: number;
  isActive: boolean;
  temperature: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface DailyTokenUsage {
  date: string;
  tokens: number;
}

interface AgentPerformanceData {
  agents: Agent[];
  summary: {
    totalAgents: number;
    activeAgents: number;
    totalChats: number;
    totalMessages: number;
    avgResponseTime: string;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
  dailyTokenUsage: DailyTokenUsage[];
  period: string;
}

const formatNumber = (num: number): string => {
  if (!num || num <= 0) return "0";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
};

const formatINR = (amount: number): string => {
  return `₹${(amount || 0).toFixed(2)}`;
};

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getModelBadge = (model: string) => {
  if (model?.startsWith("gemini")) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Kaaya
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
      Boomer
    </Badge>
  );
};

// ✅ STATIC MOCK DATA BASED ON YOUR INPUT
const mockData: AgentPerformanceData = {
  period: "month",
  summary: {
    totalAgents: 2,
    activeAgents: 2,
    totalChats: 395, // 369 + 26
    totalMessages: 1975, // (369*5) + (26*5)
    avgResponseTime: "1.2s",
    totalTokens: 158000, // 147,600 + 10,400
    inputTokens: 79000,
    outputTokens: 79000,
  },
  dailyTokenUsage: [
    { date: "2025-12-11", tokens: 18000 },
    { date: "2025-12-12", tokens: 22000 },
    { date: "2025-12-13", tokens: 25000 },
    { date: "2025-12-14", tokens: 15000 },
    { date: "2025-12-15", tokens: 20000 },
    { date: "2025-12-16", tokens: 28000 },
    { date: "2025-12-17", tokens: 30000 },
  ],
  agents: [
    {
      id: "agent-1",
      name: "Arohi",
      model: "gpt -4o",
      chatsHandled: 369,
      messagesGenerated: 1845,
      avgResponseTime: "1.1s",
      avgResponseTimeMs: 1100,
      isActive: true,
      temperature: 0.7,
      inputTokens: 73800,
      outputTokens: 73800,
      totalTokens: 147600,
    },
    {
      id: "agent-2",
      name: "Follow-up",
      model: "gpt-4o",
      chatsHandled: 26,
      messagesGenerated: 130,
      avgResponseTime: "1.4s",
      avgResponseTimeMs: 1400,
      isActive: true,
      temperature: 0.5,
      inputTokens: 5200,
      outputTokens: 5200,
      totalTokens: 10400,
    },
  ],
};

export default function AgentPerformance() {
  const [period, setPeriod] = useState("month");

  // Use static mock data — no API call
  const data = mockData;

  const totalCost = (data.summary.totalTokens ?? 0) * TOKEN_PRICE_PER_TOKEN;
  const dailyTokenUsage = data.dailyTokenUsage ?? [];
  const maxTokens = dailyTokenUsage.length
    ? Math.max(...dailyTokenUsage.map((d) => d.tokens))
    : 1;
  const summary = data.summary;
  const agents = data.agents;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              AI Agent Performance
            </h2>
            <p className="text-muted-foreground">
              Monitor token usage, cost, and agent efficiency.
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Render UI with static data */}
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Total Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalAgents}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.activeAgents} active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chats Handled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary.totalChats)}</div>
                <p className="text-xs text-muted-foreground">Unique conversations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Total Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(summary.totalTokens)}</div>
                <p className="text-xs text-muted-foreground">Input + Output</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Est. Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatINR(totalCost)}</div>
                <p className="text-xs text-muted-foreground">Based on ₹500 / 1L tokens</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Token Usage Chart */}
          {dailyTokenUsage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Daily Token Usage</CardTitle>
                <CardDescription>Token consumption over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {dailyTokenUsage.map((day, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <div className="text-[10px] text-muted-foreground mb-1">
                          {formatDateLabel(day.date)}
                        </div>
                        <div
                          className="w-full bg-primary/10 rounded-t"
                          style={{
                            height: `${Math.max(20, (day.tokens / maxTokens) * 100)}px`,
                          }}
                        />
                        <div className="text-[10px] mt-1 font-medium">
                          {formatNumber(day.tokens)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Agent Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Leaderboard</CardTitle>
              <CardDescription>
                Top performing AI agents this{" "}
                {["today", "yesterday"].includes(period) ? "day" : period}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-center">Chats</TableHead>
                      <TableHead className="text-center">Messages</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Avg Response</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => {
                      const agentCost = (agent.totalTokens ?? 0) * TOKEN_PRICE_PER_TOKEN;
                      return (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {agent.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{agent.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Temp: {agent.temperature}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getModelBadge(agent.model)}
                              <span className="text-xs text-muted-foreground">
                                {agent.model || "unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-lg font-semibold">
                              {formatNumber(agent.chatsHandled ?? 0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-lg font-semibold">
                              {formatNumber(agent.messagesGenerated ?? 0)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm">
                              <div>{formatNumber(agent.totalTokens ?? 0)}</div>
                              <div className="text-[10px] text-muted-foreground">
                                in: {formatNumber(agent.inputTokens ?? 0)} | out:{" "}
                                {formatNumber(agent.outputTokens ?? 0)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{formatINR(agentCost)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{agent.avgResponseTime || "—s"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={agent.isActive ? "default" : "secondary"}>
                              {agent.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No AI agents found. Create your first agent to see performance data.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      </div>
    </DashboardLayout>
  );
}