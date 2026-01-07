import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Paperclip, 
  Send, 
  Smile, 
  MoreVertical, 
  Phone, 
  Video, 
  Loader2, 
  Download, 
  Clock,
  Bot,
  FileText,
  MessageSquare,
  Reply,
  X,
  MailOpen,
  CheckSquare,
  Ban,
  Trash2,
  ArrowLeft,
  UserPlus,
  Users
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
}

interface Message {
  id: string;
  contactId: string;
  content: string;
  type: string;
  direction: "inbound" | "outbound";
  status: string;
  timestamp: string;
  replyToMessageId?: string;
  replyToContent?: string;
  mediaUrl?: string;
}

interface LeadAssignment {
  id: string;
  contactId: string;
  assignedToUserId: string;
  assignedToUserName: string;
  status: string;
  priority: string;
}

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Chat {
  id: string;
  contactId: string;
  contact: Contact;
  lastMessage?: string;
  lastMessageTime?: string;
  lastInboundMessageTime?: string;
  unreadCount: number;
  status: string;
  fromWindowInbox?: boolean;
  assignment?: LeadAssignment | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  status: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface ImportedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function downloadMediaWithAuth(mediaUrl: string, filename: string, openInNewTab: boolean = false) {
  try {
    const response = await fetchWithAuth(`/api/webhook/whatsapp/media/${mediaUrl}`, {
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      throw new Error('Failed to download media');
    }
    
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Media download error:', error);
    toast.error('Failed to download file. Please try again.');
  }
}

export default function Inbox() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isBulkSendOpen, setIsBulkSendOpen] = useState(false);
  const [messageType, setMessageType] = useState<"template" | "custom" | "ai">("template");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState("");
  const [assignPriority, setAssignPriority] = useState<string>("medium");
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats"],
    queryFn: async () => {
      const res = await fetch("/api/chats", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch chats");
      return res.json();
    },
    refetchInterval: 3000,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
  });

  const { data: importedContacts = [] } = useQuery<ImportedContact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["/api/lead-management/assignable-users"],
    queryFn: async () => {
      const res = await fetch("/api/lead-management/assignable-users", {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to fetch assignable users");
      return res.json();
    },
  });

  const assignLeadMutation = useMutation({
    mutationFn: async ({ contactId, phone, contactName, assignedToUserId, priority }: { 
      contactId: string; 
      phone: string;
      contactName: string;
      assignedToUserId: string;
      priority: string;
    }) => {
      const res = await fetch("/api/lead-management/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ contactId, phone, contactName, assignedToUserId, priority }),
      });
      if (!res.ok) throw new Error("Failed to assign lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setAssignDialogOpen(false);
      setSelectedUserToAssign("");
      setAssignPriority("medium");
      toast.success("Lead assigned successfully");
    },
    onError: () => {
      toast.error("Failed to assign lead");
    }
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ contactIds, assignedToUserId, priority }: { 
      contactIds: string[]; 
      assignedToUserId: string;
      priority: string;
    }) => {
      const res = await fetch("/api/lead-management/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ contactIds, assignedToUserId, priority }),
      });
      if (!res.ok) throw new Error("Failed to bulk assign leads");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setBulkAssignDialogOpen(false);
      setSelectedContacts([]);
      setSelectedUserToAssign("");
      setAssignPriority("medium");
      toast.success(`${data.assigned} leads assigned successfully`);
    },
    onError: () => {
      toast.error("Failed to bulk assign leads");
    }
  });

  const { phoneToNameMap, last10ToNameMap } = useMemo(() => {
    const phoneMap = new Map<string, string>();
    const last10Map = new Map<string, string>();
    
    const isRealName = (name: string): boolean => {
      if (!name || !name.trim()) return false;
      if (name.startsWith('WhatsApp')) return false;
      if (name.startsWith('+')) return false;
      if (/^\d[\d\s]*$/.test(name)) return false;
      return true;
    };
    
    importedContacts.forEach(contact => {
      const normalizedPhone = normalizePhone(contact.phone);
      if (isRealName(contact.name)) {
        phoneMap.set(normalizedPhone, contact.name);
        if (normalizedPhone.length >= 10) {
          last10Map.set(normalizedPhone.slice(-10), contact.name);
        }
      }
    });
    
    return { phoneToNameMap: phoneMap, last10ToNameMap: last10Map };
  }, [importedContacts]);

  const getContactName = useMemo(() => {
    return (chatContact: Contact): string => {
      const normalizedPhone = normalizePhone(chatContact.phone);
      
      if (chatContact.name && 
          !chatContact.name.startsWith('WhatsApp') && 
          !chatContact.name.startsWith('+') &&
          !/^\d+$/.test(chatContact.name.replace(/\s/g, ''))) {
        return chatContact.name;
      }
      
      let name = phoneToNameMap.get(normalizedPhone);
      if (name) return name;
      
      if (normalizedPhone.length >= 10) {
        const last10 = normalizedPhone.slice(-10);
        name = last10ToNameMap.get(last10);
        if (name) return name;
      }
      
      return chatContact.phone.startsWith('+') ? chatContact.phone : `+${chatContact.phone}`;
    };
  }, [phoneToNameMap, last10ToNameMap]);

  const selectedChat = chats.find(c => c.id === selectedChatId);
  const selectedContactId = selectedChat?.contactId;

  const { data: rawMessages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const res = await fetch(`/api/messages?contactId=${selectedContactId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedContactId,
    refetchInterval: 2000,
  });

  // Deduplicate messages using message ID (keep only unique messages)
  // This filters out any duplicate database entries based on unique message ID
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return rawMessages.filter(msg => {
      if (seen.has(msg.id)) {
        return false;
      }
      seen.add(msg.id);
      return true;
    });
  }, [rawMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, phone, contactId, replyToMessageId, replyToContent }: { 
      content: string; 
      phone: string; 
      contactId: string;
      replyToMessageId?: string;
      replyToContent?: string;
    }) => {
      const waRes = await fetchWithAuth("/api/webhook/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          message: replyToContent ? `> ${replyToContent.substring(0, 50)}${replyToContent.length > 50 ? '...' : ''}\n\n${content}` : content,
        }),
      });
      
      if (!waRes.ok) {
        const error = await waRes.json();
        throw new Error(error.error || "Failed to send WhatsApp message");
      }
      
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          content,
          type: "text",
          direction: "outbound",
          status: "sent",
          replyToMessageId,
          replyToContent,
        }),
      });
      
      if (!res.ok) {
        console.error("Failed to save message locally, but WhatsApp sent");
      }
      
      return { waResult: await waRes.json(), contactId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", data.contactId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setMessageInput("");
      setReplyingTo(null);
      toast.success("Message sent via WhatsApp");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const sendBulkMessageMutation = useMutation({
    mutationFn: async (data: { contacts: string[], messageType: string, content: string }) => {
      const results: { success: number; failed: number } = { success: 0, failed: 0 };
      
      for (const contactId of data.contacts) {
        const chat = chats.find(c => c.contactId === contactId);
        if (!chat) continue;
        
        const phone = chat.contact.phone.replace(/\D/g, '');
        const name = getContactName(chat.contact);
        const templateObj = templates.find(t => t.id === selectedTemplate);
        
        try {
          const res = await fetch("/api/inbox/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              phone,
              name,
              messageType: data.messageType,
              templateName: templateObj?.name,
              customMessage: data.messageType === "custom" ? data.content : undefined,
              agentId: data.messageType === "ai" ? selectedAgent : undefined,
            }),
          });
          
          if (res.ok) {
            results.success++;
          } else {
            results.failed++;
          }
        } catch {
          results.failed++;
        }
      }
      
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedContacts([]);
      setIsBulkSendOpen(false);
      setCustomMessage("");
      setSelectedTemplate("");
      setSelectedAgent("");
      if (data.failed > 0) {
        toast.success(`Sent to ${data.success} contacts, ${data.failed} failed`);
      } else {
        toast.success(`Message sent to ${data.success} contact${data.success > 1 ? 's' : ''}`);
      }
    },
    onError: () => {
      toast.error("Failed to send messages");
    },
  });

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  const markAsReadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch(`/api/chats/${contactId}/mark-read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch(`/api/chats/${contactId}/mark-unread`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as unread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast.success("Marked as unread");
    },
  });

  const blockContactMutation = useMutation({
    mutationFn: async ({ phone, name, reason }: { phone: string; name: string; reason: string }) => {
      const res = await fetch("/api/contacts/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, reason }),
      });
      if (!res.ok) throw new Error("Failed to block contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setBlockDialogOpen(false);
      setBlockReason("");
      setSelectedChatId(null);
      toast.success("Contact blocked successfully");
    },
    onError: () => {
      toast.error("Failed to block contact");
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setDeleteDialogOpen(false);
      setSelectedChatId(null);
      toast.success("Contact deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView("chat");
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.unreadCount > 0) {
      markAsReadMutation.mutate(chat.contactId);
    }
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChat || !selectedContactId) return;
    const phone = selectedChat.contact.phone.replace(/\D/g, '');
    sendMessageMutation.mutate({ 
      content: messageInput, 
      phone, 
      contactId: selectedContactId,
      replyToMessageId: replyingTo?.id,
      replyToContent: replyingTo?.content,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredChats.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredChats.map(c => c.contactId));
    }
  };

  const handleSelectContact = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId) 
        : [...prev, contactId]
    );
  };

  const handleBulkSend = () => {
    if (selectedContacts.length === 0) {
      toast.error("Please select at least one contact");
      return;
    }

    let content = "";
    if (messageType === "template") {
      const template = templates.find(t => t.id === selectedTemplate);
      content = template?.content || "";
    } else if (messageType === "custom") {
      content = customMessage;
    } else if (messageType === "ai") {
      content = `[AI Agent: ${agents.find(a => a.id === selectedAgent)?.name || 'Unknown'}]`;
    }

    if (!content && messageType !== "ai") {
      toast.error("Please enter a message or select a template");
      return;
    }

    sendBulkMessageMutation.mutate({
      contacts: selectedContacts,
      messageType,
      content,
    });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    
    if (days === 0) {
      return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const isWithin24Hours = (chat: Chat) => {
    if (!chat.lastInboundMessageTime) return false;
    const lastInbound = new Date(chat.lastInboundMessageTime);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const filteredChats = chats.filter(chat => {
    const matchesSearch = getContactName(chat.contact).toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.contact.phone.includes(searchQuery);
    const matchesFilter = filter === "all" || (filter === "unread" && chat.unreadCount > 0);
    return matchesSearch && matchesFilter;
  });

  const windowLeads = chats.filter(chat => {
    if (chat.lastInboundMessageTime) {
      const lastInbound = new Date(chat.lastInboundMessageTime);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
      return hoursDiff > 24;
    }
    return true;
  });

  const handleExportList = () => {
    const data = windowLeads.map(chat => ({
      name: getContactName(chat.contact),
      phone: chat.contact.phone,
      email: chat.contact.email || "",
      lastMessage: chat.lastMessage || "",
      lastMessageTime: chat.lastMessageTime || "",
    }));

    const headers = ["Name", "Phone", "Email", "Last Message", "Last Message Time"];
    const csv = [
      headers.join(","),
      ...data.map(row => 
        [row.name, row.phone, row.email, `"${row.lastMessage}"`, row.lastMessageTime].join(",")
      )
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inbox_leads_outside_window.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("List exported successfully");
  };

  const getInitials = (contact: Contact) => {
    const displayName = getContactName(contact);
    if (displayName.startsWith('+')) {
      return displayName.slice(-2);
    }
    return displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const approvedTemplates = templates.filter(t => t.status === "approved");

  const renderMessageContent = (msg: Message) => {
    const content = msg.content;
    const mediaUrl = msg.mediaUrl;
    
    if (msg.type === 'image' || content.startsWith('[Image')) {
      if (mediaUrl) {
        const caption = content.replace(/^\[Image\]\s*/, '').replace(/^\[Image message\]$/, '');
        return (
          <div className="space-y-2">
            <img 
              src={`/api/webhook/whatsapp/media/${mediaUrl}`} 
              alt="Shared image" 
              className="max-w-[280px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => downloadMediaWithAuth(mediaUrl, 'image.jpg', true)}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">📷 Image expired or unavailable</span>
            {caption && <p className="text-sm">{caption}</p>}
          </div>
        );
      }
      return <span className="flex items-center gap-1 text-muted-foreground italic">📷 {content}</span>;
    } else if (msg.type === 'video' || content.startsWith('[Video')) {
      if (mediaUrl) {
        const caption = content.replace(/^\[Video\]\s*/, '').replace(/^\[Video message\]$/, '');
        return (
          <div className="space-y-2">
            <video 
              src={`/api/webhook/whatsapp/media/${mediaUrl}`} 
              controls
              className="max-w-[280px] max-h-[300px] rounded-lg"
              onError={(e) => {
                (e.target as HTMLVideoElement).style.display = 'none';
                (e.target as HTMLVideoElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">🎥 Video expired or unavailable</span>
            {caption && <p className="text-sm">{caption}</p>}
          </div>
        );
      }
      return <span className="flex items-center gap-1 text-muted-foreground italic">🎥 {content}</span>;
    } else if (msg.type === 'audio' || content.startsWith('[Audio')) {
      if (mediaUrl) {
        return (
          <div className="space-y-2">
            <audio 
              src={`/api/webhook/whatsapp/media/${mediaUrl}`} 
              controls
              className="max-w-[280px]"
              onError={(e) => {
                (e.target as HTMLAudioElement).style.display = 'none';
                (e.target as HTMLAudioElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">🎵 Audio expired or unavailable</span>
          </div>
        );
      }
      return <span className="flex items-center gap-1 text-muted-foreground italic">🎵 {content}</span>;
    } else if (msg.type === 'sticker' || content.startsWith('[Sticker')) {
      if (mediaUrl) {
        return (
          <div>
            <img 
              src={`/api/webhook/whatsapp/media/${mediaUrl}`} 
              alt="Sticker" 
              className="max-w-[150px] max-h-[150px]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">🎨 Sticker expired or unavailable</span>
          </div>
        );
      }
      return <span className="flex items-center gap-1 text-muted-foreground italic">🎨 {content}</span>;
    } else if (msg.type === 'document' || content.startsWith('[Document')) {
      if (mediaUrl) {
        const filename = content.match(/\[Document: ([^\]]+)\]/)?.[1] || 'document';
        return (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadMediaWithAuth(mediaUrl, filename, true)}
              className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <span className="text-lg">📄</span>
              <span className="text-sm underline">{filename}</span>
            </button>
            <button
              onClick={() => downloadMediaWithAuth(mediaUrl, filename, false)}
              className="p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        );
      }
      return <span className="flex items-center gap-1 text-muted-foreground italic">📄 {content}</span>;
    } else if (content.startsWith('[Location')) {
      return <span className="flex items-center gap-1 text-muted-foreground italic">📍 {content}</span>;
    } else if (content.startsWith('[Contact')) {
      return <span className="flex items-center gap-1 text-muted-foreground italic">👤 {content}</span>;
    } else if (content.startsWith('[Reaction')) {
      return <span className="flex items-center gap-1">{content}</span>;
    } else if (content.startsWith('[Unsupported')) {
      return <span className="flex items-center gap-1 text-muted-foreground italic">⚠️ {content}</span>;
    }
    
    return <span>{content}</span>;
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] p-1 flex flex-col gap-2 md:gap-4 animate-in fade-in duration-500 overflow-hidden">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-2 flex-shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          <div>
            <h2 className="text-lg md:text-2xl font-bold tracking-tight">Inbox</h2>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              All conversations. Contacts outside 24-hour window require templates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="md:size-default" onClick={handleExportList}>
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Export List ({windowLeads.length})</span>
            </Button>
            {selectedContacts.length > 0 && (
              <>
              <Button size="sm" className="md:size-default" variant="outline" onClick={() => setBulkAssignDialogOpen(true)}>
                <Users className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Assign</span> {selectedContacts.length}
              </Button>
              <Button size="sm" className="md:size-default" onClick={() => setIsBulkSendOpen(true)}>
                <Send className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Send to</span> {selectedContacts.length}
              </Button>
              </>
            )}
          </div>
        </div>

        <div className={`flex items-center gap-2 md:gap-4 p-2 md:p-3 bg-muted/50 rounded-lg flex-shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          <Checkbox 
            checked={selectedContacts.length === filteredChats.length && filteredChats.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-xs md:text-sm font-medium">Select All ({filteredChats.length} chats)</span>
          {selectedContacts.length > 0 && (
            <Badge variant="secondary" className="text-xs">{selectedContacts.length} selected</Badge>
          )}
        </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-card border border-border rounded-lg overflow-hidden shadow-sm">
        <div className={`w-full md:w-80 lg:w-96 md:border-r border-border flex flex-col bg-background min-h-0 h-full ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 md:p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search chats..." 
                className="pl-9 bg-secondary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Badge 
                variant={filter === "all" ? "default" : "outline"} 
                className="cursor-pointer"
                onClick={() => setFilter("all")}
              >
                All
              </Badge>
              <Badge 
                variant={filter === "unread" ? "default" : "outline"} 
                className="cursor-pointer hover:bg-secondary"
                onClick={() => setFilter("unread")}
              >
                Unread
              </Badge>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {chatsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No chats found
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredChats.map((chat) => (
                  <div 
                    key={chat.id} 
                    className={`p-3 flex items-start gap-2 hover:bg-muted/50 cursor-pointer transition-colors ${chat.id === selectedChatId ? 'bg-muted/50' : ''}`}
                    onClick={() => handleSelectChat(chat.id)}
                  >
                    <Checkbox 
                      checked={selectedContacts.includes(chat.contactId)}
                      onCheckedChange={() => {}}
                      onClick={(e) => handleSelectContact(chat.contactId, e)}
                      className="mt-1"
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(chat.contact)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${chat.unreadCount > 0 ? 'font-bold' : ''}`}>
                            {getContactName(chat.contact)}
                          </span>
                          {isWithin24Hours(chat) && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 px-1 py-0">
                              <Clock className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                          {chat.assignment && (
                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 px-1 py-0">
                              <UserPlus className="h-2.5 w-2.5 mr-0.5" />
                              {chat.assignment.assignedToUserName?.split(' ')[0] || 'Assigned'}
                            </Badge>
                          )}
                          {chat.unreadCount > 0 && (
                            <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-medium">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {chat.lastMessageTime ? formatTime(chat.lastMessageTime) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {chat.lastMessage || "No messages yet"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-zinc-900 bg-opacity-50 min-h-0 h-full ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
          {selectedChat ? (
            <>
              <div className="h-14 md:h-16 bg-background border-b border-border flex items-center justify-between px-2 md:px-6 flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="flex md:hidden h-9 w-9 shrink-0"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8 md:h-10 md:w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(selectedChat.contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm md:text-base truncate">{getContactName(selectedChat.contact)}</h3>
                    <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                      <span className="text-[10px] md:text-xs text-muted-foreground truncate">{selectedChat.contact.phone}</span>
                      {isWithin24Hours(selectedChat) && (
                        <Badge variant="outline" className="text-[9px] md:text-xs bg-green-50 text-green-700 border-green-200 py-0">
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                          24hr
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <Button variant="ghost" size="icon" className="hidden md:flex"><Phone className="h-5 w-5 text-muted-foreground" /></Button>
                  <Button variant="ghost" size="icon" className="hidden md:flex"><Video className="h-5 w-5 text-muted-foreground" /></Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5 text-muted-foreground" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => markAsUnreadMutation.mutate(selectedChat.contactId)}>
                        <MailOpen className="mr-2 h-4 w-4" />
                        Mark as Unread
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignDialogOpen(true)} className="text-blue-600">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assign Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBlockDialogOpen(true)} className="text-orange-600">
                        <Ban className="mr-2 h-4 w-4" />
                        Block Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-6">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'} group`}
                      >
                        <div className={`flex items-start gap-1 ${msg.direction === 'inbound' ? 'flex-row' : 'flex-row-reverse'}`}>
                          {msg.direction === 'inbound' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                              onClick={() => setReplyingTo(msg)}
                            >
                              <Reply className="h-3 w-3" />
                            </Button>
                          )}
                          <div 
                            className={`max-w-[85%] md:max-w-[70%] rounded-lg px-3 md:px-4 py-2 shadow-sm relative break-words
                              ${msg.direction === 'inbound' 
                                ? 'bg-white dark:bg-card text-card-foreground rounded-tl-none' 
                                : 'bg-[#d9fdd3] dark:bg-primary/20 text-foreground rounded-tr-none'
                              }
                            `}
                          >
                            {msg.replyToContent && (
                              <div className="mb-2 p-2 bg-black/5 dark:bg-white/10 rounded border-l-2 border-primary/50 text-xs text-muted-foreground">
                                <Reply className="h-3 w-3 inline mr-1" />
                                {msg.replyToContent.substring(0, 60)}
                                {msg.replyToContent.length > 60 && '...'}
                              </div>
                            )}
                            <div className="text-sm leading-relaxed">{renderMessageContent(msg)}</div>
                            <span className="text-[10px] text-muted-foreground/80 block text-right mt-1">
                              {formatTime(msg.timestamp)}
                              {msg.direction === 'outbound' && (
                                <span className={`ml-1 ${msg.status === 'read' ? 'text-blue-500' : msg.status === 'failed' ? 'text-red-500' : ''}`}>
                                  {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'failed' ? '✗' : '✓'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="p-2 md:p-4 bg-background border-t border-border flex-shrink-0">
                {replyingTo && (
                  <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
                      <Reply className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground hidden md:inline">Replying to:</span>
                      <span className="truncate max-w-[150px] md:max-w-[300px]">{replyingTo.content}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyingTo(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-1 md:gap-2">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hidden md:flex">
                    <Smile className="h-6 w-6" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-10 md:w-10">
                    <Paperclip className="h-5 w-5 md:h-6 md:w-6" />
                  </Button>
                  <Input 
                    placeholder="Type a message..." 
                    className="flex-1 bg-secondary/50 border-none focus-visible:ring-1 text-sm h-9 md:h-10"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button 
                    size="icon" 
                    className="rounded-full h-9 w-9 md:h-10 md:w-10 shrink-0"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a chat to start messaging
            </div>
          )}
        </div>
      </div>
      </div>

      <Dialog open={isBulkSendOpen} onOpenChange={setIsBulkSendOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Message to {selectedContacts.length} Contacts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4 inline mr-2" />
              Note: Contacts outside the 24-hour window will only receive template messages. Custom messages work only for those within the window.
            </div>

            <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Custom
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Agent
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTemplate && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      {templates.find(t => t.id === selectedTemplate)?.content}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Custom Message</Label>
                  <Textarea 
                    placeholder="Type your message here..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Custom messages work only within the 24-hour window after customer contact.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Select AI Agent</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an AI Agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.filter(a => a.isActive).map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAgent && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      {agents.find(a => a.id === selectedAgent)?.description || "AI Agent will generate personalized responses."}
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkSendOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkSend} disabled={sendBulkMessageMutation.isPending}>
              {sendBulkMessageMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send to {selectedContacts.length} Contact{selectedContacts.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block {selectedChat ? getContactName(selectedChat.contact) : "this contact"}? 
              You will no longer receive messages from them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="blockReason">Reason (optional)</Label>
            <Textarea 
              id="blockReason"
              placeholder="Enter reason for blocking..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                if (selectedChat) {
                  blockContactMutation.mutate({
                    phone: selectedChat.contact.phone,
                    name: getContactName(selectedChat.contact),
                    reason: blockReason,
                  });
                }
              }}
            >
              Block Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedChat ? getContactName(selectedChat.contact) : "this contact"}? 
              This will permanently remove all chat history with this contact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (selectedChat) {
                  deleteContactMutation.mutate(selectedChat.contactId);
                }
              }}
            >
              Delete Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Assign {selectedChat ? getContactName(selectedChat.contact) : "this contact"} to a team member
              </p>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={selectedUserToAssign} onValueChange={setSelectedUserToAssign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={assignPriority} onValueChange={setAssignPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (selectedChat && selectedUserToAssign) {
                  assignLeadMutation.mutate({
                    contactId: selectedChat.contact.id,
                    phone: selectedChat.contact.phone,
                    contactName: getContactName(selectedChat.contact),
                    assignedToUserId: selectedUserToAssign,
                    priority: assignPriority,
                  });
                }
              }}
              disabled={!selectedUserToAssign || assignLeadMutation.isPending}
            >
              {assignLeadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Assign {selectedContacts.length} selected contact{selectedContacts.length > 1 ? 's' : ''} to a team member
              </p>
            </div>
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={selectedUserToAssign} onValueChange={setSelectedUserToAssign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {assignableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={assignPriority} onValueChange={setAssignPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (selectedContacts.length > 0 && selectedUserToAssign) {
                  bulkAssignMutation.mutate({
                    contactIds: selectedContacts,
                    assignedToUserId: selectedUserToAssign,
                    priority: assignPriority,
                  });
                }
              }}
              disabled={!selectedUserToAssign || bulkAssignMutation.isPending}
            >
              {bulkAssignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign {selectedContacts.length} Lead{selectedContacts.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
