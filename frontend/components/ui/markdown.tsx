"use client";

import React, { memo, useEffect, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

interface MarkdownProps {
  content: string;
  className?: string;
}

const REMARK_PLUGINS = [remarkGfm];

const CodeBlock: React.FC<{ language: string; value: string }> = memo(({ language, value }) => {
  const [copied, setCopied] = useState(false);
  const [syntaxHighlighter, setSyntaxHighlighter] =
    useState<typeof import("react-syntax-highlighter").PrismAsyncLight | null>(null);
  const [syntaxStyle, setSyntaxStyle] = useState<Record<string, CSSProperties> | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      import("react-syntax-highlighter"),
      import("react-syntax-highlighter/dist/esm/styles/prism"),
    ])
      .then(([highlighterModule, styleModule]) => {
        if (cancelled) {
          return;
        }
        setSyntaxHighlighter(() => highlighterModule.PrismAsyncLight);
        setSyntaxStyle(styleModule.vscDarkPlus as Record<string, CSSProperties>);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setSyntaxHighlighter(null);
        setSyntaxStyle(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadingCodeBlock = (
    <pre
      className="m-0 overflow-x-auto bg-[#1e1e1e] p-4 text-sm leading-6 text-gray-100"
      style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
    >
      <code>{value}</code>
    </pre>
  );
  const SyntaxHighlighter = syntaxHighlighter;

  return (
    <div className="rounded-xl overflow-hidden my-4 border border-[var(--border-light)] shadow-sm relative group/code">
      <div className="bg-[#1e1e1e] px-4 py-2 text-xs text-gray-400 flex justify-between items-center border-b border-white/5">
        <span className="font-mono">{language}</span>
        <button
          onClick={handleCopy}
          type="button"
          className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      {SyntaxHighlighter && syntaxStyle ? (
        <SyntaxHighlighter
          style={syntaxStyle}
          language={language}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            background: "#1e1e1e",
          }}
        >
          {value}
        </SyntaxHighlighter>
      ) : (
        loadingCodeBlock
      )}
    </div>
  );
});

CodeBlock.displayName = "CodeBlock";

const MARKDOWN_COMPONENTS = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "";
    const value = String(children).replace(/\n$/, "");

    if (!inline && match) {
      return <CodeBlock language={language} value={value} />;
    }
    return (
      <code
        className="bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded-md text-brand-600 font-medium text-[0.85em] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  p: ({ children }: any) => <p className="mb-4 last:mb-0 leading-relaxed text-sm">{children}</p>,
  h1: ({ children }: any) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-[var(--text-primary)]">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mb-3 mt-5 first:mt-0 text-[var(--text-primary)]">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-bold mb-2 mt-4 first:mt-0 text-[var(--text-primary)]">{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-4 space-y-1 text-sm">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm">{children}</ol>,
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-brand-300 pl-4 italic my-4 text-[var(--text-secondary)] text-sm">
      {children}
    </blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-6 border border-[var(--border-light)] rounded-xl">
      <table className="min-w-full divide-y divide-[var(--border-light)]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-[var(--bg-secondary)]">{children}</thead>,
  th: ({ children }: any) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] border-t border-[var(--border-light)]">
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-t border-[var(--border-light)]" />,
  a: ({ children, href }: any) => (
    <a
      href={href}
      className="text-brand-600 hover:underline font-medium"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

const MarkdownBase: React.FC<MarkdownProps> = ({ content, className = "" }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative group ${className}`}>
      <button
        onClick={handleCopy}
        type="button"
        className="
          absolute -top-2 -right-2 p-1.5 rounded-lg
          bg-[var(--bg-elevated)] border border-[var(--border-light)]
          text-[var(--text-tertiary)] hover:text-brand-600 hover:border-brand-300
          transition-all duration-200 opacity-40 group-hover:opacity-100
          z-10 shadow-sm cursor-pointer
        "
        title="Copy Markdown"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="max-w-none text-[var(--text-primary)]">
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export const Markdown = memo(MarkdownBase);
