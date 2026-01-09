import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Loader2 } from "lucide-react";

interface TemplateHeaderProps {
  onSync: () => void;
  onCreate: () => void;
  syncPending: boolean;
}

export default function TemplateHeader({ onSync, onCreate, syncPending }: TemplateHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Manage Templates</h2>
        <p className="text-muted-foreground">
          Create and manage your WhatsApp message templates.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onSync} disabled={syncPending}>
          {syncPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync META Templates
        </Button>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>
    </div>
  );
}