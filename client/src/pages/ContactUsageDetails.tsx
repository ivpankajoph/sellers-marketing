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

// Credits configuration - Update these with actual values from your system
const TOTAL_WHATSAPP_CREDITS = 5000;
const TOTAL_AI_TOKENS = 200000;

// Pricing
const WHATSAPP_COST_PER_MESSAGE = 0.85; // ₹0.85 per message

// Simple counter animation hook
const useCountAnimation = (target: number, duration: number = 1000) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();
    const increment = target / (duration / 16);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const current = Math.min(Math.floor((elapsed / duration) * target), target);
      setValue(current);
      if (current < target) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
};

// Static AI token usage (as per your input)
const STATIC_AI_TOKENS = {
  total: 30411,
  outbound: 1313,
  inbound: 29098,
};

// Pricing: ₹500 per 100,000 tokens
const TOKEN_RATE_PER_UNIT = 500 / 100000; // ₹0.005 per token
const aiTokenCost = Math.round(STATIC_AI_TOKENS.total * TOKEN_RATE_PER_UNIT); // ₹152

const FILTER_OPTIONS = [
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
];

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

  // Animated message values
  const animatedTotalMsg = useCountAnimation(stats?.totalMessages || 0);
  const animatedSentMsg = useCountAnimation(stats?.outboundMessages || 0);
  const animatedReceivedMsg = useCountAnimation(stats?.inboundMessages || 0);
  const animatedTotalTok = useCountAnimation(stats?.totalTokens || STATIC_AI_TOKENS.total);
  const animatedSentTok = useCountAnimation(stats?.outboundTokens || STATIC_AI_TOKENS.outbound);
  const animatedReceivedTok = useCountAnimation(stats?.inboundTokens || STATIC_AI_TOKENS.inbound);

  // Messages are billed at ₹0.85 each
  const totalMessageCost = ((stats?.totalMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);
  const sentMessageCost = ((stats?.outboundMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);
  const receivedMessageCost = ((stats?.inboundMessages || 0) * WHATSAPP_COST_PER_MESSAGE).toFixed(2);

  // Calculate remaining credits
  const usedWhatsAppCredits = stats?.totalMessages || 0;
  const remainingWhatsAppCredits = Math.max(0, TOTAL_WHATSAPP_CREDITS - usedWhatsAppCredits);
  const whatsappUsagePercentage = Math.min(100, (usedWhatsAppCredits / TOTAL_WHATSAPP_CREDITS) * 100);

  const usedAITokens = stats?.totalTokens || STATIC_AI_TOKENS.total;
  const remainingAITokens = Math.max(0, TOTAL_AI_TOKENS - usedAITokens);
  const aiTokenUsagePercentage = Math.min(100, (usedAITokens / TOTAL_AI_TOKENS) * 100);

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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* WhatsApp Credits Overview */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                WhatsApp Credits
              </CardTitle>
              <CardDescription>Track your message credit usage (₹0.85 per message)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{TOTAL_WHATSAPP_CREDITS.toLocaleString()}</div>
                  <div className="text-xs text-gray-600 mt-1">Total Credits</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{usedWhatsAppCredits.toLocaleString()}</div>
                  <div className="text-xs text-gray-600 mt-1">Used</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{remainingWhatsAppCredits.toLocaleString()}</div>
                  <div className="text-xs text-gray-600 mt-1">Remaining</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Usage</span>
                  <span className="font-semibold">{whatsappUsagePercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${whatsappUsagePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost per message</span>
                  <span className="font-semibold">₹0.85</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Total cost</span>
                  <span className="text-lg font-bold text-blue-600">₹{totalMessageCost}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Tokens Overview */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                AI Tokens
              </CardTitle>
              <CardDescription>Track your AI token consumption</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{(TOTAL_AI_TOKENS / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-gray-600 mt-1">Total Tokens</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{(usedAITokens / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-gray-600 mt-1">Used</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{(remainingAITokens / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-gray-600 mt-1">Remaining</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Usage</span>
                  <span className="font-semibold">{aiTokenUsagePercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${aiTokenUsagePercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rate</span>
                  <span className="font-semibold">₹500 / 100K tokens</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Total cost</span>
                  <span className="text-lg font-bold text-purple-600">₹{aiTokenCost.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Message Breakdown</CardTitle>
              <CardDescription>Detailed message statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-gray-800">{animatedTotalMsg}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Send className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-blue-700">{animatedSentMsg}</div>
                  <div className="text-xs text-gray-500">Sent</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Inbox className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-green-700">{animatedReceivedMsg}</div>
                  <div className="text-xs text-gray-500">Received</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tokens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Token Breakdown</CardTitle>
              <CardDescription>Detailed token usage statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Hash className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-gray-800">{animatedTotalTok.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <Send className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-purple-700">{animatedSentTok.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Outbound</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <Inbox className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-xl font-bold text-amber-700">{animatedReceivedTok.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Inbound</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Summary - Consolidated */}
        <Card className="border-2 border-green-200">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Billing Summary</CardTitle>
            <CardDescription>Complete cost breakdown for the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* WhatsApp Billing */}
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-700 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Messages
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sent Messages</span>
                    <span>₹{sentMessageCost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Received Messages</span>
                    <span>₹{receivedMessageCost}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Subtotal</span>
                    <span className="text-blue-600">₹{totalMessageCost}</span>
                  </div>
                </div>
              </div>

              {/* AI Token Billing */}
              <div className="space-y-3">
                <h3 className="font-semibold text-purple-700 flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Tokens
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tokens Used</span>
                    <span>{STATIC_AI_TOKENS.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Rate</span>
                    <span>₹500 / 100K</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Subtotal</span>
                    <span className="text-purple-600">₹{aiTokenCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="mt-6 pt-4 border-t-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total Cost</span>
                <span className="text-3xl font-bold text-green-600">
                  ₹{(parseFloat(totalMessageCost) + aiTokenCost).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Data reflects usage for filter: <strong>{FILTER_OPTIONS.find(f => f.value === filter)?.label}</strong></p>
          <p className="mt-1">Auto-refreshes every 10 seconds.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}