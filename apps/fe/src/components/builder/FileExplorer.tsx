import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FileNode } from "@/lib/types";

interface FileExplorerProps {
  fileTree: FileNode[]
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const FileExplorer = ({ fileTree, selectedFile, onSelectFile }: FileExplorerProps) => {

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Files</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Browse generated files
        </p>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {fileTree.map((node) => (
          <FileTreeNode
            key={node.name}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const FileTreeNode = ({
  node,
  depth,
  selectedFile,
  onSelectFile,
}: FileTreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".tsx") || filename.endsWith(".ts")) {
      return <FileCode className="w-4 h-4 text-primary" />;
    }
    if (filename.endsWith(".json")) {
      return <FileJson className="w-4 h-4 text-accent-foreground" />;
    }
    if (filename.endsWith(".css")) {
      return <FileText className="w-4 h-4 text-chart-3" />;
    }
    if (filename.endsWith(".html")) {
      return <FileCode className="w-4 h-4 text-chart-1" />;
    }
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-accent-foreground shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-accent-foreground shrink-0" />
          )}
          <span className="text-sm text-foreground truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.name}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors text-left",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-accent/50 text-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      {getFileIcon(node.name)}
      <span className="text-sm truncate">{node.name}</span>
    </button>
  );
};

export default FileExplorer;
