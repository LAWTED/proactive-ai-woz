"use client";

import { useEffect, useRef, useState } from "react";
import { HighlightWithinTextarea } from "react-highlight-within-textarea";

interface HighlightTextEditorProps {
  content: string;
  sessionId?: string;  // Make sessionId optional since it's not used
  onContentChange?: (content: string) => void;
  readOnly?: boolean;
  activeHighlight?: string;
}

type HighlightItem = string | {
  highlight: string;
  className?: string;
};

export default function HighlightTextEditor({
  content,
  onContentChange,
  readOnly = false,
  activeHighlight
}: HighlightTextEditorProps) {
  const [value, setValue] = useState(content);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle content updates
  useEffect(() => {
    setValue(content);
  }, [content]);

  // Handle active highlight changes
  useEffect(() => {
    if (activeHighlight) {
      // Add to highlights if not already there
      setHighlights(prev => {
        // Check if this text is already highlighted
        const exists = prev.some(h => {
          if (typeof h === "string") return h === activeHighlight;
          if (typeof h === "object" && h.highlight) return h.highlight === activeHighlight;
          return false;
        });

        if (!exists) {
          return [...prev, {
            highlight: activeHighlight,
            className: "highlight-suggestion"
          }];
        }
        return prev;
      });

      // Set as current highlight to scroll to it
      setCurrentHighlight(activeHighlight);
    } else {
      // Clear all highlights when activeHighlight is null
      setHighlights([]);
      setCurrentHighlight(null);
    }
  }, [activeHighlight]);

  // Scroll to current highlight when it changes
  useEffect(() => {
    if (currentHighlight && containerRef.current) {
      setTimeout(() => {
        try {
          const highlightElements =
            containerRef.current?.querySelectorAll(".highlight-suggestion");

          if (highlightElements && highlightElements.length > 0) {
            for (let i = 0; i < highlightElements.length; i++) {
              const element = highlightElements[i];
              if (element.textContent && element.textContent.includes(currentHighlight)) {
                element.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                // Add a temporary visual effect
                element.classList.add("highlight-active");
                setTimeout(() => {
                  element.classList.remove("highlight-active");
                }, 2000);
                break;
              }
            }
          }
        } catch (error) {
          console.error("Error scrolling to highlight:", error);
        }
      }, 300);
    }
  }, [currentHighlight]);

  // Handle content changes
  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (onContentChange) {
      onContentChange(newValue);
    }
  };

  // Handle text selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) return;

    // Could add callback here if needed
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[200px]"
      onMouseUp={handleMouseUp}
    >
      <style jsx global>{`
        .hwt-container {
          width: 100%;
          min-height: 200px;
        }
        .hwt-content {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid #ccc;
          border-radius: 4px;
          background-color: white;
          font-family: inherit;
          font-size: inherit;
          outline: none;
          overflow-y: auto;
        }
        .hwt-highlights {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid transparent;
          border-radius: 4px;
          color: transparent;
          overflow-y: auto;
        }
        .highlight-suggestion {
          background-color: rgba(255, 255, 0, 0.3);
          border-radius: 2px;
        }
        .highlight-active {
          background-color: rgba(255, 165, 0, 0.5);
          transition: background-color 0.5s ease;
        }
      `}</style>

      <HighlightWithinTextarea
        value={value}
        onChange={handleChange}
        highlight={highlights}
        placeholder="Start writing your content here..."
        readOnly={readOnly}
      />
    </div>
  );
}