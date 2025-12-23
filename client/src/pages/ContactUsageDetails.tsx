import React, { useState, useEffect } from 'react';
import { Send, Inbox, MessageCircle, RefreshCw, User, Hash, Bot } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Chart components
import {
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Types
interface MessageStats {
  contactId: string;
  filter: string;
  totalMessages: number;
  inboundMessages: number;
  outboundMessages: number;
  totalTokens: number;
  inboundTokens: number;
  outboundTokens: number;
}

// Credits configuration
const TOTAL_WHATSAPP_CREDITS = 5000;
const TOTAL_AI_TOKENS = 200000;

// Pricing
const WHATSAPP_COST_PER_MESSAGE = 0.85; // ₹0.85 per message
const TOKEN_RATE_PER_UNIT = 500 / 100000; // ₹0.005 per token

// Static AI token usage
const STATIC_AI_TOKENS = {
  total: 30411,
  outbound: 1313,
  inbound: 29098,
};

const FILTER_OPTIONS = [
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
];

// Mock time-series data for chart (replace with real API if available)
const generateTokenTimeSeries = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    day,
    tokens: Math.floor(2000 + Math.random() * 3000),
    messages: Math.floor(10 + Math.random() * 20),
  }));
};

const useCountAnimation = (target: number, duration: number = 1000) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(progress * target);
      setValue(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
};

