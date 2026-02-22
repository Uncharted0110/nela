import React, { useState, useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

/** Copy button for a full assistant response */
const CopyMsgButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className="msg-copy-btn" onClick={handleCopy} title="Copy response">
      {copied ? (
        /* Check icon */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        /* Clipboard icon */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="2"/>
          <path d="M9 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
};

interface ChatWindowProps {
  messages: { role: string; content: string }[];
  streamingContent: string;
  isLoading: boolean;
  onSend: (text: string) => void;
  onCancel?: () => void;
  cancelled?: boolean;
  audioSrc?: string;
  placeholder?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  streamingContent,
  isLoading,
  onSend,
  onCancel,
  cancelled = false,
  audioSrc,
  placeholder = "Message NELA...",
}) => {
  const [inputObj, setInputObj] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = () => {
    if (!inputObj.trim()) return;
    onSend(inputObj);
    setInputObj("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.role === "user" ? (
              <>
                <div className="content">{msg.content}</div>
                <div className="avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="currentColor" />
                    <path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6v1H4v-1z" fill="currentColor" />
                  </svg>
                </div>
              </>
            ) : (
              <>
                <div className="avatar">AI</div>
                <div className="content">
                  <div className="assistant-body">
                    <MarkdownRenderer content={msg.content} />
                    <div className="msg-actions">
                      <CopyMsgButton text={msg.content} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message assistant loading">
            <div className="avatar">AI</div>
            <div className="content">
              {streamingContent ? (
                <MarkdownRenderer content={streamingContent} />
              ) : (
                <span className="typing-indicator">...</span>
              )}
            </div>
          </div>
        )}
        
        {/* Audio Player if generated */}
        {audioSrc && (
          <div className="audio-player">
            <audio controls src={audioSrc} autoPlay />
          </div>
        )}

        {/* Cancelled notice */}
        {cancelled && (
          <div className="cancelled-notice">
            ⏹ Response stopped
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            value={inputObj}
            onChange={(e) => setInputObj(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
          />
          {isLoading ? (
            <button className="stop-btn" onClick={onCancel} title="Stop generation">
              {/* Stop square icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </button>
          ) : (
            <button className="send-btn" onClick={handleSend} disabled={!inputObj.trim()}>
              {/* Arrow Icon SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
