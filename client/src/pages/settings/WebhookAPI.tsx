import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Copy, RefreshCw, Activity, Link as LinkIcon, Loader2, Eye, EyeOff, X, Shield, Key, Bot } from "lucide-react";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface CredentialsStatus {
  hasWhatsApp: boolean;
  hasOpenAI: boolean;
  hasGemini: boolean;
  hasFacebook: boolean;
  isVerified: boolean;
}

interface CredentialsResponse {
  hasCredentials: boolean;
  credentials: Record<string, string> | null;
  status: CredentialsStatus;
  isVerified?: boolean;
  lastVerifiedAt?: string;
}

export default function WebhookAPI() {
  const [showWhatsAppToken, setShowWhatsAppToken] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showFacebookToken, setShowFacebookToken] = useState(false);
  
  const [whatsappToken, setWhatsappToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [facebookAccessToken, setFacebookAccessToken] = useState("");
  const [facebookPageId, setFacebookPageId] = useState("");
  
  const queryClient = useQueryClient();

  const { data: credentialsData, isLoading } = useQuery<CredentialsResponse>({
    queryKey: ["/api/credentials"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/credentials");
      if (!res.ok) throw new Error("Failed to fetch credentials");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      const res = await fetchWithAuth("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error("Failed to save credentials");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      toast.success("Credentials saved and encrypted successfully");
      setWhatsappToken("");
      setPhoneNumberId("");
      setBusinessAccountId("");
      setWebhookVerifyToken("");
      setAppId("");
      setAppSecret("");
      setOpenaiApiKey("");
      setGeminiApiKey("");
      setFacebookAccessToken("");
      setFacebookPageId("");
    },
    onError: () => {
      toast.error("Failed to save credentials");
    },
  });

  const testWhatsAppMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/credentials/test/whatsapp", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Test failed");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/credentials"] });
      toast.success(`WhatsApp connected: ${data.verifiedName || data.phoneNumber}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "WhatsApp connection test failed");
    },
  });

  const testOpenAIMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/credentials/test/openai", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Test failed");
      return data;
    },
    onSuccess: () => {
      toast.success("OpenAI API connection successful");
    },
    onError: (error: Error) => {
      toast.error(error.message || "OpenAI connection test failed");
    },
  });

  const testFacebookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/credentials/test/facebook", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Test failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Facebook connected: ${data.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Facebook connection test failed");
    },
  });

  const handleSaveWhatsApp = () => {
    const credentials: Record<string, string> = {};
    if (whatsappToken) credentials.whatsappToken = whatsappToken;
    if (phoneNumberId) credentials.phoneNumberId = phoneNumberId;
    if (businessAccountId) credentials.businessAccountId = businessAccountId;
    if (webhookVerifyToken) credentials.webhookVerifyToken = webhookVerifyToken;
    if (appId) credentials.appId = appId;
    if (appSecret) credentials.appSecret = appSecret;
    
    if (Object.keys(credentials).length === 0) {
      toast.error("Please enter at least one credential");
      return;
    }
    saveMutation.mutate(credentials);
  };

  const handleSaveOpenAI = () => {
    if (!openaiApiKey) {
      toast.error("Please enter your OpenAI API key");
      return;
    }
    saveMutation.mutate({ openaiApiKey });
  };

  const handleSaveGemini = () => {
    if (!geminiApiKey) {
      toast.error("Please enter your Gemini API key");
      return;
    }
    saveMutation.mutate({ geminiApiKey });
  };

  const handleSaveFacebook = () => {
    const credentials: Record<string, string> = {};
    if (facebookAccessToken) credentials.facebookAccessToken = facebookAccessToken;
    if (facebookPageId) credentials.facebookPageId = facebookPageId;
    
    if (Object.keys(credentials).length === 0) {
      toast.error("Please enter at least one credential");
      return;
    }
    saveMutation.mutate(credentials);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/whatsapp` 
    : '';

  const status = credentialsData?.status || { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
  const maskedCreds = credentialsData?.credentials || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">API Credentials</h2>
            <p className="text-muted-foreground">Securely manage your API keys and webhook configurations.</p>
          </div>
          <div className="flex gap-2">
            {status.hasWhatsApp && (
              <Badge variant={status.isVerified ? "default" : "secondary"} className="gap-1">
                {status.isVerified ? (
                  <><CheckCircle2 className="h-3 w-3" /> WhatsApp Connected</>
                ) : (
                  <><X className="h-3 w-3" /> WhatsApp Not Verified</>
                )}
              </Badge>
            )}
            {status.hasOpenAI && (
              <Badge variant="default" className="gap-1 bg-purple-600">
                <Bot className="h-3 w-3" /> AI Ready
              </Badge>
            )}
          </div>
        </div>

        <Alert className="bg-blue-50 border-blue-200">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Secure Storage</AlertTitle>
          <AlertDescription className="text-blue-700">
            All your API keys are encrypted using AES-256-GCM before being stored. 
            Your credentials are never exposed in plain text after saving.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="whatsapp" className="space-y-4">
          <TabsList>
            <TabsTrigger value="whatsapp" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              WhatsApp API
            </TabsTrigger>
            <TabsTrigger value="openai" className="gap-2">
              <Bot className="h-4 w-4" />
              OpenAI
            </TabsTrigger>
            <TabsTrigger value="gemini" className="gap-2">
              <Bot className="h-4 w-4" />
              Gemini
            </TabsTrigger>
            <TabsTrigger value="facebook" className="gap-2">
              <Key className="h-4 w-4" />
              Facebook
            </TabsTrigger>
            {/* <TabsTrigger value="webhook" className="gap-2">
              <Activity className="h-4 w-4" />
              Webhook
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>WhatsApp Business API</CardTitle>
                    <CardDescription>Connect your WhatsApp Business account</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.hasWhatsApp && maskedCreds.whatsappToken && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                    <p className="text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Credentials saved. Token: {maskedCreds.whatsappToken}
                    </p>
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label>Access Token</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        type={showWhatsAppToken ? "text" : "password"}
                        placeholder={status.hasWhatsApp ? "Enter new token to update..." : "Enter your WhatsApp Access Token"}
                        value={whatsappToken}
                        onChange={(e) => setWhatsappToken(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowWhatsAppToken(!showWhatsAppToken)}
                      >
                        {showWhatsAppToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Phone Number ID</Label>
                    <Input 
                      placeholder={status.hasWhatsApp ? maskedCreds.phoneNumberId || "Enter to update..." : "Phone Number ID"}
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Business Account ID (WABA ID)</Label>
                    <Input 
                      placeholder={status.hasWhatsApp ? maskedCreds.businessAccountId || "Enter to update..." : "WABA ID"}
                      value={businessAccountId}
                      onChange={(e) => setBusinessAccountId(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>App ID</Label>
                    <Input 
                      placeholder={status.hasWhatsApp ? maskedCreds.appId || "Enter to update..." : "Meta App ID"}
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>App Secret</Label>
                    <Input 
                      type="password"
                      placeholder={status.hasWhatsApp ? "Enter to update..." : "Meta App Secret"}
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-muted/50 border-t p-6">
                {/* <Button 
                  variant="outline"
                  onClick={() => testWhatsAppMutation.mutate()}
                  disabled={testWhatsAppMutation.isPending || !status.hasWhatsApp}
                >
                  {testWhatsAppMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button> */}
                <Button 
                  onClick={handleSaveWhatsApp}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & Encrypt
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="openai" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>OpenAI API</CardTitle>
                    <CardDescription>Connect your OpenAI account for AI agent responses</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.hasOpenAI && maskedCreds.openaiApiKey && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                    <p className="text-sm text-purple-700">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      API Key saved: {maskedCreds.openaiApiKey}
                    </p>
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label>OpenAI API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        type={showOpenAIKey ? "text" : "password"}
                        placeholder={status.hasOpenAI ? "Enter new key to update..." : "sk-..."}
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      >
                        {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      OpenAI Platform
                    </a>
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-muted/50 border-t p-6">
                <Button 
                  variant="outline"
                  onClick={() => testOpenAIMutation.mutate()}
                  disabled={testOpenAIMutation.isPending || !status.hasOpenAI}
                >
                  {testOpenAIMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button 
                  onClick={handleSaveOpenAI}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & Encrypt
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="gemini" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>Google Gemini API</CardTitle>
                    <CardDescription>Connect your Google AI account for Gemini-powered agents</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.hasGemini && maskedCreds.geminiApiKey && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <p className="text-sm text-blue-700">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      API Key saved: {maskedCreds.geminiApiKey}
                    </p>
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label>Gemini API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        type={showGeminiKey ? "text" : "password"}
                        placeholder={status.hasGemini ? "Enter new key to update..." : "AIza..."}
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                      >
                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{" "}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Google AI Studio
                    </a>
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end bg-muted/50 border-t p-6">
                <Button 
                  onClick={handleSaveGemini}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & Encrypt
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="facebook" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle>Facebook API</CardTitle>
                    <CardDescription>Connect for Facebook Lead Forms integration</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {status.hasFacebook && maskedCreds.facebookAccessToken && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                    <p className="text-sm text-blue-700">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Token saved: {maskedCreds.facebookAccessToken}
                    </p>
                  </div>
                )}
                
                <div className="grid gap-2">
                  <Label>Facebook Access Token</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        type={showFacebookToken ? "text" : "password"}
                        placeholder={status.hasFacebook ? "Enter new token to update..." : "Your Facebook Page Access Token"}
                        value={facebookAccessToken}
                        onChange={(e) => setFacebookAccessToken(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowFacebookToken(!showFacebookToken)}
                      >
                        {showFacebookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Facebook Page ID</Label>
                  <Input 
                    placeholder={status.hasFacebook ? maskedCreds.facebookPageId || "Enter to update..." : "Your Facebook Page ID"}
                    value={facebookPageId}
                    onChange={(e) => setFacebookPageId(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-muted/50 border-t p-6">
                <Button 
                  variant="outline"
                  onClick={() => testFacebookMutation.mutate()}
                  disabled={testFacebookMutation.isPending || !status.hasFacebook}
                >
                  {testFacebookMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="mr-2 h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                <Button 
                  onClick={handleSaveFacebook}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & Encrypt
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
                <CardDescription>Configure your WhatsApp webhook in Meta Developer Console</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Callback URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookUrl}
                      readOnly
                      className="font-mono bg-muted"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this URL as the Callback URL in your Meta Developer Console webhook settings.
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label>Webhook Verify Token</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Enter to update your verify token"
                      value={webhookVerifyToken}
                      onChange={(e) => setWebhookVerifyToken(e.target.value)}
                    />
                    <Button 
                      onClick={() => {
                        if (webhookVerifyToken) {
                          saveMutation.mutate({ webhookVerifyToken });
                        }
                      }}
                      disabled={saveMutation.isPending || !webhookVerifyToken}
                    >
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set a custom verify token that matches what you configure in Meta Developer Console.
                  </p>
                </div>
                
                <Alert>
                  <Activity className="h-4 w-4" />
                  <AlertTitle>Setup Instructions</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>1. Go to your Meta Developer Console</p>
                    <p>2. Navigate to WhatsApp {">"} Configuration {">"} Webhook</p>
                    <p>3. Set the Callback URL to the URL shown above</p>
                    <p>4. Set the Verify Token to match what you saved above</p>
                    <p>5. Subscribe to: messages, message_deliveries, message_reads</p>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
