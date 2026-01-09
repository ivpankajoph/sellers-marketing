
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { ButtonDef } from "./type";

interface ButtonEditorProps {
  buttonFields: ButtonDef[];
  setButtonFields: React.Dispatch<React.SetStateAction<ButtonDef[]>>;
}

export default function ButtonEditor({ buttonFields, setButtonFields }: ButtonEditorProps) {
  const addButton = () => {
    if (buttonFields.length < 3) {
      setButtonFields([...buttonFields, { type: "quick_reply", text: "" }]);
    }
  };

  const removeButton = (index: number) => {
    setButtonFields(buttonFields.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: keyof ButtonDef, value: string) => {
    const newButtons = [...buttonFields];
    // @ts-ignore
    newButtons[index][field] = value;
    setButtonFields(newButtons);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>Buttons</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addButton}
          disabled={buttonFields.length >= 3}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Button
        </Button>
      </div>
      {buttonFields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No buttons added.</p>
      ) : (
        <div className="space-y-3 p-3 border rounded-md">
          {buttonFields.map((btn, idx) => (
            <div key={idx} className="flex flex-col gap-2 p-2 border rounded bg-muted/20">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium">Button {idx + 1}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => removeButton(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={btn.type}
                    onValueChange={(v) => updateButton(idx, "type", v as any)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick_reply">Quick Reply</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="phone_number">Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {btn.type === "quick_reply" && (
                  <div>
                    <Label className="text-xs">Quick Reply Text</Label>
                    <Input
                      value={btn.text || ""}
                      onChange={(e) => updateButton(idx, "text", e.target.value)}
                      placeholder="e.g., Yes"
                    />
                  </div>
                )}

                {btn.type === "url" && (
                  <div>
                    <Label className="text-xs">URL</Label>
                    <Input
                      value={btn.url || ""}
                      onChange={(e) => updateButton(idx, "url", e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                )}

                {btn.type === "phone_number" && (
                  <div>
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                      value={btn.phoneNumber || ""}
                      onChange={(e) => updateButton(idx, "phoneNumber", e.target.value)}
                      placeholder="+919876543210"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {buttonFields.length >= 3 && (
        <p className="text-xs text-muted-foreground">Max 3 buttons allowed by WhatsApp.</p>
      )}
    </div>
  );
}