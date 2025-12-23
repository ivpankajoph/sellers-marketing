import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ExternalLink,
  Upload,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PhonePreview } from "@/components/ui/phone-preview";

type ButtonType = {
  id: string;
  type: "quick_reply" | "url" | "phone_number";
  text: string;
  url?: string;
  phone_number?: string;
};

export default function AddTemplate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState("none");
  const [headerText, setHeaderText] = useState("");
  const [headerImage, setHeaderImage] = useState("");
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setHeaderImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setHeaderImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setHeaderImage("");
    setHeaderImageFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const addNewButton = () => {
    if (buttons.length >= 3) {
      toast.error("You can add up to 3 buttons only");
      return;
    }
    setButtons([
      ...buttons,
      { id: Date.now().toString(), type: "quick_reply", text: "" },
    ]);
  };

  const updateButton = (id: string, field: keyof ButtonType, value: string) => {
    setButtons(buttons.map(btn => btn.id === id ? { ...btn, [field]: value } : btn));
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter(btn => btn.id !== id));
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create template");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast.success("Template created successfully!");
      setLocation("/templates/manage");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter body text");
      return;
    }

    const templateName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Validate buttons
    const validButtons = buttons
      .filter(btn => btn.text.trim())
      .map(btn => ({
        type: btn.type,
        text: btn.text.trim(),
        ...(btn.type === "url" && { url: btn.url || "https://example.com" }),
        ...(btn.type === "phone_number" && { phone_number: btn.phone_number || "+1234567890" }),
      }));

    createTemplateMutation.mutate({
      name: templateName,
      category,
      language,
      headerType: headerType === "none" ? null : headerType,
      headerText: headerType === "text" ? headerText : null,
      content: body,
      footer: footer || null,
      buttons: validButtons.length > 0 ? validButtons : undefined,
      status: "pending",
    });
  };

  return (
    <DashboardLayout>
      <h2 className="text-3xl font-bold tracking-tight">Add New Template</h2>
      <Card className="mt-4 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            WhatsApp Template Rules & Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Allowed Content
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Transaction confirmations (orders, bookings)</li>
                <li>Account updates and notifications</li>
                <li>Customer service responses</li>
                <li>One-time passwords (OTP)</li>
                <li>Appointment reminders</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Not Allowed
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Promotional content without opt-in</li>
                <li>Adult or gambling content</li>
                <li>Misleading or spam messages</li>
                <li>Political content</li>
                <li>Cryptocurrency promotions</li>
              </ul>
            </div>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Approval Process</AlertTitle>
            <AlertDescription>
              Templates must be approved by Meta before use. Marketing templates
              may take 24-48 hours. Utility and authentication templates are
              usually approved faster.
              <a
                href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:underline"
              >
                View Full Guidelines <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <p className="text-muted-foreground">
            Create a WhatsApp message template for approval
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>
                  Fill in the details for your new template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., welcome_message_v2"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value.toLowerCase().replace(/\s+/g, "_"))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use lowercase letters, numbers, and underscores only
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="utility">Utility</SelectItem>
                        <SelectItem value="authentication">
                          Authentication
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_US">English (US)</SelectItem>
                        <SelectItem value="en_GB">English (UK)</SelectItem>
                        <SelectItem value="es_ES">Spanish</SelectItem>
                        <SelectItem value="hi">Hindi</SelectItem>
                        <SelectItem value="pt_BR">
                          Portuguese (Brazil)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Header (Optional)</Label>
                  <Select value={headerType} onValueChange={setHeaderType}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {headerType === "text" && (
                  <div className="grid gap-2">
                    <Label>Header Text</Label>
                    <Input
                      placeholder="Enter header text"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                    />
                  </div>
                )}

                {headerType === "image" && (
                  <div className="grid gap-2">
                    <Label>Header Image</Label>
                    <input
                      type="file"
                      ref={imageInputRef}
                      onChange={handleImageUpload}
                      accept=".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                    />
                    {headerImage ? (
                      <div className="relative">
                        <img
                          src={headerImage}
                          alt="Header preview"
                          className="w-full h-40 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => imageInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith("image/")) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error("Image must be less than 5MB");
                              return;
                            }
                            setHeaderImageFile(file);
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setHeaderImage(event.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          } else {
                            toast.error("Please drop a valid image file");
                          }
                        }}
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                      >
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG, JPEG, GIF, WebP (max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="body">Body Text *</Label>
                  <Textarea
                    id="body"
                    placeholder="Enter your message here. Use {{1}}, {{2}} for variables."
                    className="min-h-[120px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"} etc. for dynamic variables
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Footer (Optional)</Label>
                  <Input
                    placeholder="e.g., Reply STOP to unsubscribe"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                </div>

                {/* Buttons Section */}
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label>Buttons (Max 3)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addNewButton}
                      disabled={buttons.length >= 3}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Button
                    </Button>
                  </div>

                  {buttons.map((btn, idx) => (
                    <div key={btn.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Select
                          value={btn.type}
                          onValueChange={(val) =>
                            updateButton(btn.id, "type", val as any)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quick_reply">Quick Reply</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                            <SelectItem value="phone_number">Phone Number</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6">
                        <Input
                          placeholder="Button text (max 30 chars)"
                          value={btn.text}
                          onChange={(e) => updateButton(btn.id, "text", e.target.value)}
                          maxLength={30}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(btn.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      {btn.type === "url" && (
                        <div className="col-span-12 mt-1">
                          <Input
                            placeholder="URL (use {{1}} for variable)"
                            value={btn.url || ""}
                            onChange={(e) =>
                              updateButton(btn.id, "url", e.target.value)
                            }
                          />
                        </div>
                      )}
                      {btn.type === "phone_number" && (
                        <div className="col-span-12 mt-1">
                          <Input
                            placeholder="Phone number (e.g., +911234567890)"
                            value={btn.phone_number || ""}
                            onChange={(e) =>
                              updateButton(btn.id, "phone_number", e.target.value)
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {buttons.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add up to 3 buttons (Quick Reply, URL, or Phone Number)
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={createTemplateMutation.isPending}
                >
                  {createTemplateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Template...
                    </>
                  ) : (
                    "Create Template"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Template Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3 text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Template names must be lowercase with underscores</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Marketing templates need clear opt-out option</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Avoid promotional language in Utility templates</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Use variables for personalization</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                  <span>Buttons: max 3, text ≤ 30 chars</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phone Preview</CardTitle>
                <CardDescription>
                  See how your template will look on WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhonePreview
                  headerType={headerType === "none" ? undefined : headerType}
                  headerText={headerText}
                  headerImage={headerImage}
                  body={body}
                  footer={footer}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}