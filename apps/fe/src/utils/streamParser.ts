import { ParsedArtifact, ParsedFile, Step } from "@/lib/types";

export class StreamParser {
    private buffer: string = '';
    private currentArtifact: ParsedArtifact | null = null;
    private steps: Step[] = [];
    private stepCounter: number = 0;

    parseChunk(chunk: string): { steps: Step[]; files: ParsedFile[]; isComplete: boolean } {
        this.buffer += chunk;

        if(!this.currentArtifact)
            this.extractArtifact();

        this.extractActions();

        const isComplete = this.buffer.includes('</boltArtifact>');

        return {
            steps: [...this.steps],
            files: this.currentArtifact?.files || [],
            isComplete
        };
    }

    private extractArtifact() {
        const artifactMatch = this.buffer.match(/<boltArtifact\s+id="([^"]*)"\s+title="([^"]*)"/);

        if(artifactMatch) {
            this.currentArtifact = {
                id: artifactMatch[1] || '',
                title: artifactMatch[2] || '',
                files: [],
                shellCommands: []
            };
        }
    }

    private extractActions() {
        const actionCompleteRegex = /<boltAction\s+type="([^"]*)"(?:\s+filePath="([^"]*)")?>([\s\S]*?)<\/boltAction>/g;

        let match;
        let lastIndex = 0;

        while((match = actionCompleteRegex.exec(this.buffer)) != null) {
            const [fullMatch, type, filePath, content] = match;
            lastIndex = match.index + fullMatch.length;

            const actionId = `${type}-${filePath || this.stepCounter}`;
            if(this.steps.find(s => `${s.type}-${s.filePath || s.id}` === actionId)){
                continue;
            }

            this.stepCounter++;

            if(type === 'file' && filePath){
                const step: Step = {
                    id: this.stepCounter,
                    title: `Create ${filePath}`,
                    description: `Writing file ${filePath}`,
                    status: 'completed',
                    type: 'file',
                    content: content.trim()
                };
                this.steps.push(step);
            }

            if(this.currentArtifact) {
                this.currentArtifact.files.push({
                    type,
                    filePath,
                    content: content.trim()
                });
            } else if (type == 'shell'){
                const step: Step = {
                    id: this.stepCounter,
                    title: 'Run command',
                    description: content.trim(),
                    status: 'completed',
                    type: 'shell',
                    command: content.trim()
                };
                this.steps.push(step);

                if(this.currentArtifact) {
                    this.currentArtifact.shellCommands.push(content.trim());
                }
            }
        }
    }

    reset() {
        this.buffer = '';
        this.currentArtifact = null;
        this.steps = [];
        this.stepCounter = 0;
    }

}