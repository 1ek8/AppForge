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

export type PhaseKey = 'templating' | 'building' | 'running';

export interface Phase {
  key: PhaseKey;
  status: 'idle' | 'running' | 'done' | 'error';
  current: string | null;
  summary: string | null;
  ledger: string[];
  error?: string | null;
}

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
}