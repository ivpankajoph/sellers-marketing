import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Users,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  Search,
  Play,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  MessageSquare,
  Calendar,
  ArrowRight,
  Settings,
  Loader2,
} from "lucide-react";
import { getAuthHeaders } from "@/contexts/AuthContext";

// Updated Contact interface with sourceType
interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  interestStatus?: string;
  interestConfidence?: number;
  lastInterestUpdate?: string;
  lastInboundAt?: string;
  tags?: string[];
  sourceType?: "trigger" | "flow" | "drip_campaign"; // NEW
}

interface InterestLists {
  interested: Contact[];
  notInterested: Contact[];
  neutral: Contact[];
  pending: Contact[];
  stats: {
    total: number;
    interested: number;
    notInterested: number;
    neutral: number;
    pending: number;
  };
}

interface DripCampaign {
  _id: string;
  name: string;
  status: string;
  targetType: string;
  interestTargeting?: {
    targetInterestLevels: string[];
    autoEnroll: boolean;
    enrollOnClassification: boolean;
  };
  metrics: {
    totalEnrolled: number;
    activeContacts: number;
  };
}

interface InterestReport {
  distribution: { status: string; count: number; percentage: number }[];
  timeline: {
    date: string;
    interested: number;
    notInterested: number;
    neutral: number;
  }[];
  conversionRate: number;
  topKeywords: { keyword: string; count: number }[];
  campaignPerformance: {
    campaignId: string;
    name: string;
    enrolled: number;
    converted: number;
  }[];
}

const SOURCE_TYPES = ["trigger", "flow", "drip_campaign"] as const;

