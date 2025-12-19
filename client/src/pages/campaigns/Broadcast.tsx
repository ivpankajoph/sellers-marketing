import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  Send,
  Users,
  Loader2,
  Check,
  Calendar,
  FileSpreadsheet,
  Bot,
  MessageSquare,
  Plus,
  Search,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { PhonePreview } from "@/components/ui/phone-preview";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
}

interface Template {
  id: string;
  name: string;
  content: string;
  status: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface BroadcastList {
  id: string;
  name: string;
  contacts: Array<{ name: string; phone: string; email?: string }>;
  createdAt: string;
}

interface ImportedContact {
  name: string;
  phone: string;
  email?: string;
}

interface SavedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  source?: string;
}

export default function Broadcast() {
  const [, setLocation] = useLocation();
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [importedContacts, setImportedContacts] = useState<ImportedContact[]>([]);
  const [message, setMessage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [messageType, setMessageType] = useState<"template" | "custom" | "ai_agent">("template");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [showCreateList, setShowCreateList] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: regularContacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const { data: savedImportedContacts = [] } = useQuery<SavedContact[]>({
    queryKey: ["/api/broadcast/imported-contacts"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/imported-contact");
      if (!res.ok) throw new Error("Failed to fetch imported contacts");
      return res.json();
    },
  });

  const contacts: Contact[] = useMemo(
    () => [
      ...regularContacts,
      ...savedImportedContacts.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        tags: c.tags || [],
      })),
    ],
    [regularContacts, savedImportedContacts]
  );

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(q) || contact.phone.includes(searchQuery)
    );
  }, [contacts, searchQuery]);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const { data: broadcastLists = [] } = useQuery<BroadcastList[]>({
    queryKey: ["/api/broadcast/lists"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/lists");
      if (!res.ok) throw new Error("Failed to fetch broadcast lists");
      return res.json();
    },
  });

  const approvedTemplates = templates.filter((t) => t.status === "approved");
  const activeAgents = agents.filter((a) => a.isActive);

  const importExcelMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/broadcast/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import file");
      }
      return data;
    },
    onSuccess: (data) => {
      setImportedContacts(data.contacts);
      if (data.errors && data.errors.length > 0) {
        toast.warning(
          `Imported ${data.validContacts} of ${data.totalRows} rows. ${data.errors.length} rows had issues.`
        );
      } else {
        toast.success(`Successfully imported ${data.validContacts} contacts from ${data.totalRows} rows`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to import file. Check that your file has 'Name' and 'Mobile' columns.");
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (data: { name: string; contacts: ImportedContact[] }) => {
      const res = await fetch("/api/broadcast/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create list");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broadcast/lists"] });
      toast.success("Broadcast list created successfully");
      setShowCreateList(false);
      setNewListName("");
    },
    onError: () => {
      toast.error("Failed to create broadcast list");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importExcelMutation.mutate(file);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "hello_world") {
      setSelectedTemplateName("hello_world");
      setMessage(
        "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta."
      );
    } else {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setSelectedTemplateName(template.name);
        setMessage(template.content);
      }
    }
  };

  const toggleContact = (contactId: string, checked: boolean | "indeterminate") => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedContactIds((prev) => [...prev, contactId]);
    } else {
      setSelectedContactIds((prev) => prev.filter((id) => id !== contactId));
    }
  };

  const selectAllContacts = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  };

  const handleSendBroadcast = async () => {
    // VALIDATION: Campaign name is now REQUIRED
    if (!campaignName.trim()) {
      toast.error("Campaign name is required! Please enter a campaign name.");
      return;
    }

    let targetContacts: Array<{ name: string; phone: string }> = [];

    if (selectedListId) {
      const list = broadcastLists.find((l) => l.id === selectedListId);
      if (list) {
        targetContacts = list.contacts;
      }
    } else if (importedContacts.length > 0) {
      targetContacts = importedContacts;
    } else if (selectedContactIds.length > 0) {
      targetContacts = contacts
        .filter((c) => selectedContactIds.includes(c.id))
        .map((c) => ({ name: c.name, phone: c.phone }));
    }

    if (targetContacts.length === 0) {
      toast.error("Please select contacts or import from Excel");
      return;
    }

    if (messageType === "template" && !selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }

    if (messageType === "custom" && !message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (messageType === "ai_agent" && !selectedAgentId) {
      toast.error("Please select an AI agent");
      return;
    }

    // Handle scheduling validation
    if (isScheduled) {
      if (!scheduledTime) {
        toast.error("Please select a schedule time");
        return;
      }
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();
      if (scheduledDate <= now) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }

    setIsSending(true);
    
    
    try {
      const payload = {
        contacts: targetContacts,
        messageType,
        templateName: messageType === "template" ? selectedTemplateName || "hello_world" : undefined,
        customMessage: messageType === "custom" ? message : undefined,
        agentId: messageType === "ai_agent" ? selectedAgentId : undefined,
        campaignName: campaignName.trim(),
        isScheduled,
        scheduledTime: isScheduled ? new Date(scheduledTime).toISOString() : undefined,
      };

      console.log("📤 Sending broadcast payload:", payload);

      const res = await fetch("/api/broadcast/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      console.log("📥 Broadcast response:", result);

      if (!res.ok) {
        toast.error(result.error || `Failed to send broadcast (${res.status})`);
        setIsSending(false);
        return;
      }

      if (isScheduled) {
        toast.success(`Broadcast scheduled successfully for ${new Date(scheduledTime).toLocaleString()}`);
      } else if (result.failed > 0) {
        toast.warning(`Broadcast partially sent: ${result.successful} successful, ${result.failed} failed`);
      } else {
        toast.success(`Broadcast sent successfully to ${result.successful} contacts`);
      }

      // Reset form
      setSelectedContactIds([]);
      setImportedContacts([]);
      setCampaignName("");
      setSelectedTemplateId("");
      setSelectedTemplateName("");
      setMessage("");
      setIsScheduled(false);
      setScheduledTime("");
      setIsSending(false);
    } catch (error: any) {
      console.error("❌ Broadcast error:", error);
      toast.error(error.message || "Failed to send broadcast");
      setIsSending(false);
    }
  };

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    let listContacts: ImportedContact[] = [];
    if (importedContacts.length > 0) {
      listContacts = importedContacts;
    } else if (selectedContactIds.length > 0) {
      listContacts = contacts
        .filter((c) => selectedContactIds.includes(c.id))
        .map((c) => ({ name: c.name, phone: c.phone }));
    }

    if (listContacts.length === 0) {
      toast.error("No contacts to add to the list");
      return;
    }

    createListMutation.mutate({ name: newListName, contacts: listContacts });
  };

  const totalSelected = selectedListId
    ? broadcastLists.find((l) => l.id === selectedListId)?.contacts.length || 0
    : importedContacts.length > 0
      ? importedContacts.length
      : selectedContactIds.length;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Send Broadcast</h2>
          <p className="text-muted-foreground">Send bulk messages to your contact lists.</p>
        </div>

        {/* CAMPAIGN NAME - NOW REQUIRED */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Campaign name is required</strong> to track and analyze your broadcasts.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>
            Campaign Name <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="e.g., Black Friday Sale, Product Launch 2024"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className={!campaignName.trim() ? "border-red-300 focus-visible:ring-red-500" : ""}
          />
          {!campaignName.trim() && (
            <p className="text-sm text-red-500">Campaign name is required to send broadcasts</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                1. Select Audience
              </CardTitle>
              <CardDescription>
                Choose who will receive this message. Selected: {totalSelected} contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importExcelMutation.isPending}
                >
                  {importExcelMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Import Excel/CSV
                </Button>
                <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      <Plus className="mr-2 h-4 w-4" />
                      Save as List
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Broadcast List</DialogTitle>
                      <DialogDescription>Save selected contacts as a reusable list</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>List Name</Label>
                        <Input
                          placeholder="e.g., VIP Customers"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This will save{" "}
                        {importedContacts.length > 0 ? importedContacts.length : selectedContactIds.length}{" "}
                        contacts to the list.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button type="button" onClick={handleCreateList} disabled={createListMutation.isPending}>
                        {createListMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Create List
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {broadcastLists.length > 0 && (
                <div className="space-y-2">
                  <Label>Or Select Existing List</Label>
                  <Select
                    value={selectedListId}
                    onValueChange={(value) => {
                      setSelectedListId(value);
                      if (value) {
                        setSelectedContactIds([]);
                        setImportedContacts([]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a broadcast list..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None (Select manually)</SelectItem>
                      {broadcastLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.contacts.length} contacts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {importedContacts.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    {importedContacts.length} contacts imported from Excel
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="mt-2 text-xs"
                    onClick={() => setImportedContacts([])}
                  >
                    Clear imported
                  </Button>
                </div>
              )}

              {!selectedListId && importedContacts.length === 0 && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts by name or phone..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" type="button" onClick={selectAllContacts}>
                      {selectedContactIds.length === filteredContacts.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {filteredContacts.length} contacts found
                    </span>
                  </div>

                  <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    {filteredContacts.length > 0 ? (
                      filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            toggleContact(contact.id, !selectedContactIds.includes(contact.id))
                          }
                        >
                          <Checkbox
                            checked={selectedContactIds.includes(contact.id)}
                            onCheckedChange={(checked) =>
                              toggleContact(contact.id, checked === true)
                            }
                          />
                          <div className="flex-1">
                            <div className="font-medium">{contact.name}</div>
                            <div className="text-sm text-muted-foreground">{contact.phone}</div>
                          </div>
                          {selectedContactIds.includes(contact.id) && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        No contacts match your search.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                2. Compose Message
              </CardTitle>
              <CardDescription>
                Select a template, write custom message, or use AI Agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="template" className="flex-1">
                    Template
                  </TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1">
                    Custom
                  </TabsTrigger>
                  <TabsTrigger value="ai_agent" className="flex-1">
                    <Bot className="mr-1 h-4 w-4" />
                    AI Agent
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Template</Label>
                    <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hello_world">hello_world (Default)</SelectItem>
                        {approvedTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplateId && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Smartphone className="h-4 w-4" />
                        Preview: {selectedTemplateName}
                      </div>
                      <PhonePreview
                        body={message}
                        className="py-2"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="custom" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Message Text</Label>
                    <Textarea
                      placeholder="Type your message here... Use {{name}} for personalization"
                      className="min-h-[120px]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Note: Custom messages require the recipient to have messaged you first (24-hour window rule).
                    </p>
                  </div>
                  {message && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Smartphone className="h-4 w-4" />
                        Preview
                      </div>
                      <PhonePreview
                        body={message}
                        className="py-2"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ai_agent" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select AI Agent</Label>
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an AI agent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAgents.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No active agents. Create one first.
                          </SelectItem>
                        ) : (
                          activeAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedAgentId && (
                      <p className="text-sm text-muted-foreground">
                        The AI agent will generate personalized messages for each recipient using the hello_world
                        template.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2 pt-4 border-t">
                <Checkbox
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={(checked) => setIsScheduled(checked === true)}
                />
                <Label htmlFor="schedule" className="cursor-pointer">
                  Schedule for later
                </Label>
              </div>

              {isScheduled && (
                <div className="space-y-2">
                  <Label>Schedule Time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  {scheduledTime && new Date(scheduledTime) <= new Date() && (
                    <p className="text-xs text-red-500">Time must be in the future</p>
                  )}
                </div>
              )}

              <Button 
                className="w-full" 
                type="button" 
                onClick={handleSendBroadcast} 
                disabled={isSending || !campaignName.trim()}
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isScheduled ? (
                  <Calendar className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isSending
                  ? "Processing..."
                  : isScheduled
                    ? "Schedule Broadcast"
                    : `Send to ${totalSelected} Contacts`}
              </Button>
              {!campaignName.trim() && (
                <p className="text-xs text-red-500 text-center">
                  Please enter a campaign name to send
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}