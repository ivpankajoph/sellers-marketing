import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Search, 
  Filter, 
  Upload, 
  Download,
  MoreHorizontal,
  Trash2,
  Edit,
  Loader2,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  notes?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", tags: "", notes: "" });
  const [importData, setImportData] = useState("");

  const queryClient = useQueryClient();

  const { data: regularContacts = [], isLoading: isLoadingRegular } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const { data: importedContacts = [], isLoading: isLoadingImported } = useQuery<Contact[]>({
    queryKey: ["/api/broadcast/imported-contacts"],
    queryFn: async () => {
      const res = await fetch("/api/broadcast/imported-contacts");
      if (!res.ok) throw new Error("Failed to fetch imported contacts");
      return res.json();
    },
  });

  const contacts = [...regularContacts, ...importedContacts.map(c => ({
    ...c,
    tags: c.tags || [],
    source: c.source || 'import',
  }))];
  
  const isLoading = isLoadingRegular || isLoadingImported;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsAddDialogOpen(false);
      setFormData({ name: "", phone: "", email: "", tags: "", notes: "" });
      toast.success("Contact created successfully");
    },
    onError: () => {
      toast.error("Failed to create contact");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsEditDialogOpen(false);
      setSelectedContact(null);
      toast.success("Contact updated successfully");
    },
    onError: () => {
      toast.error("Failed to update contact");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contact: Contact) => {
      const isImported = contact.source === 'import' || contact.source === 'excel' || contact.source === 'csv';
      const url = isImported 
        ? `/api/broadcast/imported-contacts/${contact.id}`
        : `/api/contacts/${contact.id}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete contact");
      return isImported;
    },
    onSuccess: (isImported) => {
      if (isImported) {
        queryClient.invalidateQueries({ queryKey: ["/api/broadcast/imported-contacts"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      }
      toast.success("Contact deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (contacts: any[]) => {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      if (!res.ok) throw new Error("Failed to import contacts");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setIsImportDialogOpen(false);
      setImportData("");
      toast.success(`Imported ${data.imported} contacts successfully`);
    },
    onError: () => {
      toast.error("Failed to import contacts");
    },
  });

  const handleAddContact = () => {
    createMutation.mutate({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
      notes: formData.notes || undefined,
    });
  };

  const handleEditContact = () => {
    if (!selectedContact) return;
    updateMutation.mutate({
      id: selectedContact.id,
      data: {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        notes: formData.notes || undefined,
      },
    });
  };

  const handleImport = () => {
    try {
      const lines = importData.trim().split("\n");
      const contacts = lines.map(line => {
        const [name, phone, email, tags] = line.split(",").map(s => s.trim());
        return {
          name: name || "Unknown",
          phone: phone || "",
          email: email || undefined,
          tags: tags ? tags.split(";").map(t => t.trim()) : [],
        };
      }).filter(c => c.phone);
      importMutation.mutate(contacts);
    } catch (error) {
      toast.error("Invalid import format");
    }
  };

  const handleExport = () => {
    const csv = contacts.map(c => 
      `${c.name},${c.phone},${c.email || ""},${c.tags.join(";")}`
    ).join("\n");
    const blob = new Blob([`Name,Phone,Email,Tags\n${csv}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    toast.success("Contacts exported successfully");
  };

  const openEditDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      tags: contact.tags.join(", "),
      notes: contact.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    return "Just now";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
            <p className="text-muted-foreground">Manage your customer database and segments.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Contacts</DialogTitle>
                  <DialogDescription>
                    Paste CSV data (Name,Phone,Email,Tags). Tags separated by semicolons.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Textarea
                    placeholder="Your Name,+1234567890,john@email.com,VIP;Customer"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={6}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Your Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      placeholder="+1234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="Your Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      placeholder="VIP, Customer, Lead"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Additional notes..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddContact} disabled={createMutation.isPending || !formData.name || !formData.phone}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Contact
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Contacts</CardTitle>
                <CardDescription>Total {contacts.length} contacts in your database.</CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search contacts..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Name</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div>{contact.name}</div>
                            {contact.email && <div className="text-xs text-muted-foreground">{contact.email}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs font-normal">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{getTimeAgo(contact.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(contact)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number *</Label>
              <Input
                placeholder="+1234567890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                placeholder="VIP, Customer, Lead"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditContact} disabled={updateMutation.isPending || !formData.name || !formData.phone}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
