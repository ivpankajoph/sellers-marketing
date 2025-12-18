import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bot, Trash2, Edit, Plus, Play, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SelectGroup, SelectLabel } from "@radix-ui/react-select";

interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mapping from UI brand name to actual model strings
const MODEL_BRAND_MAP: { [key: string]: string } = {
  "gpt-4o": "boomer",
  "gpt-4o-mini": "boomer",
  "gpt-4-turbo": "boomer",
  "gpt-3.5-turbo": "boomer",
  "gemini-2.5-flash": "kaaya",
  "gemini-2.5-pro": "kaaya",
  "gemini-1.5-flash": "kaaya",
  "gemini-1.5-pro": "kaaya",
  // Creeper uses same models as Kaaya (Gemini), just rebranded
  "creeper-2.5-flash": "gemini-2.5-flash",
  "creeper-2.5-pro": "gemini-2.5-pro",
  "creeper-1.5-flash": "gemini-1.5-flash",
  "creeper-1.5-pro": "gemini-1.5-pro",
};

// Reverse map for internal model → brand display
const INTERNAL_TO_BRAND: { [key: string]: string } = {
  "gpt-4o": "Boomer",
  "gpt-4o-mini": "Boomer",
  "gpt-4-turbo": "Boomer",
  "gpt-3.5-turbo": "Boomer",
  "gemini-2.5-flash": "Kaaya",
  "gemini-2.5-pro": "Kaaya",
  "gemini-1.5-flash": "Kaaya",
  "gemini-1.5-pro": "Kaaya",
  // Creeper is not an internal model, so we handle display separately
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingAgent, setTestingAgent] = useState<Agent | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    model: "gpt-4o",
    temperature: 0.7,
    isActive: true,
  });

  const getModelDisplayName = (model: string): string => {
    const modelNames: { [key: string]: string } = {
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      "gpt-4-turbo": "GPT-4 Turbo",
      "gpt-3.5-turbo": "GPT-3.5",
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.5-pro": "Gemini 2.5 Pro",
      "gemini-1.5-flash": "Gemini 1.5 Flash",
      "gemini-1.5-pro": "Gemini 1.5 Pro",
      "creeper-2.5-flash": "Creeper 2.5 Flash",
      "creeper-2.5-pro": "Creeper 2.5 Pro",
      "creeper-1.5-flash": "Creeper 1.5 Flash",
      "creeper-1.5-pro": "Creeper 1.5 Pro",
    };
    return modelNames[model] || model;
  };

  const getBrandFromModel = (model: string): string => {
    // Handle Creeper models: they start with "creeper-"
    if (model.startsWith("creeper-")) {
      return "Creeper";
    }
    const internalModel = MODEL_BRAND_MAP[model] ? model : Object.keys(MODEL_BRAND_MAP).find(key => MODEL_BRAND_MAP[key] === model);
    if (internalModel && internalModel.startsWith("gemini-")) return "Kaaya";
    if (internalModel && internalModel.startsWith("gpt-")) return "Boomer";
    // Fallback
    if (model.startsWith("gemini-")) return "Kaaya";
    if (model.startsWith("gpt-")) return "Boomer";
    return "Unknown";
  };

  const getProviderFromModel = (model: string): 'openai' | 'gemini' => {
    // Creeper models are Gemini under the hood
    if (model.startsWith("creeper-")) {
      return "gemini";
    }
    return model.startsWith("gemini-") ? "gemini" : "openai";
  };

  const getDefaultModelForProvider = (provider: 'openai' | 'gemini'): string => {
    return provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o";
  };

  const getDefaultModelForBrand = (brand: string): string => {
    switch (brand) {
      case "Boomer":
        return "gpt-4o";
      case "Kaaya":
        return "gemini-2.5-flash";
      case "Creeper":
        return "creeper-2.5-flash"; // UI default
      default:
        return "gpt-4o";
    }
  };

  const switchAgentToBrand = async (agent: Agent, brand: string) => {
    const model = getDefaultModelForBrand(brand);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (response.ok) {
        const updated = await response.json();
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
        toast({ 
          title: "Agent Updated", 
          description: `${agent.name} now uses ${brand}.` 
        });
      } else {
        toast({ title: "Error", description: "Failed to switch brand.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to switch brand.", variant: "destructive" });
    }
  };

  const switchAllAgentsToBrand = async (brand: string) => {
    const model = getDefaultModelForBrand(brand);
    try {
      const updatePromises = agents.map(agent => 
        fetch(`/api/agents/${agent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
        })
      );
      
      await Promise.all(updatePromises);
      await fetchAgents();
      
      toast({ 
        title: "All Agents Updated", 
        description: `All agents now use ${brand}.` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update agents.", variant: "destructive" });
    }
  };

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      systemPrompt: "",
      model: "gpt-4o",
      temperature: 0.7,
      isActive: true,
    });
    setEditingAgent(null);
  };

  const openEditDialog = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      temperature: agent.temperature,
      isActive: agent.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.systemPrompt) {
      toast({
        title: "Missing Fields",
        description: "Name and system prompt are required.",
        variant: "destructive",
      });
      return;
    }

    // Map Creeper model back to actual Gemini model before sending to backend
    let actualModel = formData.model;
    if (formData.model.startsWith("creeper-")) {
      actualModel = formData.model.replace("creeper-", "gemini-");
    }

    try {
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : "/api/agents";
      const method = editingAgent ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, model: actualModel }),
      });

      if (response.ok) {
        const agent = await response.json();
        // Restore display model (with creeper prefix if needed) for UI consistency
        const displayModel = agent.model.startsWith("gemini-") && formData.model.startsWith("creeper-")
          ? agent.model.replace("gemini-", "creeper-")
          : agent.model;

        const agentForUI = { ...agent, model: displayModel };

        if (editingAgent) {
          setAgents((prev) => prev.map((a) => (a.id === agent.id ? agentForUI : a)));
          toast({ title: "Agent Updated", description: `${agent.name} has been updated.` });
        } else {
          setAgents((prev) => [...prev, agentForUI]);
          toast({ title: "Agent Created", description: `${agent.name} has been created.` });
        }
        setDialogOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to save agent.", variant: "destructive" });
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const response = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (response.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
        toast({ title: "Agent Deleted", description: "The agent has been removed." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete agent.", variant: "destructive" });
    }
  };

  const toggleAgent = async (agent: Agent) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });

      if (response.ok) {
        const updated = await response.json();
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? updated : a)));
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update agent.", variant: "destructive" });
    }
  };

  const testAgent = async () => {
    if (!testingAgent || !testMessage) return;

    // Use actual model (not creeper-prefixed) for backend
    const actualModel = testingAgent.model.startsWith("creeper-")
      ? testingAgent.model.replace("creeper-", "gemini-")
      : testingAgent.model;

    setTesting(true);
    setTestResponse("");
    try {
      const response = await fetch(`/api/agents/${testingAgent.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage, model: actualModel }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResponse(data.response);
      } else {
        const error = await response.json();
        setTestResponse(`Error: ${error.error}`);
      }
    } catch (error) {
      setTestResponse("Error: Failed to test agent.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">AI Agents</h2>
            <p className="text-muted-foreground">Create and manage AI agents for automated responses</p>
          </div>
          <div className="flex items-center gap-2">
            {agents.length > 0 && (
              <div className="flex items-center gap-1 mr-2" title="Quick switch uses default models.">
                <span className="text-sm text-muted-foreground mr-1">Switch All:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchAllAgentsToBrand('Boomer')}
                  className="text-xs"
                  title="Switch all agents to Boomer (OpenAI)"
                >
                  Boomer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchAllAgentsToBrand('Kaaya')}
                  className="text-xs"
                  title="Switch all agents to Kaaya (Gemini)"
                >
                  Kaaya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchAllAgentsToBrand('Creeper')}
                  className="text-xs"
                  title="Switch all agents to Creeper (Deepseek)"
                >
                  Creeper
                </Button>
              </div>
            )}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingAgent ? "Edit Agent" : "Create New Agent"}</DialogTitle>
                  <DialogDescription>
                    Configure your AI agent's behavior and personality.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid cols-1 gap-4">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="e.g., Support Bot"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>AI Brand</Label>
                      <Select
                        value={getBrandFromModel(formData.model)}
                        onValueChange={(brand) => {
                          setFormData((prev) => ({
                            ...prev,
                            model: getDefaultModelForBrand(brand),
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Boomer">Boomer (OpenAI)</SelectItem>
                          <SelectItem value="Kaaya">Kaaya (Gemini)</SelectItem>
                          <SelectItem value="Creeper">Creeper (Deepseek)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>AI Model</Label>
                      <Select
                        value={formData.model}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, model: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Boomer */}
                          <SelectGroup>
                            <SelectLabel>Boomer (OpenAI)</SelectLabel>
                            <SelectItem value="gpt-4o">GPT-4o (Most Intelligent)</SelectItem>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Smart & Fast)</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Premium)</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 (Economy)</SelectItem>
                          </SelectGroup>

                          {/* Kaaya */}
                          <SelectGroup>
                            <SelectLabel>Kaaya (Gemini)</SelectLabel>
                            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Efficient)</SelectItem>
                            <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Advanced)</SelectItem>
                            <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Budget)</SelectItem>
                            <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Multimodal)</SelectItem>
                          </SelectGroup>

                          {/* Creeper */}
                          <SelectGroup>
                            <SelectLabel>Creeper (Gemini)</SelectLabel>
                            <SelectItem value="creeper-2.5-flash">Creeper 2.5 Flash (Fast & Efficient)</SelectItem>
                            <SelectItem value="creeper-2.5-pro">Creeper 2.5 Pro (Advanced)</SelectItem>
                            <SelectItem value="creeper-1.5-flash">Creeper 1.5 Flash (Budget)</SelectItem>
                            <SelectItem value="creeper-1.5-pro">Creeper 1.5 Pro (Multimodal)</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Boomer uses your OpenAI API key. Kaaya & Creeper use your Google API key.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Brief description of this agent"
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>System Prompt</Label>
                    <Textarea
                      className="min-h-[150px] font-mono text-sm"
                      placeholder="You are a helpful assistant..."
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Temperature: {formData.temperature}</Label>
                    <Slider
                      value={[formData.temperature]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower values make responses more focused, higher values more creative.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit}>
                    {editingAgent ? "Update Agent" : "Create Agent"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Active Agents
            </CardTitle>
            <CardDescription>
              Your AI agents that can respond to WhatsApp messages automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No agents created yet. Click "New Agent" to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-primary" />
                          {agent.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {["Boomer", "Kaaya", "Creeper"].map((brand) => (
                            <Button
                              key={brand}
                              variant={getBrandFromModel(agent.model) === brand ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => switchAgentToBrand(agent, brand)}
                              title={`Switch to ${brand}`}
                            >
                              {brand}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getModelDisplayName(agent.model)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={agent.isActive}
                            onCheckedChange={() => toggleAgent(agent)}
                          />
                          <Badge variant={agent.isActive ? "default" : "secondary"}>
                            {agent.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setTestingAgent(agent);
                            setTestDialogOpen(true);
                            setTestMessage("");
                            setTestResponse("");
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(agent)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteAgent(agent.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Test Agent: {testingAgent?.name}</DialogTitle>
              <DialogDescription>
                Send a test message to see how this agent responds.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 min-h-[150px] max-h-[300px] overflow-auto">
                {testResponse ? (
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm text-sm whitespace-pre-wrap">
                      {testResponse}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Send a message to see the agent's response
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a test message..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && testAgent()}
                />
                <Button onClick={testAgent} disabled={testing || !testMessage}>
                  {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}