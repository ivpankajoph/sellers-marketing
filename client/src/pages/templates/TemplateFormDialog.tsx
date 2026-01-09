// TemplateFormDialog.tsx
import { useEffect } from "react";
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
import { AlertTriangle, Loader2, X } from "lucide-react";
import ButtonEditor from "./ButtonEditor";
import { ButtonDef, Template } from "./type";

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
  headerImagePreview: string | null; // Cloudinary URL
  setHeaderImagePreview: (url: string | null) => void;
  headerMediaHandle: string | null; // Meta media handle
  setHeaderMediaHandle: (handle: string | null) => void;
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
  const isEdit = mode === "edit";
  const title = isEdit ? "Edit Template" : "Create Template";
  const submitLabel = isEdit
    ? "Save & Resubmit"
    : "Create & Submit for Approval";

  // ✅ Populate image preview in edit mode
  useEffect(() => {
    if (mode === "edit" && selectedTemplate?.previewUrl) {
      setHeaderImagePreview(selectedTemplate.previewUrl);
      setFormData((prev: any) => ({
        ...prev,
        headerImageUrl: selectedTemplate.previewUrl,
      }));
    }
  }, [mode, selectedTemplate, setFormData, setHeaderImagePreview]);

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

          {/* Template Name + Category */}
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
                  <SelectItem value="authentication">
                    Authentication
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>Language</Label>
            <Input
              value={formData.language}
              onChange={(e) =>
                setFormData({ ...formData, language: e.target.value })
              }
            />
          </div>

          {/* Header Type */}
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

          {/* Header Text */}
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

          {/* Header Image */}
          {formData.headerType === "image" && (
            <div className="space-y-2">
              <Label>Header Image</Label>
              <input
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
                      body: uploadData,
                    });
                    const data = await res.json();

                    if (!res.ok) {
                      alert(data.error || "Upload failed");
                      return;
                    }

                    // ✅ Meta media handle
                    setHeaderMediaHandle(data.handle);

                    // ✅ Cloudinary preview URL
                    setHeaderImagePreview(data.previewUrl);

                    // ✅ Persist for DB
                    setFormData((prev: any) => ({
                      ...prev,
                      headerImageUrl: data.previewUrl,
                    }));
                  } catch (err) {
                    console.error(err);
                    alert("Image upload failed");
                  }
                }}
                className="block w-full text-sm text-muted-foreground"
              />

              {headerImagePreview && (
                <div className="mt-2 relative inline-block">
                  <img
                    src={headerImagePreview}
                    alt="Header preview"
                    className="max-h-32 object-contain border rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => {
                      setHeaderImagePreview(null);
                      setHeaderMediaHandle(null);
                      setFormData((prev: any) => ({
                        ...prev,
                        headerImageUrl: null,
                      }));
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Body */}
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

          {/* Footer */}
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
