import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Phone, User, Loader2, Bot, MessageSquare, FileText } from "lucide-react";
import Swal from "sweetalert2";

// Minimal country list (you can expand as needed)
const countries = [
  { code: "91", label: "+91", name: "India" },
  { code: "1", label: "+1", name: "USA/Canada" },
  { code: "44", label: "+44", name: "UK" },
  { code: "61", label: "+61", name: "Australia" },
  // Add more if needed
];

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

export default function Single() {
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [messageType, setMessageType] = useState<"template" | "custom" | "ai_agent">("template");
  const [countryCode, setCountryCode] = useState("91"); // WhatsApp requires '91', not '+91'

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

  const approvedTemplates = templates.filter(t => t.status === "approved");
  const activeAgents = agents.filter(a => a.isActive);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/broadcast/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        const requestedPhone = String(variables?.phone || "");
        const acceptedPhone = String(result?.phone_number || requestedPhone);
        const messageId = result?.messageId ? `\nMessage ID: ${result.messageId}` : "";
        const mismatch = Boolean(
          requestedPhone &&
            acceptedPhone &&
            requestedPhone.replace(/\D/g, "") !== acceptedPhone.replace(/\D/g, "")
        );

        Swal.fire({
          icon: mismatch ? "warning" : "success",
          title: mismatch ? "Sent to different number" : "Message accepted",
          text: mismatch
            ? `Requested: ${requestedPhone}\nSent to: ${acceptedPhone}${messageId}\n\nPlease verify the number/country code.`
            : `Queued to WhatsApp for ${acceptedPhone}.${messageId}\n\nAccepted does not always mean delivered.`,
        });
        handleClearForm();
      } else {
        Swal.fire({
          icon: "error",
          title: "Sending failed",
          text: result.error || "An unknown error occurred.",
        });
      }
    },
    onError: (error: Error) => {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.message || "Failed to send message.",
      });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.content);
    }
  };

  const handleClearForm = () => {
    setPhone("");
    setRecipientName("");
    setMessage("");
    setSelectedTemplateId("");
    setSelectedAgentId("");
  };

  const handleSendMessage = () => {
    if (!phone.trim()) {
      Swal.fire("Error", "Please enter a phone number", "error");
      return;
    }

    if (messageType === "template" && !selectedTemplateId) {
      Swal.fire("Error", "Please select a template", "error");
      return;
    }

    if (messageType === "custom" && !message.trim()) {
      Swal.fire("Error", "Please enter a message", "error");
      return;
    }

    if (messageType === "ai_agent" && !selectedAgentId) {
      Swal.fire("Error", "Please select an AI agent", "error");
      return;
    }

    // Build E.164-ish number safely and avoid double country-code prefixing
    const phoneDigits = phone.replace(/\D/g, "");
    let normalizedDigits = phoneDigits;
    if (normalizedDigits.startsWith("00")) {
      normalizedDigits = normalizedDigits.slice(2);
    }

    const fullPhoneNumber =
      normalizedDigits.startsWith(countryCode) && normalizedDigits.length > 10
        ? normalizedDigits
        : `${countryCode}${normalizedDigits.startsWith("0") ? normalizedDigits.slice(1) : normalizedDigits}`;

    if (fullPhoneNumber.length < 8 || fullPhoneNumber.length > 15) {
      Swal.fire("Error", "Please enter a valid WhatsApp number", "error");
      return;
    }

    sendMessageMutation.mutate({
      phone: fullPhoneNumber, // e.g., "919876543210"
      name: recipientName,
      messageType,
      templateName: messageType === "template" 
        ? (templates.find(t => t.id === selectedTemplateId)?.name || "hello_world") 
        : undefined,
      customMessage: messageType === "custom" ? message : undefined,
      agentId: messageType === "ai_agent" ? selectedAgentId : undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight">Single Message</h2>
            <p className="text-muted-foreground">Quickly send a message to a specific number.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Send a one-off message without creating a campaign.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Phone Number *</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue>
                        {countries.find(c => c.code === countryCode)?.label || "+91"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.label} ({country.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="98765 43210" 
                      className="pl-9"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label>Recipient Name (Optional)</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Your Name" 
                    className="pl-9"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <Label>Message Type</Label>
                <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="template" className="flex-1">
                      <FileText className="mr-1 h-4 w-4" />
                      Template
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="flex-1">
                      <MessageSquare className="mr-1 h-4 w-4" />
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
                    {selectedTemplateId && selectedTemplateId !== "hello_world" && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{message}</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Message Text</Label>
                      <Textarea 
                        placeholder="Type your message here..." 
                        className="min-h-[150px]"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Note: Custom messages require the recipient to have messaged you first (24-hour window rule).
                      </p>
                    </div>
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
                            <SelectItem value="" disabled>No active agents available</SelectItem>
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
                          The AI agent will generate a personalized welcome message.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6">
              <Button variant="outline" onClick={handleClearForm}>
                Clear Form
              </Button>
              <Button 
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !phone.trim()}
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Now
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
