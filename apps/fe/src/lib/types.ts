export interface ParsedFile {
  type: string;
  filePath: string;
  content: string;
}

export interface ParsedArtifact {
  id: string;
  title: string;
  files: ParsedFile[];
  shellCommands: string[];
}

export interface Step {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  type: 'file' | 'shell';
  filePath?: string;
  content?: string;
  command?: string;
}