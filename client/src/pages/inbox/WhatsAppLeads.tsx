import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Users,
  CheckSquare,
  Bot,
  FileText,
  MessageSquare,
  Reply,
  X,
  MailOpen,
  UserPlus,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

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

interface Chat {
  id: string;
  contactId: string;
  contact: Contact;
  lastMessage?: string;
  lastMessageTime?: string;
  lastInboundMessageTime?: string;
  lastInboundMessage?: string;
  unreadCount: number;
  status: string;
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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default function WhatsAppLeads() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isBulkSendOpen, setIsBulkSendOpen] = useState(false);
  const [messageType, setMessageType] = useState<"template" | "custom" | "ai">(
    "custom"
  );
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastUnreadCountRef = useRef<number>(0);
  const audioUnlockedRef = useRef<boolean>(false);

  useEffect(() => {
    const beepSound =
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telehs/hMGyjnYsT2fJ0sJxIBw4d7O5s4VYQXzQ182bhlltndzV0JqJe3aap7KopZmRjI+TmJ6cmZePhoJ+fHx8fH2AgYSGiYyPkZOVlZaWlpWUkpCNioaDgX9+fX19fn+BhIiMkJOXmpyenp6dnJqXlJGOioaDgYB/f4CBg4aJjZCTlpmbnZ2dnJqYlZKPjImGhIKBgICAgIGChYiLjpGUl5manJ2dnJuZl5WSkI2KiIaEg4KCgoKDhIaIi42QkpWXmZqbnJybmpiWlJKQjoqJh4aFhISEhISFhoiKjI6QkpSWmJmam5uamZeWlJKQjoyKiIeGhoWFhYWGh4iKjI6QkpSVl5iZmZmYl5aUkpCOjIqIh4aFhYWFhYaHiImLjI6QkpOVlpeYmJiXlpWUkpCOjIqIh4aFhYWFhoaHiImLjY+QkpOVlpeXl5eWlZSSkI+NjIqIh4aFhYWFhoaHiImLjI6PkZKUlZaWlpaVlJOSkI+NjIqJh4aGhYaGhoaHiImKjI2PkJGTlJWVlZWVlJOSkI+OjIuJiIeGhoaGhoaHiImKi42OkJGSk5SUlJSUk5KRkI+OjIuKiYiHh4aGh4eHiImKi4yNj5CRkpOTk5OTkpGQj46NjIuKiYiHh4eHh4eIiImKi4yNjo+QkZGRkZGRkI+Pjo2MjIuKiYmIiIeIiIiIiYmKi4yNjo+PkJCQkJCQj4+OjY2MjIuKiomIiIiIiIiJiYqKi4yNjY6Pj4+Pj4+Pjo6NjYyMi4uKiomJiIiIiIiJiYqKi4yMjY2Ojo6Ojo6OjY2NjIyMi4uKiomJiYiJiYmJiYqKi4uMjI2NjY2NjY2NjY2MjIyMi4uLioqJiYmJiYmJioqKi4uMjIyMjY2NjY2NjI2MjIyMi4uLioqKiomJiYmJiYqKioqLi4uMjIyMjIyMjIyMjIyMi4uLi4uKi4qKioqKioqKioqLi4uLjIyMjIyMjIyMjIyLi4uLi4uLioqKioqKioqKioqLi4uLi4yMjIyMjIyMjIuLi4uLi4uLioqKioqKioqKioqKi4uLi4yMjIyMjIyLi4uLi4uLi4uKioqKioqKioqKi4uLi4uLi4yMjIyMi4uLi4uLi4uLi4qKioqKioqKioqLi4uLi4uMjIyLi4uLi4uLi4uLi4qKioqKioqKioqLi4uLi4uLi4uLi4uLi4uLi4uLioqKioqKioqLi4uLi4uLi4uLi4uLi4uLi4uLioqKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4uKioqLi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqLi4uLi4uLi4uLi4uLi4uLi4uLi4qKi4uLi4uLi4uLi4uLi4uLi4uLi4uLioqLi4uLi4uLi4uLi4uLi4uLi4uLi4uKi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4qLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4u...";
    notificationAudioRef.current = new Audio(beepSound);
    notificationAudioRef.current.volume = 0.5;

    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      if (notificationAudioRef.current) {
        notificationAudioRef.current.play().catch(() => {});
        notificationAudioRef.current.pause();
        notificationAudioRef.current.currentTime = 0;
      }
    };

    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats/whatsapp-leads"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

    if (
      totalUnread > lastUnreadCountRef.current &&
      audioUnlockedRef.current &&
      notificationAudioRef.current
    ) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current
        .play()
        .catch((err) => console.log("Audio play failed:", err));
    }

    lastUnreadCountRef.current = totalUnread;
  }, [chats]);

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId),
    [chats, selectedChatId]
  );

  const selectedContactId = selectedChat?.contactId;

  const { data: messages = [], isLoading: messagesLoading } = useQuery<
    Message[]
  >({
    queryKey: ["/api/messages", selectedContactId],
    enabled: !!selectedContactId,
  });

  const filteredChats = useMemo(() => {
    let result = chats;

    if (filterTab === "unread") {
      result = result.filter((chat) => chat.unreadCount > 0);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (chat) =>
          chat.contact.name.toLowerCase().includes(query) ||
          chat.contact.phone.includes(query)
      );
    }

    return result;
  }, [chats, searchQuery, filterTab]);

  const getContactName = (contact: Contact) => {
    if (
      contact.name &&
      !contact.name.startsWith("WhatsApp ") &&
      !contact.name.startsWith("+")
    ) {
      return contact.name;
    }
    return contact.phone;
  };

  const getInitials = (contact: Contact) => {
    const name = getContactName(contact);
    if (name.startsWith("+") || name.match(/^\d/)) {
      return name.slice(-2);
    }
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const renderMessageContent = (msg: Message) => {
    const content = msg.content;
    const mediaUrl = msg.mediaUrl;

    if (msg.type === "image" || content.startsWith("[Image")) {
      if (mediaUrl) {
        const caption = content
          .replace(/^\[Image\]\s*/, "")
          .replace(/^\[Image message\]$/, "");
        return (
          <div className="space-y-2">
            <img
              src={`/api/webhook/whatsapp/media/${mediaUrl}`}
              alt="Shared image"
              className="max-w-[280px] max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() =>
                window.open(`/api/webhook/whatsapp/media/${mediaUrl}`, "_blank")
              }
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (
                  e.target as HTMLImageElement
                ).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">
              Image expired or unavailable
            </span>
            {caption && <p className="text-sm">{caption}</p>}
          </div>
        );
      }
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          📷 {content}
        </span>
      );
    } else if (msg.type === "video" || content.startsWith("[Video")) {
      if (mediaUrl) {
        const caption = content
          .replace(/^\[Video\]\s*/, "")
          .replace(/^\[Video message\]$/, "");
        return (
          <div className="space-y-2">
            <video
              src={`/api/webhook/whatsapp/media/${mediaUrl}`}
              controls
              className="max-w-[280px] max-h-[300px] rounded-lg"
              onError={(e) => {
                (e.target as HTMLVideoElement).style.display = "none";
                (
                  e.target as HTMLVideoElement
                ).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">
              Video expired or unavailable
            </span>
            {caption && <p className="text-sm">{caption}</p>}
          </div>
        );
      }
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          🎥 {content}
        </span>
      );
    } else if (msg.type === "audio" || content.startsWith("[Audio")) {
      if (mediaUrl) {
        return (
          <div className="space-y-2">
            <audio
              src={`/api/webhook/whatsapp/media/${mediaUrl}`}
              controls
              className="max-w-[280px]"
              onError={(e) => {
                (e.target as HTMLAudioElement).style.display = "none";
                (
                  e.target as HTMLAudioElement
                ).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">
              Audio expired or unavailable
            </span>
          </div>
        );
      }
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          🎵 {content}
        </span>
      );
    } else if (msg.type === "sticker" || content.startsWith("[Sticker")) {
      if (mediaUrl) {
        return (
          <div>
            <img
              src={`/api/webhook/whatsapp/media/${mediaUrl}`}
              alt="Sticker"
              className="max-w-[150px] max-h-[150px]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (
                  e.target as HTMLImageElement
                ).nextElementSibling?.classList.remove("hidden");
              }}
            />
            <span className="hidden text-muted-foreground italic text-sm">
              Sticker expired or unavailable
            </span>
          </div>
        );
      }
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          🎨 {content}
        </span>
      );
    } else if (msg.type === "document" || content.startsWith("[Document")) {
      if (mediaUrl) {
        const filename =
          content.match(/\[Document: ([^\]]+)\]/)?.[1] || "document";
        return (
          <a
            href={`/api/webhook/whatsapp/media/${mediaUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            <span className="text-lg">📄</span>
            <span className="text-sm underline">{filename}</span>
          </a>
        );
      }
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          📄 {content}
        </span>
      );
    } else if (content.startsWith("[Location")) {
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          📍 {content}
        </span>
      );
    } else if (content.startsWith("[Contact")) {
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          👤 {content}
        </span>
      );
    } else if (content.startsWith("[Reaction")) {
      return <span className="flex items-center gap-1">{content}</span>;
    } else if (content.startsWith("[Unsupported")) {
      return (
        <span className="flex items-center gap-1 text-muted-foreground italic">
          ⚠️ {content}
        </span>
      );
    }

    return <span>{content}</span>;
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({
      content,
      phone,
      contactId,
      replyToMessageId,
      replyToContent,
    }: {
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
          message: replyToContent
            ? `> ${replyToContent.substring(0, 50)}${
                replyToContent.length > 50 ? "..." : ""
              }\n\n${content}`
            : content,
        }),
      });

      if (!waRes.ok) {
        const error = await waRes.json();
        throw new Error(error.error || "Failed to send WhatsApp message");
      }

      const res = await fetchWithAuth("/api/messages", {
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

      if (!res.ok) throw new Error("Failed to save message");
      return { result: await res.json(), contactId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/messages", data.contactId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chats/whatsapp-leads"],
      });
      setMessageInput("");
      setReplyingTo(null);
      toast.success("Message sent via WhatsApp");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const sendBulkMessageMutation = useMutation({
    mutationFn: async (data: {
      contacts: string[];
      messageType: string;
      content: string;
    }) => {
      const results: { success: number; failed: number } = {
        success: 0,
        failed: 0,
      };

      for (const chatId of data.contacts) {
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) continue;

        const phone = chat.contact.phone.replace(/\D/g, "");

        try {
          await fetchWithAuth("/api/webhook/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: phone,
              message: data.content,
            }),
          });

          await fetchWithAuth("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId: chat.contactId,
              content: data.content,
              type: "text",
              direction: "outbound",
              status: "sent",
            }),
          });

          results.success++;
        } catch {
          results.failed++;
        }
      }

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats/whatsapp-leads"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setSelectedContacts([]);
      setIsBulkSendOpen(false);
      setCustomMessage("");
      setSelectedTemplate("");
      setSelectedAgent("");
      if (data.failed > 0) {
        toast.success(
          `Sent to ${data.success} contacts, ${data.failed} failed`
        );
      } else {
        toast.success(
          `Message sent to ${data.success} contact${
            data.success > 1 ? "s" : ""
          }`
        );
      }
    },
    onError: () => {
      toast.error("Failed to send messages");
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetchWithAuth(`/api/chats/${contactId}/mark-read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats/whatsapp-leads"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
    },
  });

  const markAsUnreadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetchWithAuth(`/api/chats/${contactId}/mark-unread`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as unread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats/whatsapp-leads"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      toast.success("Marked as unread");
    },
  });

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [contactToBlock, setContactToBlock] = useState<{
    phone: string;
    name: string;
  } | null>(null);

  const blockContactMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      const res = await fetchWithAuth("/api/contacts/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name,
          reason: "Blocked from WhatsApp Leads",
        }),
      });
      if (!res.ok) throw new Error("Failed to block contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chats/whatsapp-leads"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chats"] });
      setBlockDialogOpen(false);
      setContactToBlock(null);
      setSelectedChatId(null);
      toast.success("Contact blocked successfully");
    },
    onError: () => {
      toast.error("Failed to block contact");
    },
  });

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    const chat = chats.find((c) => c.id === chatId);
    if (chat && chat.unreadCount > 0) {
      markAsReadMutation.mutate(chat.contactId);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedChat || !selectedContactId) return;
    const phone = selectedChat.contact.phone.replace(/\D/g, "");

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(filteredChats.map((c) => c.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (chatId: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, chatId]);
    } else {
      setSelectedContacts(selectedContacts.filter((id) => id !== chatId));
    }
  };

  const handleBulkSend = () => {
    if (selectedContacts.length === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    setIsBulkSendOpen(true);
  };

  const handleConfirmBulkSend = () => {
    let content = "";

    if (messageType === "template") {
      const template = templates.find((t) => t.id === selectedTemplate);
      content = template?.content || "";
    } else if (messageType === "custom") {
      content = customMessage;
    } else if (messageType === "ai") {
      const agent = agents.find((a) => a.id === selectedAgent);
      content = agent?.description || "AI agent will respond";
    }

    if (!content) {
      toast.error("Please enter a message or select a template");
      return;
    }

    sendBulkMessageMutation.mutate({
      contacts: selectedContacts,
      messageType,
      content,
    });
  };

  const handleDownloadList = () => {
    const csvContent = [
      ["Name", "Phone", "Last Message", "Last Message Time"].join(","),
      ...filteredChats.map((chat) =>
        [
          getContactName(chat.contact),
          chat.contact.phone,
          `"${(chat.lastInboundMessage || "").replace(/"/g, '""')}"`,
          chat.lastInboundMessageTime || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col gap-4">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              WhatsApp Leads
            </h2>
            <p className="text-sm text-muted-foreground">
              New contacts who messaged you (not in your contact list). Assign
              AI agents based on their first message.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedContacts.length > 0 && (
              <Button onClick={handleBulkSend} className="gap-2">
                <Send className="h-4 w-4" />
                Send to {selectedContacts.length} Selected
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDownloadList}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download List
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="w-96 border-r border-border flex flex-col bg-background min-h-0">
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    selectedContacts.length === filteredChats.length &&
                    filteredChats.length > 0
                  }
                  onCheckedChange={(checked) =>
                    handleSelectAll(checked as boolean)
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Select All ({filteredChats.length} leads)
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Tabs
                value={filterTab}
                onValueChange={(v) => setFilterTab(v as "all" | "unread")}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="unread" className="gap-1">
                    Unread
                    {totalUnread > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-5 px-1.5 text-xs"
                      >
                        {totalUnread}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              {chatsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2" />
                  <p className="text-sm">No WhatsApp leads yet</p>
                  <p className="text-xs">New contacts will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`flex items-start gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedChatId === chat.id ? "bg-muted/50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedContacts.includes(chat.id)}
                        onCheckedChange={(checked) =>
                          handleSelectContact(chat.id, checked as boolean)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      <div
                        className="flex-1 min-w-0 flex items-start gap-2"
                        onClick={() => handleSelectChat(chat.id)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(chat.contact)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">
                                {getContactName(chat.contact)}
                              </span>
                              {chat.unreadCount > 0 && (
                                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-medium">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {chat.lastInboundMessage || "No message"}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 mt-1 py-0"
                          >
                            <UserPlus className="h-2.5 w-2.5 mr-0.5" />
                            New Lead
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {selectedChat ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedChat.contact)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      {getContactName(selectedChat.contact)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {selectedChat.contact.phone}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        WhatsApp Lead
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5 text-muted-foreground" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          markAsUnreadMutation.mutate(selectedChat.contactId)
                        }
                      >
                        <MailOpen className="mr-2 h-4 w-4" />
                        Mark as Unread
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          setContactToBlock({
                            phone: selectedChat.contact.phone,
                            name: selectedChat.contact.name,
                          });
                          setBlockDialogOpen(true);
                        }}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Block Contact
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.direction === "inbound"
                            ? "justify-start"
                            : "justify-end"
                        } group`}
                      >
                        <div
                          className={`flex items-start gap-1 ${
                            msg.direction === "inbound"
                              ? "flex-row"
                              : "flex-row-reverse"
                          }`}
                        >
                          {msg.direction === "inbound" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReplyingTo(msg)}
                            >
                              <Reply className="h-3 w-3" />
                            </Button>
                          )}
                          <div
                            className={`
                              max-w-[70%] rounded-lg px-4 py-2 shadow-sm relative
                              ${
                                msg.direction === "inbound"
                                  ? "bg-white dark:bg-card text-card-foreground rounded-tl-none"
                                  : "bg-[#d9fdd3] dark:bg-primary/20 text-foreground rounded-tr-none"
                              }
                            `}
                          >
                            {msg.replyToContent && (
                              <div className="mb-2 p-2 bg-black/5 dark:bg-white/10 rounded border-l-2 border-primary/50 text-xs text-muted-foreground">
                                <Reply className="h-3 w-3 inline mr-1" />
                                {msg.replyToContent.substring(0, 60)}
                                {msg.replyToContent.length > 60 && "..."}
                              </div>
                            )}
                            <div className="text-sm leading-relaxed">
                              {renderMessageContent(msg)}
                            </div>
                            <span className="text-[10px] text-muted-foreground/80 block text-right mt-1">
                              {formatTime(msg.timestamp)}
                              {msg.direction === "outbound" && (
                                <span
                                  className={`ml-1 ${
                                    msg.status === "read"
                                      ? "text-blue-500"
                                      : msg.status === "failed"
                                      ? "text-red-500"
                                      : ""
                                  }`}
                                >
                                  {msg.status === "read"
                                    ? "✓✓"
                                    : msg.status === "delivered"
                                    ? "✓✓"
                                    : msg.status === "failed"
                                    ? "✗"
                                    : "✓"}
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
                <ScrollBar
                  orientation="vertical"
                  className="w-1.5 bg-green-800 [&>div]:bg-muted-foreground/40"
                />
              </ScrollArea>

              <div className="p-4 bg-background border-t border-border">
                {replyingTo && (
                  <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Reply className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Replying to:
                      </span>
                      <span className="truncate max-w-[300px]">
                        {replyingTo.content}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setReplyingTo(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Smile className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Paperclip className="h-6 w-6" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    className="flex-1 bg-secondary/50 border-none focus-visible:ring-1"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                  <Button
                    size="icon"
                    className="rounded-full h-10 w-10"
                    onClick={handleSendMessage}
                    disabled={
                      !messageInput.trim() || sendMessageMutation.isPending
                    }
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Select a Lead</h3>
                <p className="text-sm">
                  Choose a lead from the list to view conversation
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isBulkSendOpen} onOpenChange={setIsBulkSendOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Send Message to {selectedContacts.length} Leads
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-400">
              <Users className="h-4 w-4 inline mr-2" />
              You can send custom messages to WhatsApp leads without template
              restrictions.
            </div>

            <Tabs
              value={messageType}
              onValueChange={(v) =>
                setMessageType(v as "template" | "custom" | "ai")
              }
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template" className="gap-1">
                  <FileText className="h-4 w-4" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="custom" className="gap-1">
                  <MessageSquare className="h-4 w-4" />
                  Custom
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1">
                  <Bot className="h-4 w-4" />
                  AI Agent
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select
                    value={selectedTemplate}
                    onValueChange={setSelectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates
                        .filter((t) => t.status === "APPROVED")
                        .map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTemplate && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {templates.find((t) => t.id === selectedTemplate)?.content}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Custom Message</Label>
                  <Textarea
                    placeholder="Type your message..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={4}
                  />
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Select AI Agent</Label>
                  <Select
                    value={selectedAgent}
                    onValueChange={setSelectedAgent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an AI agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents
                        .filter((a) => a.isActive)
                        .map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAgent && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {agents.find((a) => a.id === selectedAgent)?.description}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkSendOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmBulkSend}
              disabled={sendBulkMessageMutation.isPending}
            >
              {sendBulkMessageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to block{" "}
              {contactToBlock?.name || contactToBlock?.phone}? They will no
              longer be able to send you messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                contactToBlock && blockContactMutation.mutate(contactToBlock)
              }
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