export default function InterestLists() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("interested");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [filterSourceType, setFilterSourceType] = useState<string>("all"); // "all", "trigger", etc.

  // Fetch raw users and mock classify them
  const { data: rawUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["api-broadcast-imported-contacts"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/imported-contacts", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Generate mock interest lists from raw users
  const { data: interestLists, isLoading } = useQuery<InterestLists>({
    queryKey: ["mock-interest-lists", rawUsers],
    enabled: !!rawUsers,
    queryFn: () => {
      const users: Contact[] = (rawUsers || []).map((u: any) => ({
        ...u,
        id: u.id || u._id,
        name: u.name || "Unknown",
        phone: u.phone || "N/A",
        // Randomly assign interest status
        interestStatus: ["interested", "notInterested", "neutral", "pending"][
          Math.floor(Math.random() * 4)
        ],
        // Randomly assign sourceType
        sourceType: SOURCE_TYPES[Math.floor(Math.random() * SOURCE_TYPES.length)],
        interestConfidence: Math.random(),
      }));

      const interested = users.filter((u) => u.interestStatus === "interested");
      const notInterested = users.filter((u) => u.interestStatus === "notInterested");
      const neutral = users.filter((u) => u.interestStatus === "neutral");
      const pending = users.filter((u) => u.interestStatus === "pending");

      return {
        interested,
        notInterested,
        neutral,
        pending,
        stats: {
          total: users.length,
          interested: interested.length,
          notInterested: notInterested.length,
          neutral: neutral.length,
          pending: pending.length,
        },
      };
    },
  });

  const { data: campaigns } = useQuery<DripCampaign[]>({
    queryKey: ["/api/automation/drips"],
    queryFn: async () => {
      const res = await fetch("/api/automation/drips", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      return data.campaigns || [];
    },
  });

  const { data: report } = useQuery<InterestReport>({
    queryKey: ["/api/automation/interest/report"],
    queryFn: async () => {
      const res = await fetch("/api/automation/interest/report?days=7", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
  });

  const classifyMutation = useMutation({
    mutationFn: async ({ contactId, status }: { contactId: string; status: string }) => {
      const res = await fetch(`/api/automation/interest/contacts/${contactId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to classify contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/interest/lists"] });
      toast.success("Contact classified successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getContactList = () => {
    if (!interestLists) return [];
    const list =
      interestLists[activeTab as keyof Pick<InterestLists, "interested" | "notInterested" | "neutral" | "pending">] ||
      [];
    return list.filter((contact) => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery);
      const matchesFilter =
        filterSourceType === "all" || contact.sourceType === filterSourceType;
      return matchesSearch && matchesFilter;
    });
  };

  const stats = interestLists?.stats || {
    total: 0,
    interested: 0,
    notInterested: 0,
    neutral: 0,
    pending: 0,
  };

  const tabConfig = [
    { value: "interested", label: "Interested", count: stats.interested, icon: ThumbsUp, color: "text-green-600" },
    {
      value: "notInterested",
      label: "Not Interested",
      count: stats.notInterested,
      icon: ThumbsDown,
      color: "text-red-600",
    },
    { value: "neutral", label: "Neutral", count: stats.neutral, icon: Minus, color: "text-yellow-600" },
    { value: "pending", label: "Pending", count: stats.pending, icon: Clock, color: "text-gray-500" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">AI Intelligence Report</h2>
            <p className="text-muted-foreground">Contacts from 24-hour window classified by interest level</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(true)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Report
            </Button>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["/api/automation/interest/lists"],
                })
              }
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">In 24-hour window</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Interested</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.interested / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Not Interested</CardTitle>
              <ThumbsDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.notInterested}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total > 0 ? Math.round((stats.notInterested / stats.total) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report?.conversionRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Not interested → Interested</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contact Lists</CardTitle>
                <CardDescription>
                  View and manage contacts by interest level. Assign drip campaigns to engage them.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterSourceType} onValueChange={setFilterSourceType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="trigger">Trigger</SelectItem>
                    <SelectItem value="flow">Flow</SelectItem>
                    <SelectItem value="drip_campaign">Drip Campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                {tabConfig.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    <tab.icon className={`h-4 w-4 ${tab.color}`} />
                    {tab.label}
                    <Badge variant="secondary" className="ml-1">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabConfig.map((tab) => (
                <TabsContent key={tab.value} value={tab.value}>
                  {isLoading || isLoadingUsers ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {getContactList().length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            No contacts in this category
                          </div>
                        ) : (
                          getContactList().map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium">{contact.name}</p>
                                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {contact.interestConfidence && (
                                  <Badge variant="outline">
                                    {Math.round(contact.interestConfidence * 100)}% confidence
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="capitalize">
                                  {contact.sourceType?.replace("_", " ") || "Unknown"}
                                </Badge>
                                <Select
                                  value={contact.interestStatus}
                                  onValueChange={(value) =>
                                    classifyMutation.mutate({ contactId: contact.id, status: value })
                                  }
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="interested">
                                      <span className="flex items-center gap-2">
                                        <ThumbsUp className="h-4 w-4 text-green-600" />
                                        Interested
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="not_interested">
                                      <span className="flex items-center gap-2">
                                        <ThumbsDown className="h-4 w-4 text-red-600" />
                                        Not Interested
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="neutral">
                                      <span className="flex items-center gap-2">
                                        <Minus className="h-4 w-4 text-yellow-600" />
                                        Neutral
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Interest-Based Drip Campaigns
              </CardTitle>
              <CardDescription>
                Campaigns targeting contacts by interest level with auto-enrollment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {campaigns?.filter((c) => c.targetType === "interest").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No interest-based campaigns yet</p>
                    <p className="text-sm">
                      Create a drip campaign targeting interested or not interested contacts
                    </p>
                  </div>
                ) : (
                  campaigns
                    ?.filter((c) => c.targetType === "interest")
                    .map((campaign) => (
                      <div key={campaign._id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                              {campaign.status}
                            </Badge>
                            {campaign.interestTargeting?.targetInterestLevels.map((level) => (
                              <Badge key={level} variant="outline" className="capitalize">
                                {level.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{campaign.metrics.totalEnrolled} enrolled</p>
                          <p>{campaign.metrics.activeContacts} active</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Top Interest Keywords
              </CardTitle>
              <CardDescription>Most common keywords that indicate interest level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {report?.topKeywords?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No keywords detected yet</p>
                  </div>
                ) : (
                  report?.topKeywords?.slice(0, 8).map((kw, index) => (
                    <div key={kw.keyword} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}.</span>
                        <Badge variant="outline">{kw.keyword}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{kw.count} times</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Interest Classification Report</DialogTitle>
              <DialogDescription>Last 7 days of interest classification activity</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid gap-4 md:grid-cols-4">
                {report?.distribution?.map((d) => (
                  <Card key={d.status}>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground capitalize">{d.status.replace("_", " ")}</p>
                      <p className="text-2xl font-bold">{d.count}</p>
                      <p className="text-xs text-muted-foreground">{d.percentage}%</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {report?.campaignPerformance?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No campaign data yet</p>
                  ) : (
                    <div className="space-y-3">
                      {report?.campaignPerformance?.map((cp) => (
                        <div
                          key={cp.campaignId}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <span className="font-medium">{cp.name}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span>{cp.enrolled} enrolled</span>
                            <span className="text-green-600">{cp.converted} converted</span>
                            <span className="text-muted-foreground">
                              {cp.enrolled > 0 ? Math.round((cp.converted / cp.enrolled) * 100) : 0}% rate
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}