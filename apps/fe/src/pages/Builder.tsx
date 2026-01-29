import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepsPane from "@/components/builder/StepsPane";
import FileExplorer from "@/components/builder/FileExplorer";
import PreviewPane from "@/components/builder/PreviewPane";

const Builder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prompt = location.state?.prompt || "No prompt provided";

  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-4 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">WebForge</span>
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground truncate max-w-2xl">
            {prompt}
          </div>
        </div>
      </header>

      {/* Main Content - Three Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Steps Pane - 30% */}
        <div className="w-[30%] border-r border-border overflow-hidden flex flex-col">
          <StepsPane prompt={prompt} />
        </div>

        {/* File Explorer - 25% */}
        <div className="w-[25%] border-r border-border overflow-hidden flex flex-col">
          <FileExplorer
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        </div>

        {/* Preview/Code Pane - 45% */}
        <div className="w-[45%] overflow-hidden flex flex-col">
          <PreviewPane selectedFile={selectedFile} />
        </div>
      </div>
    </div>
  );
};

export default Builder;
