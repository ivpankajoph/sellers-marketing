import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { getAuthHeaders } from "@/contexts/AuthContext";
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
  Clock,
  CheckSquare,
  Bot,
  FileText,
  MessageSquare,
  Reply,
  X,
  MailOpen,
  Ban,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  Agent,
  Chat,
  Contact,
  ImportedContact,
  Message,
  Template,
} from "./type";

// Normalize phone number for comparison (strip all non-digits)
async function downloadMediaWithAuth(
  mediaUrl: string,
  filename: string,
  openInNewTab: boolean = false
) {
  try {
    const response = await fetch(`/api/webhook/whatsapp/media/${mediaUrl}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to download media");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (openInNewTab) {
      window.open(url, "_blank");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Media download error:", error);
    toast.error("Failed to download file. Please try again.");
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export default function WindowInbox() {
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
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Notification sound
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastUnreadCountRef = useRef<number>(0);
  const audioUnlockedRef = useRef<boolean>(false);

  // Initialize notification audio
  useEffect(() => {
    // Create audio element with a simple beep sound (base64 encoded short beep)
    const beepSound =
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telehs/hMGyjnYsT2fJ0sJxIBw4d7O5s4VYQXzQ182bhlltndzV0JqJe3aap7KopZmRjI+TmJ6cmZePhoJ+fHx8fH2AgYSGiYyPkZOVlZaWlpWUkpCNioaDgX9+fX19fn+BhIiMkJOXmpyenp6dnJqXlJGOioaDgYB/f4CBg4aJjZCTlpmbnZ2dnJqYlZKPjImGhIKBgICAgIGChYiLjpGUl5manJ2dnJuZl5WSkI2KiIaEg4KCgoKDhIaIi42QkpWXmZqbnJybmpiWlJKQjoqJh4aFhISEhISFhoiKjI6QkpSWmJmam5uamZeWlJKQjoyKiIeGhoWFhYWGh4iKjI6QkpSVl5iZmZmYl5aUkpCOjIqIh4aFhYWFhYaHiImLjI6QkpOVlpeYmJiXlpWUkpCOjIqIh4aFhYWFhYaHiImLjY+QkpOVlpeXl5eWlZSSkI+NjIqIh4aFhYWFhoaHiImLjI6PkZKUlZaWlpaVlJOSkI+NjIqJh4aGhYaGhoaHiImKjI2PkJGTlJWVlZWVlJOSkI+OjIuJiIeGhoaGhoaHiImKi42OkJGSk5SUlJSUk5KRkI+OjIuKiYiHh4aGh4eHiImKi4yNj5CRkpOTk5OTkpGQj46NjIuKiYiHh4eHh4eIiImKi4yNjpCQkZGSEpKSkZCPj46NjIuKiYiIh4eHh4iIiImKi4yNjo+QkZGRkZGRkI+Pjo2MjIuKiYmIiIeIiIiIiYmKi4yNjo+PkJCQkJCQj4+OjY2MjIuKiomIiIiIiIiJiYqKi4yNjY6Pj4+Pj4+Pjo6NjYyMi4uKiomJiIiIiIiJiYqKi4yMjY2Ojo6Ojo6OjY2NjIyMi4uKiomJiYiJiYmJiYqKi4uMjI2NjY2NjY2NjY2MjIyMi4uLioqJiYmJiYmJioqKi4uMjIyMjY2NjY2NjI2MjIyMi4uLioqKiomJiYmJiYqKiouLi4yMjI2NjY2MjIyMjIyMi4yLi4uKioqJiYmJiYqKioqLi4uMjIyMjIyMjIyMjIyMi4uLi4uKi4qKioqKioqKioqLi4uLjIyMjIyMjIyMjIyLi4uLi4uLioqKioqKioqKioqLi4uLi4yMjIyMjIyMjIuLi4uLi4uLioqKioqKioqKioqKi4uLi4yMjIyMjIyLi4uLi4uLi4uKioqKioqKioqKi4uLi4uLi4yMjIyMi4uLi4uLi4uLioqKioqKioqKioqLi4uLi4uMjIyMi4uLi4uLi4uLi4qKioqKioqKioqLi4uLi4uLjIyLi4uLi4uLi4uLi4qKioqKioqKioqLi4uLi4uLi4uLi4uLi4uLi4uLioqKioqKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKioqLi4uLi4uLi4uLi4uLi4uLi4uLioqKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4uKioqKi4uLi4uLi4uLi4uLi4uLi4uLi4uKioqLi4uLi4uLi4uLi4uLi4uLi4uLi4qKioqLi4uLi4uLi4uLi4uLi4uLi4uLi4qKi4uLi4uLi4uLi4uLi4uLi4uLi4uLioqLi4uLi4uLi4uLi4uLi4uLi4uLi4uKi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4qLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLg==";
    notificationAudioRef.current = new Audio(beepSound);
    notificationAudioRef.current.volume = 0.5;

    // Unlock audio on user interaction - mark as unlocked immediately
    const unlockAudio = () => {
      // Mark as unlocked after first user interaction
      audioUnlockedRef.current = true;

      if (notificationAudioRef.current) {
        // Try to play silently to fully unlock autoplay restrictions
        notificationAudioRef.current
          .play()
          .then(() => {
            notificationAudioRef.current?.pause();
            notificationAudioRef.current!.currentTime = 0;
          })
          .catch(() => {
            // Ignore errors - audio is still marked as unlocked
          });
      }
    };

    // Add listeners for common user interactions
    const events = ["click", "keydown", "touchstart"];
    events.forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, unlockAudio);
      });
    };
  }, []);

  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ["/api/chats/window"],
    queryFn: async () => {
      const res = await fetch("/api/chats", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch chats");
      const allChats = await res.json();
      const now = new Date();
      return allChats
        .filter((chat: Chat) => {
          if (chat.lastInboundMessageTime) {
            const lastInbound = new Date(chat.lastInboundMessageTime);
            const hoursDiff =
              (now.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
            return hoursDiff <= 24;
          }
          return false;
        })
        .map((chat: Chat) => ({
          ...chat,
          windowExpiresAt: chat.lastInboundMessageTime
            ? new Date(
                new Date(chat.lastInboundMessageTime).getTime() +
                  24 * 60 * 60 * 1000
              ).toISOString()
            : undefined,
        }));
    },
    refetchInterval: 3000, // Auto-refresh every 3 seconds
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

  // Fetch contacts for name lookup
  const { data: importedContacts = [] } = useQuery<ImportedContact[]>({
    queryKey: ["/api/contacts"],
    queryFn: async () => {
      const res = await fetch("/api/contacts");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });

  // Create phone-to-name lookup maps for flexible matching (memoized)
  // Only include contacts with real names (not auto-generated "WhatsApp XXX" names)
  const { phoneToNameMap, last10ToNameMap } = useMemo(() => {
    const phoneMap = new Map<string, string>();
    const last10Map = new Map<string, string>();

    // Helper to check if name is a real name (not auto-generated)
    const isRealName = (name: string): boolean => {
      if (!name || !name.trim()) return false;
      if (name.startsWith("WhatsApp")) return false;
      if (name.startsWith("+")) return false;
      // Check if it's just digits (possibly with spaces)
      if (/^\d[\d\s]*$/.test(name)) return false;
      return true;
    };

    importedContacts.forEach((contact) => {
      const normalizedPhone = normalizePhone(contact.phone);
      if (isRealName(contact.name)) {
        // Store with full number
        phoneMap.set(normalizedPhone, contact.name);
        // Store with last 10 digits for matching with/without country code
        if (normalizedPhone.length >= 10) {
          last10Map.set(normalizedPhone.slice(-10), contact.name);
        }
      }
    });

    return { phoneToNameMap: phoneMap, last10ToNameMap: last10Map };
  }, [importedContacts]);

  // Function to get contact name from phone
  const getContactName = useMemo(() => {
    return (chatContact: Contact): string => {
      const normalizedPhone = normalizePhone(chatContact.phone);

      // First check if the chat contact already has a real name (not phone-based)
      if (
        chatContact.name &&
        !chatContact.name.startsWith("WhatsApp") &&
        !chatContact.name.startsWith("+") &&
        !/^\d+$/.test(chatContact.name.replace(/\s/g, ""))
      ) {
        return chatContact.name;
      }

      // Look up name from imported contacts - try exact match first
      let name = phoneToNameMap.get(normalizedPhone);
      if (name) return name;

      // Try matching with last 10 digits (handles country code differences)
      if (normalizedPhone.length >= 10) {
        const last10 = normalizedPhone.slice(-10);
        name = last10ToNameMap.get(last10);
        if (name) return name;
      }

      // Fallback to formatted phone number
      return chatContact.phone.startsWith("+")
        ? chatContact.phone
        : `+${chatContact.phone}`;
    };
  }, [phoneToNameMap, last10ToNameMap]);

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
              onClick={() => downloadMediaWithAuth(mediaUrl, "image.jpg", true)}
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

  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const selectedContactId = selectedChat?.contactId;

  // Play notification sound when new messages arrive
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    const totalUnread = chats.reduce(
      (sum, chat) => sum + (chat.unreadCount || 0),
      0
    );

    // Skip initial mount to avoid playing sound on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastUnreadCountRef.current = totalUnread;
      return;
    }

    // Play sound if unread count increased (new message received)
    if (totalUnread > lastUnreadCountRef.current) {
      if (notificationAudioRef.current && audioUnlockedRef.current) {
        notificationAudioRef.current.currentTime = 0;
        notificationAudioRef.current.play().catch(() => {});
      }
    }

    lastUnreadCountRef.current = totalUnread;
  }, [chats]);

  const { data: messages = [], isLoading: messagesLoading } = useQuery<
    Message[]
  >({
    queryKey: ["/api/messages", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const res = await fetch(`/api/messages?contactId=${selectedContactId}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedContactId,
    refetchInterval: 2000, // Auto-refresh messages every 2 seconds
  });

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
      // Send via WhatsApp API
      const waRes = await fetchWithAuth("/api/webhook/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          message: content,
        }),
      });

      if (!waRes.ok) {
        const error = await waRes.json();
        throw new Error(error.error || "Failed to send WhatsApp message");
      }

      // Also save to local storage for inbox display
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

      if (!res.ok) {
        console.error("Failed to save message locally, but WhatsApp sent");
      }

      return { waResult: await waRes.json(), contactId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/messages", data.contactId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chats/window"] });
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

      for (const contactId of data.contacts) {
        const chat = chats.find((c) => c.contactId === contactId);
        if (!chat) continue;

        const phone = chat.contact.phone.replace(/\D/g, "");
        const name = chat.contact.name;
        const templateObj = templates.find((t) => t.id === selectedTemplate);

        try {
          const res = await fetchWithAuth("/api/inbox/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId,
              phone,
              name,
              messageType: data.messageType,
              templateName: templateObj?.name,
              customMessage:
                data.messageType === "custom" ? data.content : undefined,
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
      queryClient.invalidateQueries({ queryKey: ["/api/chats/window"] });
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

  useEffect(() => {
    if (chats.length > 0 && !selectedChatId) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // Mark messages as read when selecting a chat
  const markAsReadMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetchWithAuth(`/api/chats/${contactId}/mark-read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats/window"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/chats/window"] });
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
          reason: "Blocked from 24-hour window",
        }),
      });
      if (!res.ok) throw new Error("Failed to block contact");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chats/window"] });
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
    setMobileView("chat");
    const chat = chats.find((c) => c.id === chatId);
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

  const handleSelectAll = () => {
    if (selectedContacts.length === chats.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(chats.map((c) => c.contactId));
    }
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
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
      const template = templates.find((t) => t.id === selectedTemplate);
      content = template?.content || "";
    } else if (messageType === "custom") {
      content = customMessage;
    } else if (messageType === "ai") {
      content = `[AI Agent: ${
        agents.find((a) => a.id === selectedAgent)?.name || "Unknown"
      }]`;
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

  const handleDownload = () => {
    const data = chats.map((chat) => ({
      name: chat.contact.name,
      phone: chat.contact.phone,
      email: chat.contact.email || "",
      lastMessage: chat.lastMessage || "",
      windowExpires: chat.windowExpiresAt || "",
    }));

    const headers = [
      "Name",
      "Phone",
      "Email",
      "Last Message",
      "Window Expires",
    ];
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        [
          row.name,
          row.phone,
          row.email,
          `"${row.lastMessage}"`,
          row.windowExpires,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "24hour_window_contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("List downloaded successfully");
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
      return `${minutes} min ago`;
    } else if (hours < 24) {
      return `${hours} hr ${minutes} min ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return "Unknown";
    const expires = new Date(expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} hr ${minutes} min left`;
  };

  const getInitials = (contact: Contact) => {
    const displayName = getContactName(contact);
    if (displayName.startsWith("+")) {
      return displayName.slice(-2);
    }
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const filteredChats = chats
    .filter(
      (chat) =>
        chat.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.contact.phone.includes(searchQuery)
    )
    .sort((a, b) => {
      const aTime =
        a.lastMessageTime ||
        a.lastInboundMessageTime ||
        a.windowExpiresAt ||
        "";
      const bTime =
        b.lastMessageTime ||
        b.lastInboundMessageTime ||
        b.windowExpiresAt ||
        "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  const approvedTemplates = templates.filter((t) => t.status === "approved");

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] flex flex-col gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between gap-2 flex-shrink-0 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          <div>
            <h2 className="text-lg md:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 md:h-7 md:w-7 text-primary" />
              24-Hour Window Inbox
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground hidden md:block">
              Customers who messaged in the last 24 hours. Send free-form
              messages without templates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="md:size-default"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Download List</span>
            </Button>
            {selectedContacts.length > 0 && (
              <Button
                size="sm"
                className="md:size-default"
                onClick={() => setIsBulkSendOpen(true)}
              >
                <Send className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Send to</span>{" "}
                {selectedContacts.length}
              </Button>
            )}
          </div>
        </div>

        <div
          className={`flex items-center gap-2 md:gap-4 p-2 md:p-3 bg-muted/50 rounded-lg flex-shrink-0 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          <Checkbox
            checked={
              selectedContacts.length === chats.length && chats.length > 0
            }
            onCheckedChange={handleSelectAll}
          />
          <span className="text-xs md:text-sm font-medium">
            Select All ({chats.length} contacts)
          </span>
          {selectedContacts.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedContacts.length} selected
            </Badge>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div
            className={`w-full md:w-80 lg:w-96 md:border-r border-border flex flex-col bg-background min-h-0 h-full ${
              mobileView === "chat" ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-3 md:p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  className="pl-9 bg-secondary/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center px-4">
                  <Clock className="h-12 w-12 mb-4 opacity-50" />
                  <p>No contacts in 24-hour window</p>
                  <p className="text-xs mt-1">
                    Contacts appear here when they message you
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`p-3 flex items-start gap-2 hover:bg-muted/50 cursor-pointer transition-colors ${
                        chat.id === selectedChatId ? "bg-muted/50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedContacts.includes(chat.contactId)}
                        onCheckedChange={() =>
                          handleSelectContact(chat.contactId)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      <div
                        className="flex-1 flex items-start gap-2"
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
                              <span
                                className={`text-sm font-medium truncate ${
                                  chat.unreadCount > 0 ? "font-bold" : ""
                                }`}
                              >
                                {getContactName(chat.contact)}
                              </span>
                              {chat.unreadCount > 0 && (
                                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-medium">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {chat.lastInboundMessageTime
                                ? formatTime(chat.lastInboundMessageTime)
                                : ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {chat.lastInboundMessage || "New customer message"}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-green-50 text-green-700 border-green-200 mt-1 py-0"
                          >
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {getTimeRemaining(chat.windowExpiresAt)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div
            className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-zinc-900 bg-opacity-50 min-h-0 h-full ${
              mobileView === "list" ? "hidden md:flex" : "flex"
            }`}
          >
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
                      <h3 className="font-medium text-sm md:text-base truncate">
                        {getContactName(selectedChat.contact)}
                      </h3>
                      <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                        <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                          {selectedChat.contact.phone}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] md:text-xs bg-green-50 text-green-700 border-green-200 py-0"
                        >
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                          {getTimeRemaining(selectedChat.windowExpiresAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:flex"
                    >
                      <Phone className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:flex"
                    >
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

                <ScrollArea className="flex-1 min-h-0 p-3 md:p-6">
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
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
                                onClick={() => setReplyingTo(msg)}
                              >
                                <Reply className="h-3 w-3" />
                              </Button>
                            )}
                            <div
                              className={`
                                max-w-[85%] md:max-w-[70%] rounded-lg px-3 md:px-4 py-2 shadow-sm relative break-words
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
                <div className="p-2 md:p-4 bg-background border-t border-border flex-shrink-0">
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs md:text-sm min-w-0">
                        <Reply className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground hidden md:inline">
                          Replying to:
                        </span>
                        <span className="truncate max-w-[150px] md:max-w-[300px]">
                          {replyingTo.content}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setReplyingTo(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground hidden md:flex"
                    >
                      <Smile className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-10 md:w-10"
                    >
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
                      disabled={
                        !messageInput.trim() || sendMessageMutation.isPending
                      }
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
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
                <Clock className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-50" />
                <p className="text-base md:text-lg font-medium text-center">
                  Select a contact to chat
                </p>
                <p className="text-xs md:text-sm text-center">
                  Send messages without templates within the 24-hour window
                </p>
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
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm text-green-700 dark:text-green-400">
              <Clock className="h-4 w-4 inline mr-2" />
              All selected contacts are within the 24-hour window. You can send
              custom messages without templates.
            </div>

            <Tabs
              value={messageType}
              onValueChange={(v) => setMessageType(v as any)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="template"
                  className="flex items-center gap-2"
                >
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
                  <Select
                    value={selectedTemplate}
                    onValueChange={setSelectedTemplate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedTemplates.map((template) => (
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
                      {
                        templates.find((t) => t.id === selectedTemplate)
                          ?.content
                      }
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
                    Custom messages work only within the 24-hour window after
                    customer contact.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Select AI Agent</Label>
                  <Select
                    value={selectedAgent}
                    onValueChange={setSelectedAgent}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an AI Agent" />
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
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">
                      {agents.find((a) => a.id === selectedAgent)
                        ?.description ||
                        "AI Agent will generate personalized responses."}
                    </p>
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
              onClick={handleBulkSend}
              disabled={sendBulkMessageMutation.isPending}
            >
              {sendBulkMessageMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send to {selectedContacts.length} Contact
              {selectedContacts.length > 1 ? "s" : ""}
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
