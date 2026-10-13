"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/mail/types";

// Sandboxed iframe: no scripts, no same-origin. Remote images are blocked by CSP
// until the user opts in (tracking-pixel protection).
export function MessageFrame({ message }: { message: Message }) {
  const [images, setImages] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);

  const body = message.html ?? `<pre style="white-space:pre-wrap;font:inherit">${escapeHtml(message.text ?? "")}</pre>`;
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src data: ${images ? "https: http:" : ""}`;
  const doc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:0;font:14px system-ui,sans-serif;color:#18181b;word-wrap:break-word}img{max-width:100%;height:auto}</style>${body}`;

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const resize = () => {
      const h = f.contentDocument?.documentElement.scrollHeight;
      if (h) f.style.height = `${h + 8}px`;
    };
    f.addEventListener("load", resize);
    return () => f.removeEventListener("load", resize);
  }, [doc]);

  return (
    <div>
      {message.html && !images && (
        <button onClick={() => setImages(true)} className="mb-2 text-xs text-blue-600 underline">
          Load remote images
        </button>
      )}
      <iframe
        ref={ref}
        title={`Message ${message.id}`}
        sandbox="allow-popups allow-same-origin"
        srcDoc={doc}
        className="w-full rounded bg-white"
      />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
