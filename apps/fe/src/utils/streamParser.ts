import { ParsedArtifact, ParsedFile, Step } from "@/lib/types";

export class StreamParser {
    private buffer: string = '';
    private currentArtifact: ParsedArtifact | null = null;
    private steps: Step[] = [];
    private stepCounter: number = 0;
    private processedActions: Set<string> = new Set();
    private allFiles: Map<string, ParsedFile > = new Map();

    resetForNextArtifact() {
        this.buffer = '';
        this.currentArtifact = null;
        this.processedActions.clear();
    }

    parseChunk(chunk: string): { steps: Step[]; files: ParsedFile[]; isComplete: boolean } {
        console.log('📥 CHUNK RECEIVED:', chunk.length, 'chars');
        this.buffer += chunk;
        console.log('📦 Buffer size:', this.buffer.length, 'chars');

        if(!this.currentArtifact){
            this.extractArtifact();
            if(this.currentArtifact){
                console.log('Found artifact with id:', this.currentArtifact.id, ' and title - ', this.currentArtifact.title);
            }
        }

        const actionsBefore = this.steps.length;
        this.extractActions();
        const actionsAfter = this.steps.length;

        if(actionsBefore < actionsAfter){
            console.log(`extracted ${actionsAfter - actionsBefore} actions`);
        }

        const lastStart = this.buffer.lastIndexOf('<boltArtifact');
        const isComplete = lastStart !== -1 && this.buffer.indexOf('</boltArtifact>', lastStart) !== -1;
        if(isComplete){
            console.log('ACTION COMPLETE')
        }

        return {
            steps: [...this.steps],
            files: Array.from(this.allFiles.values()),
            isComplete
        };
    }

    private extractArtifact() {
        const artifactMatch = this.buffer.match(/<boltArtifact\s+id="([^"]*)"\s+title="([^"]*)"/);

        if(artifactMatch) {
            const [, id, title] = artifactMatch;
            console.log('Extracted artifact metadata:');
            console.log('   ID:', id);
            console.log('   Title:', title);
            this.currentArtifact = {
                id,
                title,
                files: [],
                shellCommands: []
            };
        }
    }

    private extractActions() {
        const actionCompleteRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;

        let match;

        while((match = actionCompleteRegex.exec(this.buffer)) != null) {
            const [fullMatch, type, filePath, content] = match;
            const matchPosition = match.index;
            const actionId = `${matchPosition}-${type}-${filePath || "command"}`;
            
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
                console.log(`  ${isUpdate ? 'Updated' : 'Added'} file: ${filePath}`);

                if(this.currentArtifact) {
                    const existingIndex = this.currentArtifact.files.findIndex(f => f.filePath === filePath);
                    if (existingIndex !== -1) {
                        this.currentArtifact.files[existingIndex] = parsedFile;
                    } else {
                    this.currentArtifact.files.push(parsedFile);
                    }
                }
                this.processedActions.add(actionId);
            } else if (type == 'shell'){
                const step: Step = {
                    id: this.stepCounter++,
                    title: 'Run command',
                    description: content.trim(),
                    status: 'completed',
                    type: 'shell',
                    command: content.trim() || ""
                };

                this.steps.push(step);

                if(this.currentArtifact) {
                    this.currentArtifact.shellCommands.push(content.trim() || "");
                }

                this.processedActions.add(actionId);
            }
        }
    }

    reset() {
        this.buffer = '';
        this.currentArtifact = null;
        this.steps = [];
        this.processedActions.clear();
        this.stepCounter = 0;
    }

}