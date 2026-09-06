import { ParsedArtifact, ParsedFile, Step } from "@/lib/types";

export interface CompletedAction {
  type: 'file' | 'shell';
  filePath?: string;
  command?: string;
}

export interface OpenAction {
  type: 'file' | 'shell';
  filePath?: string;
}

export interface ParseResult {
  steps: Step[];
  files: ParsedFile[];
  isComplete: boolean;
  openAction: OpenAction | null;
  completedActions: CompletedAction[];
}

export class StreamParser {
    private buffer: string = '';
    private currentArtifact: ParsedArtifact | null = null;
    private steps: Step[] = [];
    private stepCounter: number = 0;
    private processedActions: Set<string> = new Set();
    private allFiles: Map<string, ParsedFile> = new Map();
    private actionCompleteRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;
    private lastProcessedEnd = 0;

    resetForNextArtifact() {
        this.buffer = '';
        this.currentArtifact = null;
        this.processedActions.clear();
        this.lastProcessedEnd = 0;
    }

    reset() {
        this.resetForNextArtifact();
        this.steps = [];
        this.stepCounter = 0;
        this.allFiles.clear();
    }

    parseChunk(chunk: string): ParseResult {
        this.buffer += chunk;

        if(!this.currentArtifact){
            this.extractArtifact();
        }

        const completedActions = this.extractActions();

        const lastStart = this.buffer.lastIndexOf('<boltArtifact');
        const isComplete = lastStart !== -1 && this.buffer.indexOf('</boltArtifact>', lastStart) !== -1;

        return {
            steps: [...this.steps],
            files: Array.from(this.allFiles.values()),
            isComplete,
            openAction: this.trackOpenAction(),
            completedActions
        };
    }

    private extractArtifact() {
        const artifactMatch = this.buffer.match(/<boltArtifact\s+id="([^"]*)"\s+title="([^"]*)"/);

        if(artifactMatch) {
            const [, id, title] = artifactMatch;
            this.currentArtifact = {
                id,
                title,
                files: [],
                shellCommands: []
            };
        }
    }

    private extractActions(): CompletedAction[] {
        const completedActions: CompletedAction[] = [];

        const OPEN_TAG_SAFETY = 96;
        this.actionCompleteRegex.lastIndex = Math.max(0, this.lastProcessedEnd - OPEN_TAG_SAFETY);

        let match;
        while((match = this.actionCompleteRegex.exec(this.buffer)) != null) {
            const [fullMatch, type, filePath, content] = match;
            const matchPosition = match.index;
            const actionId = `${matchPosition}-${type}-${filePath || "command"}`;

            this.lastProcessedEnd = match.index + fullMatch.length;

            if(this.processedActions.has(actionId)){
                continue;
            }

            const trimmed_content = content.trim() || "";

            if(type === 'file' && filePath){

                const isUpdate = this.allFiles.get(filePath) !== undefined;

                const step: Step = {
                    id: this.stepCounter++,
                    title: `${isUpdate ? 'Update' : 'Create'} ${filePath}`,
                    description: isUpdate ? `Updating file ${filePath}` : `Writing file ${filePath}`,
                    status: 'completed',
                    type: 'file',
                    content: trimmed_content
                };

                this.steps.push(step);

                const parsedFile: ParsedFile = {
                    type,
                    filePath,
                    content: content.trim() || ""
                }

                this.allFiles.set(filePath, parsedFile);

                if(this.currentArtifact) {
                    const existingIndex = this.currentArtifact.files.findIndex(f => f.filePath === filePath);
                    if (existingIndex !== -1) {
                        this.currentArtifact.files[existingIndex] = parsedFile;
                    } else {
                        this.currentArtifact.files.push(parsedFile);
                    }
                }

                completedActions.push({ type: 'file', filePath });

            } else if (type == 'shell'){
                const step: Step = {
                    id: this.stepCounter++,
                    title: 'Run command',
                    description: content.trim(),
                    status: 'completed',
                    type: 'shell',
                    command: trimmed_content
                };

                this.steps.push(step);

                if(this.currentArtifact) {
                    this.currentArtifact.shellCommands.push(trimmed_content);
                }

                completedActions.push({ type: 'shell', command: trimmed_content });
            }

            this.processedActions.add(actionId);
        }

        return completedActions;
    }

    private trackOpenAction(): OpenAction | null {
        let lastOpen: RegExpMatchArray | null = null;
        const openActionRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?\s*>/g;
        let openMatch;

        while((openMatch = openActionRegex.exec(this.buffer)) != null) {
            const openEnd = openMatch.index + openMatch[0].length;
            if (openEnd <= this.lastProcessedEnd) continue;
            lastOpen = openMatch;
        }

        if(!lastOpen) return null;

        const type = lastOpen[1] === 'shell' ? 'shell' as const : 'file' as const;
        return {
            type,
            filePath: lastOpen[2]
        };
    }

}