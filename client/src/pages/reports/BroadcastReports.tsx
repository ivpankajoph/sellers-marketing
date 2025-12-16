import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Download, 
  RefreshCw, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Reply,
  ChevronRight,
  ChevronDown,
  Users,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";

interface BroadcastLog {
  id: string;
  campaignName: string;
  contactName: string;
  contactPhone: string;
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  message?: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  messageId?: string;
  error?: string;
  timestamp: string;
  replied?: boolean;
  repliedAt?: string;
}

interface CampaignSummary {
  campaignName: string;
  totalContacts: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  replied: number;
  replyRate: number;
  deliveryRate: number;
  lastSent: string;
  logs: BroadcastLog[];
}

export default function BroadcastReports() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery<BroadcastLog[]>({
    queryKey: ["/api/broadcast/logs"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/logs?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch broadcast logs");
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Group logs by campaign
  const campaigns: CampaignSummary[] = Object.values(
    logs.reduce((acc, log) => {
      const key = log.campaignName;
      if (!acc[key]) {
        acc[key] = {
          campaignName: log.campaignName,
          totalContacts: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          pending: 0,
          replied: 0,
          replyRate: 0,
          deliveryRate: 0,
          lastSent: log.timestamp,
          logs: [],
        };
      }

      acc[key].totalContacts++;
      acc[key].logs.push(log);

      if (log.status === 'sent') acc[key].sent++;
      if (log.status === 'delivered') acc[key].delivered++;
      if (log.status === 'failed') acc[key].failed++;
      if (log.status === 'pending') acc[key].pending++;
      if (log.replied) acc[key].replied++;

      // Update lastSent to most recent
      if (new Date(log.timestamp) > new Date(acc[key].lastSent)) {
        acc[key].lastSent = log.timestamp;
      }

      return acc;
    }, {} as Record<string, CampaignSummary>)
  ).map(campaign => ({
    ...campaign,
    replyRate: campaign.totalContacts > 0 
      ? Math.round((campaign.replied / campaign.totalContacts) * 100) 
      : 0,
    deliveryRate: campaign.totalContacts > 0
      ? Math.round(((campaign.sent + campaign.delivered) / campaign.totalContacts) * 100)
      : 0,
  })).sort((a, b) => new Date(b.lastSent).getTime() - new Date(a.lastSent).getTime());

  const filteredCampaigns = campaigns.filter(campaign => 
    searchQuery === "" || 
    campaign.campaignName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overallStats = {
    totalCampaigns: campaigns.length,
    totalMessages: logs.length,
    totalSent: logs.filter(l => l.status === 'sent').length,
    totalDelivered: logs.filter(l => l.status === 'delivered').length,
    totalFailed: logs.filter(l => l.status === 'failed').length,
    totalReplied: logs.filter(l => l.replied).length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-blue-500"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'delivered':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCampaignCSV = (campaign: CampaignSummary) => {
    const headers = ['Timestamp', 'Contact Name', 'Phone', 'Type', 'Template', 'Status', 'Replied', 'Replied At', 'Message ID', 'Error'];
    const csvContent = [
      headers.join(','),
      ...campaign.logs.map(log => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        `"${log.contactName}"`,
        log.contactPhone,
        log.messageType,
        log.templateName || '',
        log.status,
        log.replied ? 'Yes' : 'No',
        log.repliedAt ? format(new Date(log.repliedAt), 'yyyy-MM-dd HH:mm:ss') : '',
        log.messageId || '',
        `"${log.error || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.campaignName.replace(/[^a-z0-9]/gi, '_')}-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllCSV = () => {
    const headers = ['Campaign', 'Timestamp', 'Contact Name', 'Phone', 'Type', 'Template', 'Status', 'Replied', 'Replied At', 'Message ID', 'Error'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        `"${log.campaignName}"`,
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        `"${log.contactName}"`,
        log.contactPhone,
        log.messageType,
        log.templateName || '',
        log.status,
        log.replied ? 'Yes' : 'No',
        log.repliedAt ? format(new Date(log.repliedAt), 'yyyy-MM-dd HH:mm:ss') : '',
        log.messageId || '',
        `"${log.error || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-broadcasts-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Broadcast Reports</h2>
            <p className="text-muted-foreground">Campaign-wise analysis of your broadcast messages.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExportAllCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCampaigns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalMessages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Read</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{overallStats.totalSent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{overallStats.totalSent}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Replied</CardTitle>
              <Reply className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{overallStats.totalReplied}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overallStats.totalFailed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by campaign name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Campaign List */}
        <Card>
          <CardHeader>
            <CardTitle>Campaigns ({filteredCampaigns.length})</CardTitle>
            <CardDescription>Click on a campaign to view detailed message logs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No campaigns found.</p>
                <p className="text-sm">Send your first broadcast to see campaigns here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => (
                  <div key={campaign.campaignName} className="border rounded-lg overflow-hidden">
                    {/* Campaign Header */}
                    <div 
                      className="p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer flex items-center justify-between"
                      onClick={() => setExpandedCampaign(
                        expandedCampaign === campaign.campaignName ? null : campaign.campaignName
                      )}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {expandedCampaign === campaign.campaignName ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{campaign.campaignName}</h3>
                          <p className="text-sm text-muted-foreground">
                            Last sent: {format(new Date(campaign.lastSent), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Contacts</div>
                          <div className="text-xl font-bold flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.totalContacts}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Delivered</div>
                          <div className="text-xl font-bold text-green-600">{campaign.deliveryRate}%</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-muted-foreground">Replied</div>
                          <div className="text-xl font-bold text-purple-600 flex items-center gap-1">
                            <Reply className="h-4 w-4" />
                            {campaign.replied} ({campaign.replyRate}%)
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportCampaignCSV(campaign);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Campaign Details (Expanded) */}
                    {expandedCampaign === campaign.campaignName && (
                      <div className="p-4 border-t">
                        {/* Stats Row */}
                        <div className="grid grid-cols-5 gap-4 mb-4 p-3 bg-muted/20 rounded-lg">
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Read</div>
                            <div className="text-lg font-bold text-blue-600">{campaign.sent}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Delivered</div>
                            <div className="text-lg font-bold text-green-600">{campaign.delivered}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Failed</div>
                            <div className="text-lg font-bold text-red-600">{campaign.failed}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Pending</div>
                            <div className="text-lg font-bold text-gray-600">{campaign.pending}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm text-muted-foreground">Replied</div>
                            <div className="text-lg font-bold text-purple-600">{campaign.replied}</div>
                          </div>
                        </div>

                        {/* Contact Details Table */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-sm font-medium">Contact</th>
                                  <th className="px-4 py-2 text-left text-sm font-medium">Phone</th>
                                  <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                                  <th className="px-4 py-2 text-left text-sm font-medium">Replied</th>
                                  <th className="px-4 py-2 text-left text-sm font-medium">Timestamp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {campaign.logs.map((log) => (
                                  <tr key={log.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-2 text-sm font-medium">{log.contactName}</td>
                                    <td className="px-4 py-2 text-sm text-muted-foreground">{log.contactPhone}</td>
                                    <td className="px-4 py-2">{getStatusBadge(log.status)}</td>
                                    <td className="px-4 py-2">
                                      {log.replied ? (
                                        <div>
                                          <Badge variant="default" className="bg-purple-500">
                                            <Reply className="h-3 w-3 mr-1" />
                                            Yes
                                          </Badge>
                                          {log.repliedAt && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                              {format(new Date(log.repliedAt), 'MMM d, HH:mm')}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground">No</Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-muted-foreground">
                                      {format(new Date(log.timestamp), 'MMM d, HH:mm')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}