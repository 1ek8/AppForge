import { Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";

interface PreviewPaneProps {
  selectedFile: string | null;
}

const PreviewPane = ({ selectedFile }: PreviewPaneProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header with tabs */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("code")}
            className={cn(
              "gap-2 h-8",
              activeTab === "code" && "bg-card shadow-sm"
            )}
          >
            <Code className="w-4 h-4" />
            Code
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("preview")}
            className={cn(
              "gap-2 h-8",
              activeTab === "preview" && "bg-card shadow-sm"
            )}
          >
            <Eye className="w-4 h-4" />
            Preview
          </Button>
        </div>

        {selectedFile && (
          <div className="text-sm text-muted-foreground font-mono">
            {selectedFile}
          </div>
        )}
      </div>

      {/* Content area - placeholder for Monaco Editor */}
      <div className="flex-1 flex items-center justify-center bg-background/50">
        {activeTab === "code" ? (
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Code className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Code Editor
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {selectedFile
                ? `Monaco Editor will be integrated here to display and edit: ${selectedFile}`
                : "Select a file from the explorer to view its code"}
            </p>
          </div>
        ) : (
          <div className="text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Live Preview
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Preview of your generated website will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
