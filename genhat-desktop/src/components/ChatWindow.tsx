import React, { useState, useEffect, useRef } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import { Api } from "../api";
import type { MediaAsset } from "../types";

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
  /** Media assets (images/tables) keyed by message index. */
  mediaAssets?: Record<number, MediaAsset[]>;
  /** Chat mode for picking which timer to display */
  chatMode?: string;
  /** TTS generation state */
  ttsGenerating?: boolean;
  ttsElapsedTime?: number;
  ttsGenerationTime?: number | null;
  /** General response time tracking for chat, vision, RAG */
  generalGenerating?: boolean;
  generalElapsedTime?: number;
  generalGenerationTime?: number | null;
}

/** Inline gallery for extracted images/tables attached to an assistant message. */
const MediaGallery: React.FC<{ assets: MediaAsset[] }> = ({ assets }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  // Load images as base64 data URLs via the backend (avoids asset-protocol issues)
  const [dataUrls, setDataUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!assets || assets.length === 0) return;
    let cancelled = false;

    const loadAll = async () => {
      const entries: [number, string][] = [];
      for (const asset of assets) {
        try {
          const dataUrl = await Api.readImageBase64(asset.file_path);
          if (!cancelled) entries.push([asset.id, dataUrl]);
        } catch (e) {
          console.warn(`Failed to load media ${asset.id}:`, e);
        }
      }
      if (!cancelled) {
        setDataUrls(Object.fromEntries(entries));
      }
    };

    loadAll();
    return () => { cancelled = true; };
  }, [assets]);

  if (!assets || assets.length === 0) return null;

  return (
    <div className="media-gallery">
      <div className="media-gallery-label">
        📎 {assets.length} related {assets.length === 1 ? "figure" : "figures"}
      </div>
      <div className="media-gallery-grid">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className={`media-thumb ${expanded === asset.id ? "expanded" : ""}`}
            onClick={() => setExpanded(expanded === asset.id ? null : asset.id)}
          >
            {dataUrls[asset.id] ? (
              <img
                src={dataUrls[asset.id]}
                alt={asset.caption || `${asset.asset_type} from document`}
                loading="lazy"
              />
            ) : (
              <div className="media-loading">Loading…</div>
            )}
            <span className="media-badge">
              {asset.asset_type === "table" ? "📊" : "🖼️"}
            </span>
            {expanded === asset.id && asset.caption && (
              <div className="media-caption">{asset.caption}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  streamingContent,
  isLoading,
  onSend,
  onCancel,
  cancelled = false,
  audioSrc,
  placeholder = "Message NELA...",
  mediaAssets = {},
  chatMode = "text",
  ttsGenerating = false,
  ttsElapsedTime = 0,
  ttsGenerationTime = null,
  generalGenerating = false,
  generalElapsedTime = 0,
  generalGenerationTime = null,
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
                    {mediaAssets[idx] && (
                      <MediaGallery assets={mediaAssets[idx]} />
                    )}
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
        
        {/* Response Time Timer - Audio Mode */}
        {chatMode === "audio" && ttsGenerating && (
          <div className="tts-timer">
            <div className="tts-timer-pulse" />
            <span className="tts-timer-text">
              Generating speech... <span className="tts-timer-value">{ttsElapsedTime.toFixed(1)}s</span>
            </span>
          </div>
        )}

        {/* Response Time Timer - Chat/Vision/RAG Modes */}
        {chatMode !== "audio" && generalGenerating && (
          <div className="tts-timer">
            <div className="tts-timer-pulse" />
            <span className="tts-timer-text">
              {chatMode === "vision" && "Analyzing image... "}
              {chatMode === "rag" && "Processing query... "}
              {chatMode === "text" && "Generating response... "}
              <span className="tts-timer-value">{generalElapsedTime.toFixed(1)}s</span>
            </span>
          </div>
        )}

        {/* Audio Player if generated */}
        {audioSrc && (
          <div className="audio-player">
            {ttsGenerationTime !== null && (
              <div className="tts-completion-time">
                Generated in {ttsGenerationTime.toFixed(1)}s
              </div>
            )}
            <audio controls src={audioSrc} autoPlay />
          </div>
        )}

        {/* Response time completion display for non-audio modes */}
        {chatMode !== "audio" && generalGenerationTime !== null && !generalGenerating && (
          <div className="response-completion-badge">
            <span className="response-time-indicator">✓</span>
            <span className="response-time-text">
              {chatMode === "vision" && `Analyzed in ${generalGenerationTime.toFixed(1)}s`}
              {chatMode === "rag" && `Processed in ${generalGenerationTime.toFixed(1)}s`}
              {chatMode === "text" && `Generated in ${generalGenerationTime.toFixed(1)}s`}
            </span>
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
