import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

/** Recursively extract plain text from React nodes (handles rehype-highlight spans). */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(element.props.children);
  }
  return "";
}

/**
 * Copy-to-clipboard button for code blocks.
 */
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older webview versions
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button className="code-copy-btn" onClick={handleCopy} title="Copy code">
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
};

/**
 * Custom component overrides for react-markdown.
 * Handles: code blocks with copy button + language label, links opening externally, etc.
 */
const markdownComponents: Components = {
  // Code blocks (``` ```) and inline code (` `)
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = extractText(children).replace(/\n$/, "");

    // If it has a language class or is multi-line, render as a block
    const isBlock = match || codeString.includes("\n");

    if (isBlock) {
      return (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-lang">{match?.[1] || "code"}</span>
            <CopyButton text={codeString} />
          </div>
          <pre className="code-block">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    }

    // Inline code
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  },

  // Links open in external browser (important for Tauri)
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="md-link"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Tables get a scrollable wrapper
  table({ children, ...props }) {
    return (
      <div className="table-wrapper">
        <table className="md-table" {...props}>
          {children}
        </table>
      </div>
    );
  },

  // Blockquotes
  blockquote({ children, ...props }) {
    return (
      <blockquote className="md-blockquote" {...props}>
        {children}
      </blockquote>
    );
  },
};

/**
 * Pre-process markdown so that table cells render correctly:
 *  - Convert literal "<br>" text to actual <br/> tags
 *  - Turn "- item" bullet patterns inside table cells into bullet characters
 *    separated by <br/> since markdown lists can't nest inside GFM table cells.
 */
function preprocessMarkdown(md: string): string {
  return md.replace(
    // Match a full GFM table row: | cell | cell | ...
    /^(\|.+\|)$/gm,
    (_match, row: string) => {
      return row
        // Literal <br> / <br/> / <br /> (case-insensitive) → real line-break tag
        .replace(/<br\s*\/?>/gi, "<br/>")
        // "- text" bullet pattern → bullet character (with line break before it
        // unless it's at the very start of the cell)
        .replace(/(?<=\|\s*)-\s+/g, "• ")
        .replace(/<br\/>\s*-\s+/g, "<br/>• ");
    }
  );
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const processed = preprocessMarkdown(content);
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={markdownComponents}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
