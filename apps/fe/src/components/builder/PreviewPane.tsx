import { Code, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { useWebContainer, WebContainerStatus } from "@/hooks/useWebContainer";
import { ParsedFile, Step } from "@/lib/types";

interface PreviewPaneProps {
  files: ParsedFile[];
  steps: Step[];
  fileContent: string;
  selectedFile: string | null;
  serverUrl: string | null;
  webContainerStatus: WebContainerStatus;
}

const STATUS_MESSAGES: Partial<Record<WebContainerStatus, string>> = {
  idle: 'Waiting for files...',
  booting: 'Booting WebContainer...',
  mounting: 'Mounting project files...',
  installing: 'Installing dependencies (npm install)...',
  starting: 'Starting dev server (npm run dev)...',
  error: 'Something went wrong — check the browser console for details.',
};

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

const PreviewPane = ({ selectedFile, fileContent, files, steps, serverUrl, webContainerStatus }: PreviewPaneProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");

  //count no. of steps executed so far while preventing infinite loops
  const processedSteps = useRef(new Set<number>());

  // useEffect(() => {
  //   if (!instance) return;

  //   const runSteps = async () => {
  //     for (const step of steps) {
  //       if (step.status === 'completed' && !processedSteps.current.has(step.id)) {
  //         processedSteps.current.add(step.id);
          
  //         if (step.type === 'file' && step.filePath) {
  //           const content = step.content || "";
  //           const pathParts = step.filePath.split('/');
            
  //           // Create nested directories if they exist
  //           if (pathParts.length > 1) {
  //             const dir = pathParts.slice(0, -1).join('/');
  //             try {
  //               await instance.fs.mkdir(dir, { recursive: true });
  //             } catch (error) {
  //               // Safely ignore if directory already exists
  //             }
  //           }
  //           // Write the file into the WebContainer instance
  //           try {
  //             await instance.fs.writeFile(step.filePath, content);
  //           } catch (error) {
  //             console.error('Error writing file', step.filePath, error);
  //           }
  //         } else if (step.type === 'shell') {
  //           const cmd = step.command || "";
  //           try {
  //             const process = await instance.spawn('jsh', ['-c', cmd]);
  //             process.output.pipeTo(new WritableStream({
  //               write(data) {
  //                 console.log('WebContainer Shell:', data);
  //               }
  //             }));
              
  //             // Only await completion if it's an installation command
  //             // Let dev servers (npm run dev / start) run in the background
  //             if (!cmd.includes('dev') && !cmd.includes('start')) {
  //               await process.exit;
  //             }
  //             else {
  //               process.exit.then((code) => {
  //                 if(code != 0) {
  //                   console.error(`Process exited with code ${code}`);
  //                 }
  //               });
  //             }
  //           } catch (error) {
  //             console.error('Error running command', cmd, error);
  //           }
  //         }
  //       }
  //     }
  //   };

  //   runSteps();
  //     }, [instance, steps]);

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

        {selectedFile && activeTab === "code" && (
          <div className="text-sm text-muted-foreground font-mono">
            {selectedFile}
          </div>
        )}
      </div>

      {/* Content area - placeholder for Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" ? (
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
                automaticLayout: true,
                wordWrap: 'on'
              }
            }
          />
          ) : webContainerStatus === 'ready' && serverUrl ? (
            <iframe
              src={serverUrl}
              className="w-full h-full border-0"
              title="App Preview"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
              {webContainerStatus === 'error' ? (
                <p className="text-destructive text-sm px-6 text-center">
                  {STATUS_MESSAGES.error}
                </p>
              ) : (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-sm">{STATUS_MESSAGES[webContainerStatus] ?? 'Loading...'}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