export default function ContactUsageDetail() {
  const CONTACT_ID = '4d460e87-b06f-4c96-ab75-3a484e9a18ad';
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/messages/stats/${CONTACT_ID}?filter=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch message stats');
      const data: MessageStats = await res.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  // Animated values
  const animatedTotalMsg = useCountAnimation(stats?.totalMessages || 0);
  const animatedSentMsg = useCountAnimation(stats?.outboundMessages || 0);
  const animatedReceivedMsg = useCountAnimation(stats?.inboundMessages || 0);
  const animatedTotalTok = useCountAnimation(stats?.totalTokens || STATIC_AI_TOKENS.total);
  const animatedSentTok = useCountAnimation(stats?.outboundTokens || STATIC_AI_TOKENS.outbound);
  const animatedReceivedTok = useCountAnimation(stats?.inboundTokens || STATIC_AI_TOKENS.inbound);

  // Costs
  const totalMessageCost = ((stats?.totalMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);
  const sentMessageCost = ((stats?.outboundMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);
  const receivedMessageCost = ((stats?.inboundMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);
  const aiTokenCost = Math.round((stats?.totalTokens || STATIC_AI_TOKENS.total) * TOKEN_RATE_PER_UNIT);

  // Credit usage
  const usedWhatsAppCredits = stats?.totalMessages || 0;
  const remainingWhatsAppCredits = Math.max(0, TOTAL_WHATSAPP_CREDITS - usedWhatsAppCredits);
  const whatsappUsagePercentage = Math.min(100, (usedWhatsAppCredits / TOTAL_WHATSAPP_CREDITS) * 100);

  const usedAITokens = stats?.totalTokens || STATIC_AI_TOKENS.total;
  const remainingAITokens = Math.max(0, TOTAL_AI_TOKENS - usedAITokens);
  const aiTokenUsagePercentage = Math.min(100, (usedAITokens / TOTAL_AI_TOKENS) * 100);

  // Chart data
  const messageDirectionData = [
    { name: 'Sent', value: animatedSentMsg, color: '#3b82f6' },
    { name: 'Received', value: animatedReceivedMsg, color: '#10b981' },
  ].filter(item => item.value > 0);

  const timeSeriesData = generateTokenTimeSeries();

  if (loading && !stats) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>
              ))}
            </div>
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
            <CardContent className="py-8 text-center">
              <div className="text-red-500 mb-2">⚠️ Error</div>
              <p>{error}</p>
              <Button onClick={fetchStats} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Conversation Usage Details</h1>
            <p className="text-gray-500 mt-1">Message and token analytics for contact</p>
            <Badge variant="secondary" className="mt-2">
              <User className="h-3 w-3 mr-1" />
              {CONTACT_ID}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select filter" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <MessageCircle className="h-5 w-5 text-gray-500 mx-auto" />
              <div className="text-2xl font-bold mt-2">{animatedTotalMsg}</div>
              <div className="text-xs text-gray-500">Total Msgs</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Send className="h-5 w-5 text-blue-600 mx-auto" />
              <div className="text-2xl font-bold mt-2">{animatedSentMsg}</div>
              <div className="text-xs text-gray-500">Sent</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Inbox className="h-5 w-5 text-green-600 mx-auto" />
              <div className="text-2xl font-bold mt-2">{animatedReceivedMsg}</div>
              <div className="text-xs text-gray-500">Received</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Hash className="h-5 w-5 text-gray-500 mx-auto" />
              <div className="text-2xl font-bold mt-2">{(animatedTotalTok / 1000).toFixed(1)}K</div>
              <div className="text-xs text-gray-500">Total Tokens</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Send className="h-5 w-5 text-purple-600 mx-auto" />
              <div className="text-2xl font-bold mt-2">{(animatedSentTok / 1000).toFixed(1)}K</div>
              <div className="text-xs text-gray-500">Out Tokens</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <Inbox className="h-5 w-5 text-amber-600 mx-auto" />
              <div className="text-2xl font-bold mt-2">{(animatedReceivedTok / 1000).toFixed(1)}K</div>
              <div className="text-xs text-gray-500">In Tokens</div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Direction */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Message Direction</CardTitle>
              <CardDescription>Sent vs Received messages</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={messageDirectionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {messageDirectionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Messages']} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Token Usage Over Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Token Usage (Last 7 Days)</CardTitle>
              <CardDescription>Daily token consumption trend</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="day" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="tokens" stroke="#8b5cf6" fill="#c7d2fe" name="Tokens Used" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Wallet & Billing Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-2 border-blue-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                WhatsApp Credits
              </CardTitle>
              <CardDescription>₹0.85 per message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{TOTAL_WHATSAPP_CREDITS}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">{usedWhatsAppCredits}</div>
                  <div className="text-xs text-gray-600">Used</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{remainingWhatsAppCredits}</div>
                  <div className="text-xs text-gray-600">Remaining</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${whatsappUsagePercentage}%` }}
                ></div>
              </div>
              <div className="text-right text-sm">
                Total Cost: <span className="font-bold text-blue-700">₹{totalMessageCost}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                AI Tokens
              </CardTitle>
              <CardDescription>₹500 per 100K tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-700">{(TOTAL_AI_TOKENS / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-700">{(usedAITokens / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-gray-600">Used</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{(remainingAITokens / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-gray-600">Remaining</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${aiTokenUsagePercentage}%` }}
                ></div>
              </div>
              <div className="text-right text-sm">
                Total Cost: <span className="font-bold text-purple-700">₹{aiTokenCost}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Summary */}
        <Card className="border-2 border-gray-100">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Billing Summary</CardTitle>
            <CardDescription>Cost breakdown (INR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-1">
                  <MessageCircle className="h-4 w-4 text-blue-600" /> WhatsApp
                </h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Sent ({animatedSentMsg})</span>
                    <span>₹{sentMessageCost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Received ({animatedReceivedMsg})</span>
                    <span>₹{receivedMessageCost}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Subtotal</span>
                    <span className="text-blue-700">₹{totalMessageCost}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium flex items-center gap-1">
                  <Bot className="h-4 w-4 text-purple-600" /> AI Tokens
                </h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Used Tokens</span>
                    <span>{animatedTotalTok.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate</span>
                    <span>₹500 / 100K</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Subtotal</span>
                    <span className="text-purple-700">₹{aiTokenCost}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-300 flex justify-between items-center">
              <span className="text-lg font-bold">Total Cost</span>
              <span className="text-2xl font-bold text-green-700">
                ₹{(parseFloat(totalMessageCost) + aiTokenCost).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Data for: <strong>{FILTER_OPTIONS.find(f => f.value === filter)?.label}</strong> • Auto-refreshes every 10s</p>
        </div>
      </div>
    </DashboardLayout>
  );
}