import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Copy, Edit, Trash2, Send, Loader2 } from "lucide-react";
import { Template } from "./type";

interface TemplateTableProps {
  templates: Template[];
  isLoading: boolean;
  selectedTemplateIds: Set<string>;
  allSelected: boolean;
  deletePending: boolean;
  deletingTemplateId: string | null;
  onToggleSelectAll: () => void;
  onToggleTemplateSelection: (id: string) => void;
  onCopy: (content: string) => void;
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
  onSubmitForApproval: (id: string) => void;
  submitApprovalPending: boolean;
}

export default function TemplateTable({
  templates,
  isLoading,
  selectedTemplateIds,
  allSelected,
  deletePending,
  deletingTemplateId,
  onToggleSelectAll,
  onToggleTemplateSelection,
  onCopy,
  onEdit,
  onDelete,
  onSubmitForApproval,
  submitApprovalPending,
}: TemplateTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "pending": return "secondary";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No templates yet. Create your first template or sync from Meta to get started.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              disabled={deletePending}
              aria-label="Select all templates"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Language</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Variables</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => {
          const status = template.metaStatus?.toLowerCase() || template.status;
          return (
            <TableRow key={template.id}>
              <TableCell className="w-10">
                <input
                  type="checkbox"
                  checked={selectedTemplateIds.has(template.id)}
                  onChange={() => onToggleTemplateSelection(template.id)}
                  disabled={deletePending}
                  aria-label={`Select ${template.name}`}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </TableCell>
              <TableCell className="font-medium">{template.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {template.category}
                </Badge>
              </TableCell>
              <TableCell>{template.language || "en"}</TableCell>
              <TableCell>
                <Badge variant={getStatusColor(status)} className="capitalize">
                  {status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(template.variables || []).slice(0, 3).map((v:any) => (
                    <Badge key={v} variant="secondary" className="text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                  {(template.variables?.length || 0) > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{(template.variables?.length || 0) - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(template.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {status === "pending" && !template.metaTemplateId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSubmitForApproval(template.id)}
                      disabled={submitApprovalPending || deletePending}
                    >
                      <Send className="mr-1 h-3 w-3" />
                      Submit
                    </Button>
                  )}
                  {deletePending && deletingTemplateId === template.id ? (
                    <div className="inline-flex items-center text-xs text-muted-foreground">
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      Deleting...
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={deletePending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onCopy(template.content)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Content
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(template)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(template.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
