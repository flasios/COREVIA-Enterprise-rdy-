import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare,
  Users,
  Video,
  Send,
  Phone,
  X as _X,
  Circle,
  Minimize2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from 'react-i18next';

interface ChatMessage {
  id: string;
  senderId: string;
  recipientId?: string;
  message: string;
  createdAt: Date;
  senderName?: string;
}

interface VideoCallState {
  isActive: boolean;
  recipientId?: string;
  recipientName?: string;
}

export default function CollaborationPanel() {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const { isConnected, onlineUsers, send, subscribe } = useWebSocket();
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [videoCall, setVideoCall] = useState<VideoCallState>({ isActive: false });
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number>();

  // Subscribe to chat messages
  useEffect(() => {
    const unsubscribe = subscribe("chat:message", (payload: ChatMessage) => {
      setMessages((prev) => [...prev, payload]);
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to chat history
  useEffect(() => {
    const unsubscribe = subscribe("chat:history", (payload: ChatMessage[]) => {
      setMessages(payload.reverse());
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to typing indicators
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsubscribe = subscribe("chat:typing", (payload: any) => {
      if (payload.isTyping && payload.userId !== currentUser?.id) {
        setTypingUsers((prev) => new Set(prev).add(payload.userId));
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(payload.userId);
            return next;
          });
        }, 3000);
      }
    });

    return unsubscribe;
  }, [subscribe, currentUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Request chat history when selecting a user
  useEffect(() => {
    if (selectedUser && currentUser) {
      send({
        type: "chat:history",
        payload: {
          userId: currentUser.id,
          recipientId: selectedUser,
          limit: 100,
        },
      });
    }
  }, [selectedUser, currentUser, send]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !currentUser || !selectedUser) return;

    send({
      type: "chat:message",
      payload: {
        senderId: currentUser.id,
        recipientId: selectedUser,
        message: newMessage,
      },
    });

    setNewMessage("");
  };

  const handleTyping = () => {
    if (selectedUser && currentUser) {
      send({
        type: "chat:typing",
        payload: {
          userId: currentUser.id,
          recipientId: selectedUser,
          isTyping: true,
        },
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        send({
          type: "chat:typing",
          payload: {
            userId: currentUser.id,
            recipientId: selectedUser,
            isTyping: false,
          },
        });
      }, 1000);
    }
  };

  const startVideoCall = (recipientId: string, recipientName: string) => {
    setVideoCall({
      isActive: true,
      recipientId,
      recipientName,
    });

    send({
      type: "video:call-start",
      payload: {
        recipientId,
        callerId: currentUser?.id,
        callerName: currentUser?.displayName,
      },
    });
  };

  const endVideoCall = () => {
    if (videoCall.recipientId) {
      send({
        type: "video:call-end",
        payload: {
          recipientId: videoCall.recipientId,
        },
      });
    }

    setVideoCall({ isActive: false });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "text-green-500";
      case "away":
        return "text-yellow-500";
      case "busy":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const selectedUserPresence = onlineUsers.find((u) => u.userId === selectedUser);
  const filteredMessages = messages.filter(
    (m) =>
      (m.senderId === currentUser?.id && m.recipientId === selectedUser) ||
      (m.senderId === selectedUser && m.recipientId === currentUser?.id)
  );

  if (isMinimized) {
    return (
      <Button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 rounded-full h-14 w-14 shadow-lg z-50"
        size="icon"
        data-testid="button-expand-collaboration"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[600px] shadow-2xl z-50 flex flex-col">
      <CardHeader className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('collaboration.panel.title')}
            {isConnected && (
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-7 w-7 p-0"
              data-testid="button-minimize-collaboration"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="flex-shrink-0 grid w-full grid-cols-2 mx-4 mt-2">
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            {t('collaboration.panel.chat')}
          </TabsTrigger>
          <TabsTrigger value="online" data-testid="tab-online-users">
            <Users className="h-4 w-4 mr-2" />
            {t('collaboration.panel.onlineCount', { count: onlineUsers.length })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden mt-2 px-4">
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-center p-4 text-muted-foreground">
              <div>
                <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>{t('collaboration.panel.selectUser')}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="flex-shrink-0 flex items-center justify-between mb-2 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(selectedUserPresence?.userId || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {onlineUsers.find((u) => u.userId === selectedUser)?.displayName || selectedUser}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Circle className={`h-2 w-2 fill-current ${getStatusColor(selectedUserPresence?.status || "offline")}`} />
                      {selectedUserPresence?.status || "offline"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const user = onlineUsers.find((u) => u.userId === selectedUser);
                    if (user) {
                      startVideoCall(user.userId, user.userId);
                    }
                  }}
                  className="h-8"
                  data-testid="button-start-video-call"
                >
                  <Video className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 pr-3">
                <div className="space-y-3">
                  {filteredMessages.map((msg) => {
                    const isOwn = msg.senderId === currentUser?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {formatDistanceToNow(new Date(msg.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Typing Indicator */}
              {typingUsers.has(selectedUser) && (
                <div className="flex-shrink-0 text-xs text-muted-foreground py-1">
                  <span className="italic">{t('collaboration.panel.typing')}</span>
                </div>
              )}

              {/* Message Input */}
              <div className="flex-shrink-0 flex gap-2 mt-2">
                <Input
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                  placeholder={t('collaboration.panel.typeMessage')}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  size="sm"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="online" className="flex-1 overflow-hidden mt-2 px-4">
          <ScrollArea className="h-full">
            <div className="space-y-2 pr-3">
              {onlineUsers.map((presence) => (
                <div
                  key={presence.userId}
                  className="flex items-center justify-between p-2 rounded-lg hover-elevate cursor-pointer"
                  onClick={() => {
                    setSelectedUser(presence.userId);
                    setActiveTab("chat");
                  }}
                  data-testid={`user-presence-${presence.userId}`}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getInitials(presence.userId)}
                        </AvatarFallback>
                      </Avatar>
                      <Circle
                        className={`absolute bottom-0 right-0 h-3 w-3 border-2 border-background rounded-full fill-current ${getStatusColor(presence.status)}`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{presence.displayName || presence.userId}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {presence.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        startVideoCall(presence.userId, presence.userId);
                      }}
                      className="h-8 w-8 p-0"
                      data-testid={`button-call-${presence.userId}`}
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {onlineUsers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>{t('collaboration.panel.noUsersOnline')}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Video Call Modal */}
      {videoCall.isActive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <Card className="w-[800px] h-[600px] flex flex-col">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('collaboration.panel.videoCallWith', { name: videoCall.recipientName })}</CardTitle>
              <Button
                variant="destructive"
                size="sm"
                onClick={endVideoCall}
                data-testid="button-end-video-call"
              >
                <Phone className="h-4 w-4 mr-2" />
                {t('collaboration.panel.endCall')}
              </Button>
            </CardHeader>
            <CardContent className="flex-1 bg-gray-900 flex items-center justify-center">
              <div className="text-white text-center">
                <Video className="h-16 w-16 mx-auto mb-4" />
                <p className="text-lg">{t('collaboration.panel.videoCallInProgress')}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {t('collaboration.panel.webRtcPlaceholder')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
