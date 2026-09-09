import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  streaming: boolean;
  className?: string;
}

const ChatPanel = ({ messages, onSend, streaming, className }: ChatPanelProps) => {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || streaming) return;
    onSend(text);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("flex flex-col bg-card border-t border-border", className)}>
      {messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-4 py-2 space-y-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "text-sm rounded-lg px-3 py-2 whitespace-pre-wrap break-words",
                message.role === "user"
                  ? "bg-primary/10 text-foreground"
                  : "bg-muted/40 text-muted-foreground"
              )}
            >
              {message.content}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? "Generating response..." : "Follow up — edit, fix, or extend the app..."}
          disabled={streaming}
          rows={1}
          className="flex-1 min-h-[40px] max-h-32 resize-none bg-background border border-input rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleSubmit}
          disabled={streaming || !input.trim()}
          className="h-10 w-10 shrink-0"
          aria-label="Send follow-up"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default ChatPanel;