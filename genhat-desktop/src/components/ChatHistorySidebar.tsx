import React from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import type { ChatSession } from "../types";

interface ChatHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}) => {
  return (
    <aside className="w-[280px] min-w-[280px] border-r border-glass-border bg-void-800/80 backdrop-blur-xl flex flex-col">
      <div className="h-14 px-4 border-b border-glass-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-txt">
          <MessageSquare size={16} className="text-neon" />
          <span className="text-[0.86rem] font-semibold">Chats</span>
        </div>
        <button
          className="glass-btn inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[0.78rem] text-txt-secondary hover:text-neon"
          onClick={onNewSession}
          title="New chat"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1.5">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const lastMessage = session.messages[session.messages.length - 1];
            const preview = lastMessage?.content?.trim() || "No messages yet";

            return (
              <button
                key={session.id}
                className={`group relative w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-150 ${
                  isActive
                    ? "bg-neon-subtle border-neon/30 text-txt shadow-[0_0_14px_rgba(0,212,255,0.08)]"
                    : "bg-void-700/65 border-glass-border text-txt-secondary hover:border-neon/20 hover:text-txt"
                }`}
                onClick={() => onSelectSession(session.id)}
                title={session.title}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[0.82rem] font-medium truncate">{session.title}</span>
                      <span className="text-[0.68rem] text-txt-muted shrink-0">{formatTimestamp(session.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[0.72rem] text-txt-muted leading-snug max-h-[2.4em] overflow-hidden">{preview}</p>
                  </div>
                  <span
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    title="Delete chat"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }
                    }}
                  >
                    <Trash2 size={14} className="text-txt-muted hover:text-danger" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default ChatHistorySidebar;
