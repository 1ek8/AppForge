import { Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";

interface PreviewPaneProps {
  fileContent: string;
  selectedFile: string | null;
}

const PreviewPane = ({ selectedFile, fileContent }: PreviewPaneProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");

  const getLanguage = (filename: string | null): string => {
    if (!filename) return 'plaintext';
    if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return 'typescript';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header with tabs */}
      <div className="p-3 bo  rder-b border-border flex items-center justify-between shrink-0">
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
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" ? (
          selectedFile && fileContent ? (
            <Editor
              height="100%"
              language={getLanguage(selectedFile)}
              value={fileContent}
              theme="vs-dark"
              options={
                {
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true
                }
              }
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <Code className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No File Selected
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Select a file from the explorer to view its code
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Live Preview
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Preview functionality will be integrated with WebContainers
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
