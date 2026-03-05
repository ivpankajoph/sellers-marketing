// TemplateFormDialog.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import ButtonEditor from "./ButtonEditor";
import { ButtonDef, Template } from "./type";
import { getAuthHeaders } from "@/contexts/AuthContext";

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  buttonFields: ButtonDef[];
  setButtonFields: React.Dispatch<React.SetStateAction<ButtonDef[]>>;
  selectedTemplate: Template | null;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;

  // Image handling
  headerImagePreview: string | null;
  setHeaderImagePreview: (url: string | null) => void;
  headerMediaHandle: string | null;
  setHeaderMediaHandle: (handle: string | null) => void;
}

function isHttpUrl(value?: string | null) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export default function TemplateFormDialog({
  open,
  onOpenChange,
  mode,
  formData,
  setFormData,
  buttonFields,
  setButtonFields,
  selectedTemplate,
  isPending,
  onSubmit,
  onCancel,
  headerImagePreview,
  setHeaderImagePreview,
  headerMediaHandle,
  setHeaderMediaHandle,
}: TemplateFormDialogProps) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const isEdit = mode === "edit";
  const title = isEdit ? "Edit Template" : "Create Template";
  const submitLabel = isEdit
    ? "Save & Resubmit"
    : "Create & Submit for Approval";

  useEffect(() => {
    if (mode !== "edit" || !selectedTemplate) {
      return;
    }

    // previewUrl is renderable URL; headerImageUrl is usually Meta handle.
    const previewUrl =
      (isHttpUrl(selectedTemplate.previewUrl)
        ? selectedTemplate.previewUrl
        : null) ||
      (isHttpUrl(selectedTemplate.headerImageUrl)
        ? selectedTemplate.headerImageUrl
        : null);

    setHeaderImagePreview(previewUrl);
    setHeaderMediaHandle(selectedTemplate.headerImageUrl || selectedTemplate.previewUrl || null);
  }, [mode, selectedTemplate, setHeaderImagePreview, setHeaderMediaHandle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[70vh]">
          {isEdit && selectedTemplate?.status === "approved" && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                Editing this approved template will require re-approval from Meta.
              </AlertDescription>
            </Alert>
          )}

          {!isEdit && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm">
                This template will be submitted to Meta for approval.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="welcome_message"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(v) =>
                  setFormData({ ...formData, category: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Input
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Header Type</Label>
            <Select
              value={formData.headerType}
              onValueChange={(v) =>
                setFormData({ ...formData, headerType: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.headerType === "text" && (
            <div className="space-y-2">
              <Label>Header Text</Label>
              <Input
                value={formData.headerText}
                onChange={(e) =>
                  setFormData({ ...formData, headerText: e.target.value })
                }
              />
            </div>
          )}

          {formData.headerType === "image" && (
            <div className="space-y-2">
              <Label>Header Image</Label>
              <input
                ref={mediaInputRef}
                type="file"
                accept=".png,.jpg,.jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    alert("Image must be less than 5MB");
                    return;
                  }

                  if (!["image/jpeg", "image/png"].includes(file.type)) {
                    alert("Only JPG and PNG images are allowed");
                    return;
                  }

                  const uploadData = new FormData();
                  uploadData.append("file", file);

                  try {
                    const res = await fetch("/api/upload/template-header", {
                      method: "POST",
                      headers: getAuthHeaders(),
                      body: uploadData,
                    });
                    const data = await res.json();

                    if (!res.ok) {
                      alert(data.error || "Upload failed");
                      return;
                    }

                    setHeaderMediaHandle(data.handle || null);
                    setHeaderImagePreview(data.previewUrl || URL.createObjectURL(file));
                  } catch (err) {
                    console.error(err);
                    alert("Image upload failed");
                  }
                }}
                className="block w-full text-sm text-muted-foreground"
              />

              {headerMediaHandle && (
                <div className="space-y-2">
                  {headerImagePreview ? (
                    <img
                      src={headerImagePreview}
                      alt="Header preview"
                      className="max-h-32 object-contain border rounded"
                    />
                  ) : (
                    <div className="rounded border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Image is attached, but preview URL is unavailable.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (mediaInputRef.current) {
                          mediaInputRef.current.value = "";
                          mediaInputRef.current.click();
                        }
                      }}
                    >
                      Change Image
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setHeaderImagePreview(null);
                        setHeaderMediaHandle(null);
                        setFormData((prev: any) => ({
                          ...prev,
                          headerImageUrl: null,
                        }));
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Message Body *</Label>
            <Textarea
              rows={5}
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Footer</Label>
            <Input
              value={formData.footer}
              onChange={(e) =>
                setFormData({ ...formData, footer: e.target.value })
              }
            />
          </div>

          <ButtonEditor
            buttonFields={buttonFields}
            setButtonFields={setButtonFields}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending || !formData.name || !formData.content}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
