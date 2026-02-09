import { ParsedArtifact, ParsedFile, Step } from "@/lib/types";

export class StreamParser {
    private buffer: string = '';
    private currentArtifact: ParsedArtifact | null = null;
    private steps: Step[] = [];
    private stepCounter: number = 0;
    private processedActions: Set<string> = new Set(); 

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

        const isComplete = this.buffer.includes('</boltArtifact>');
        if(isComplete){
            console.log('ACTION COMPLETE')
        }

        return {
            steps: [...this.steps],
            files: this.currentArtifact?.files || [],
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
        // let lastIndex = 0;

        while((match = actionCompleteRegex.exec(this.buffer)) != null) {
            const [fullMatch, type, filePath, content] = match;
            // lastIndex = match.index + fullMatch.length;

            const actionId = `${type}-${filePath || "command"}`;
            if(this.processedActions.has(actionId)){
                console.log(`Skipping duplicate action: ${actionId}`);
                continue;
            }

            this.processedActions.add(actionId);

            if(type === 'file' && filePath){
                const step: Step = {
                    id: this.stepCounter,
                    title: `Create ${filePath}`,
                    description: `Writing file ${filePath}`,
                    status: 'completed',
                    type: 'file',
                    content: content.trim() || ""
                };

                this.steps.push(step);

                if(this.currentArtifact) {
                    this.currentArtifact.files.push({
                        type,
                        filePath,
                        content: content.trim() || ""
                    });
    
                } 
                this.stepCounter++;
                continue;
            } else if (type == 'shell'){
                const step: Step = {
                    id: this.stepCounter,
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

                this.stepCounter++;
                continue;
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