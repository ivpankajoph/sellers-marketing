import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Play, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

export default function NewAgent() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: "gpt-4o",
    temperature: 0.7,
  });

  const handleCreateAgent = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter an agent name.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.systemPrompt.trim()) {
      toast({
        title: "Missing Instructions",
        description: "Please enter system instructions for your agent.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          isActive: true,
        }),
      });

      if (response.ok) {
        const agent = await response.json();
        setCreatedAgentId(agent.id);
        toast({
          title: "Agent Created!",
          description: `${agent.name} has been created successfully. You can now test it.`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Create Agent",
          description: error.error || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestAgent = async () => {
    if (!createdAgentId) {
      toast({
        title: "No Agent Created",
        description: "Please create an agent first before testing.",
        variant: "destructive",
      });
      return;
    }

    if (!testMessage.trim()) {
      toast({
        title: "Empty Message",
        description: "Please enter a test message.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestResponse("");
    try {
      const response = await fetch(`/api/agents/${createdAgentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResponse(data.response);
      } else {
        const error = await response.json();
        setTestResponse(`Error: ${error.error || "Failed to get response"}`);
      }
    } catch (error) {
      setTestResponse("Error: Failed to connect to server.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">New AI Agent</h2>
          <Button variant="outline" onClick={() => navigate("/ai/agents")}>
            View All Agents
          </Button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>Define how your AI agent should behave.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Agent Name *</Label>
                <Input 
                  placeholder="e.g., Support Bot Level 1" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!!createdAgentId}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input 
                  placeholder="Brief description of this agent" 
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={!!createdAgentId}
                />
              </div>
              <div className="grid gap-2">
                <Label>AI Model</Label>
                <Select
                  value={formData.model}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, model: value }))}
                  disabled={!!createdAgentId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o" className="flex items-center">
                      <span className="font-medium">Boomer GPT-4o</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Most Intelligent)</span>
                    </SelectItem>
                    <SelectItem value="gpt-4o-mini">
                      <span className="font-medium">Boomer GPT-4o Mini</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Smart & Fast)</span>
                    </SelectItem>
                    <SelectItem value="gpt-4-turbo">
                      <span className="font-medium">Boomer GPT-4 Turbo</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Premium)</span>
                    </SelectItem>
                    <SelectItem value="gpt-3.5-turbo">
                      <span className="font-medium">Boomer GPT-3.5</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Economy)</span>
                    </SelectItem>
                    <SelectItem value="gemini-2.5-flash">
                      <span className="font-medium">Kaaya 2.5 Flash</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Fast & Efficient)</span>
                    </SelectItem>
                    <SelectItem value="gemini-2.5-pro">
                      <span className="font-medium">Kaaya 2.5 Pro</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Advanced Reasoning)</span>
                    </SelectItem>
                    <SelectItem value="gemini-1.5-flash">
                      <span className="font-medium">Kaaya 1.5 Flash</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Budget Friendly)</span>
                    </SelectItem>
                    <SelectItem value="gemini-1.5-pro">
                      <span className="font-medium">Kaaya 1.5 Pro</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Multimodal)</span>
                    </SelectItem>
                     <SelectItem value="gemini-1.5-pro">
                      <span className="font-medium">Creeper 1.5 Flash</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Multimodal)</span>
                    </SelectItem>
                     <SelectItem value="gemini-1.5-pro">
                      <span className="font-medium">Creeper 1.5 Pro</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Multimodal)</span>
                    </SelectItem>
                     <SelectItem value="gemini-1.5-pro">
                      <span className="font-medium">Creeper 1.5 Turbo</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Multimodal)</span>
                    </SelectItem>
                     <SelectItem value="gemini-1.5-pro">
                      <span className="font-medium">Creeper Pro Max</span>
                      <span className="ml-2 text-xs text-muted-foreground">(Multimodal)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  OpenAI models require OpenAI API key | Gemini models require Gemini API key
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Temperature: {formData.temperature}</Label>
                <Slider
                  value={[formData.temperature]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
                  disabled={!!createdAgentId}
                />
                <p className="text-xs text-muted-foreground">
                  Lower = more focused, Higher = more creative
                </p>
              </div>
              <div className="grid gap-2">
                <Label>System Instructions *</Label>
                <Textarea 
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="You are a helpful support assistant for Acme Corp. You answer questions about our widgets. If you don't know the answer, politely transfer the chat to a human agent."
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  disabled={!!createdAgentId}
                />
              </div>
              {createdAgentId ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
                    Agent created successfully! You can now test it on the right.
                  </div>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => {
                      setCreatedAgentId(null);
                      setFormData({
                        name: "",
                        description: "",
                        systemPrompt: "",
                        model: "gpt-4o",
                        temperature: 0.7,
                      });
                      setTestMessage("");
                      setTestResponse("");
                    }}
                  >
                    Create Another Agent
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={handleCreateAgent} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Agent"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Test Playground</CardTitle>
              <CardDescription>
                {createdAgentId 
                  ? "Interact with your agent to test the instructions." 
                  : "Create an agent first to test it here."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 bg-muted/50 rounded-md border p-4 mb-4 min-h-[300px] max-h-[400px] overflow-auto">
                {!createdAgentId ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>Create an agent to start testing</p>
                  </div>
                ) : testResponse ? (
                  <div className="space-y-4">
                    <div className="flex gap-2 justify-end">
                      <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[80%] text-sm">
                        {testMessage}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[80%] text-sm whitespace-pre-wrap">
                        {testResponse}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-4">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm max-w-[80%] text-sm">
                      Hello! I am your AI assistant. How can I help you today?
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Type a message..." 
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTestAgent()}
                  disabled={!createdAgentId || testing}
                />
                <Button 
                  size="icon" 
                  onClick={handleTestAgent}
                  disabled={!createdAgentId || testing || !testMessage.trim()}
                >
                  {testing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
