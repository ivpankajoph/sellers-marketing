import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Send, 
  Inbox, 
  Users, 
  Bot, 
  RefreshCw,
  CreditCard
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// Mock AI agents
const AI_AGENTS = [
  { id: 'arohi', name: 'Arohi', color: 'bg-purple-100 text-purple-800' },
  { id: 'kabir', name: 'Kabir', color: 'bg-blue-100 text-blue-800' },
  { id: 'zara', name: 'Zara', color: 'bg-pink-100 text-pink-800' },
];

// Types
interface UsageMetrics {
  whatsappCredits: {
    total: number;
    used: number;
    remaining: number;
  };
  messages: {
    sent: number;
    received: number;
  };
  conversations: {
    total: number;
    byAgent: Record<string, number>;
  };
}

export default function AiUsageDashboard() {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Simulate API fetch (replace with real endpoint)
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // In real app: const res = await fetch('/api/usage/metrics', { headers: getAuthHeaders() });
      // For demo, use mock data that changes slightly each time
      const mockData: UsageMetrics = {
        whatsappCredits: {
          total: 10000,
          used: Math.floor(Math.random() * 3000) + 2000, // Random between 2000–5000
          remaining: 0, // calculated below
        },
        messages: {
          sent: Math.floor(Math.random() * 1500) + 800,
          received: Math.floor(Math.random() * 1200) + 600,
        },
        conversations: {
          total: Math.floor(Math.random() * 20) + 10,
          byAgent: {
            arohi: Math.floor(Math.random() * 8) + 3,
            kabir: Math.floor(Math.random() * 6) + 2,
            zara: Math.floor(Math.random() * 5) + 1,
          },
        },
      };
      mockData.whatsappCredits.remaining = 
        mockData.whatsappCredits.total - mockData.whatsappCredits.used;

      setMetrics(mockData);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch metrics', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(); // Initial load
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-100 rounded-xl"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const usagePercent = metrics
    ? Math.round((metrics.whatsappCredits.used / metrics.whatsappCredits.total) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AI & WhatsApp Usage</h1>
            <p className="text-gray-500 mt-1">
              Real-time overview of your credits, messages, and AI conversations
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Credits Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">WhatsApp Credits</CardTitle>
              <CardDescription>Remaining out of total purchased</CardDescription>
            </div>
            <CreditCard className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total</span>
                <span className="font-medium">₹{metrics?.whatsappCredits.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Used</span>
                <span className="font-medium">₹{metrics?.whatsappCredits.used.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Remaining</span>
                <span className="font-bold text-green-600">
                  ₹{metrics?.whatsappCredits.remaining.toLocaleString()}
                </span>
              </div>
              <Progress value={usagePercent} className="h-2" />
              <div className="text-right text-xs text-gray-500">
                Updated: {lastUpdated}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Send className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg font-semibold">Messages Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {metrics?.messages.sent.toLocaleString()}
              </div>
              <p className="text-sm text-gray-500 mt-1">Outgoing messages via WhatsApp</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Inbox className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg font-semibold">Messages Received</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {metrics?.messages.received.toLocaleString()}
              </div>
              <p className="text-sm text-gray-500 mt-1">Incoming messages from customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg font-semibold">Total Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {metrics?.conversations.total}
              </div>
              <p className="text-sm text-gray-500 mt-1">Active conversation threads</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Agent Conversations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-600" />
              <CardTitle>AI Agent Conversations</CardTitle>
            </div>
            <CardDescription>
              Active chats with your AI assistants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {AI_AGENTS.map(agent => {
                const count = metrics?.conversations.byAgent[agent.id] || 0;
                return (
                  <div key={agent.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${agent.color}`}>
                        {agent.name.charAt(0)}
                      </div>
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1">
                      {count} active
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Info Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>All data refreshes automatically every 5 seconds</p>
          <p className="mt-1">
            Credits are consumed per message sent via WhatsApp Business API
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}