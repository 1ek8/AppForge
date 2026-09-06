import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StepsPane from "@/components/builder/StepsPane";
import FileExplorer from "@/components/builder/FileExplorer";
import PreviewPane from "@/components/builder/PreviewPane";
import axios from 'axios';
import { FileNode, ParsedFile, Phase, PhaseKey, Step } from "@/lib/types";
import { StreamParser } from "@/utils/streamParser";
import { buildFileTree } from "@/utils/fileTreeBuilder";
import { useWebContainer } from "@/hooks/useWebContainer";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const createPhase = (key: PhaseKey): Phase => ({
  key,
  status: 'idle',
  current: null,
  summary: null,
  ledger: [],
  error: null,
});

const Builder = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prompt = location.state?.prompt || "No prompt provided";

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [phases, setPhases] = useState<Phase[]>([createPhase('templating'), createPhase('building'), createPhase('running')]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { instance, serverUrl, status, events, mountFiles, startDevServer, writeFile } = useWebContainer();
  const initCalled = useRef(false);
  const writtenFileContents = useRef(new Map<string, string>());
  const ledgeredFiles = useRef(new Set<string>());
  const processedEvents = useRef(0);

  const updatePhase = (key: PhaseKey, patch: Partial<Phase>) => {
    setPhases((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  useEffect(() => {
    if (events.length <= processedEvents.current) return;

    const newEvents = events.slice(processedEvents.current);
    processedEvents.current = events.length;

    for (const ev of newEvents) {
      if (ev.status === 'running') {
        updatePhase('running', { status: 'running', current: ev.label, error: null });
      } else if (ev.status === 'done') {
        setPhases((prev) =>
          prev.map((p) =>
            p.key === 'running'
              ? { ...p, current: null, ledger: [...p.ledger, ev.label] }
              : p
          )
        );
      } else if (ev.status === 'error') {
        updatePhase('running', { status: 'error', current: null, error: ev.error ?? 'WebContainer error' });
      }
    }
  }, [events]);

  useEffect(() => {
    if (status === 'ready' && serverUrl) {
      updatePhase('running', { status: 'done', current: null, summary: 'App ready' });
    }
  }, [status, serverUrl]);

  useEffect(() => {
    if(!instance || initCalled.current){
      console.error(`Waiting for webcontainer instance`);
      return;
    }

    initCalled.current = true;

    const init = async () => {
      const parser = new StreamParser();
        try {
          setIsLoading(true);

          updatePhase('templating', { status: 'running', current: "Setting up project's template", error: null });

          // Template processing

          const templateResponse = await axios.post(`${BACKEND_URL}/template`, {
            prompt
          });

          const { classification, userPrompt, templateLength, prompts } = templateResponse.data;

          if(!prompts || prompts.length === 0){
            throw new Error('No templates received from server')
          }

          let parsedSteps: Step[] = [];
          let parsedFiles: ParsedFile[] = [];

          for(const templatePrompt of prompts){
            const parsedResult = parser.parseChunk(templatePrompt);
            parsedSteps = parsedResult.steps;
            parsedFiles = parsedResult.files;
          }

          updatePhase('templating', {
            status: 'done',
            current: null,
            summary: `${parsedFiles.length} files created`,
            ledger: parsedFiles.map((f) => f.filePath)
          });

          setSteps(parsedSteps);
          setFiles(parsedFiles);

          const tree = buildFileTree(parsedFiles.map((f) => ({
            filePath: f.filePath,
            content: f.content
          })));

          setFileTree(tree);

          const contentMap = new Map<string, string>();
          parsedFiles.forEach((f) => {
            contentMap.set(f.filePath, f.content);
          });

          setFileContents(contentMap);

          if (parsedFiles.length > 0) {
              setSelectedFile(parsedFiles[0].filePath);
          }

          // Mounting + devServer start
          const filesToMount = parsedFiles.filter(f => f.type === 'file' && f.filePath && f.content !== undefined)
                              .map(f => ({ filePath: f.filePath, content: f.content }));

          await mountFiles(filesToMount);

          filesToMount.forEach(f => writtenFileContents.current.set(f.filePath, f.content));

          await startDevServer();

          parser.resetForNextArtifact();

          // Response streaming

          const codeResponse = await fetch(`${BACKEND_URL}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userPrompt,
              templateLength,
              prompts
            })
          });

          if(!codeResponse.ok){
            throw new Error('Failed to fetch chat response');
          }

          const reader = codeResponse.body?.getReader();
          const decoder = new TextDecoder();

          if(!reader) {
            throw new Error('No reader available');
          }

          while(true){
            const {done, value} = await reader.read();

            if(done) {
              setIsLoading(false);
              break;
            }

            const chunk = decoder.decode(value, { stream: true });

            const {
              steps: parsedSteps,
              files: parsedFiles,
              isComplete,
              openAction,
              completedActions
            } = parser.parseChunk(chunk);

            setSteps(parsedSteps);
            setFiles(parsedFiles);

            if (openAction && openAction.type === 'file' && openAction.filePath) {
              const isUpdate = writtenFileContents.current.has(openAction.filePath);
              updatePhase('building', {
                status: 'running',
                current: `${isUpdate ? 'Updating' : 'Creating'} ${openAction.filePath}`,
                error: null
              });
            } else if (completedActions.length > 0) {
              updatePhase('building', { current: null });
            }

            for(const file of parsedFiles) {
              const isUpdate = writtenFileContents.current.has(file.filePath);

              if(file.type === 'file' && file.filePath && file.content !== undefined && writtenFileContents.current.get(file.filePath) !== file.content){
                writtenFileContents.current.set(file.filePath, file.content);
                await writeFile(file.filePath, file.content);
              }

              if(!ledgeredFiles.current.has(file.filePath)){
                ledgeredFiles.current.add(file.filePath);
                const label = `${isUpdate ? 'Updating' : 'Creating'} ${file.filePath}`;
                setPhases((prev) =>
                  prev.map((p) =>
                    p.key === 'building' ? { ...p, status: 'running', ledger: [...p.ledger, label] } : p
                  )
                );
              }
            }

            const tree = buildFileTree(parsedFiles.map((f) => ({
              filePath: f.filePath,
              content: f.content
            })));

            setFileTree(tree);

            const contentMap = new Map<string, string>();
            parsedFiles.map((f) => {
              if(f.filePath){
                contentMap.set(f.filePath, f.content);
              }
            });
            setFileContents(contentMap);

            if(isComplete) {
              setIsLoading(false);
              updatePhase('building', {
                status: 'done',
                current: null,
                summary: `${ledgeredFiles.current.size} files updated`
              });
              break;
            }
          }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.log(`Failed to fetch template for prompt: ${prompt}, got the following error\n${error}`);
            setError(message);
            setIsLoading(false);
            setPhases((prev) =>
              prev.map((p) => (p.status === 'done' ? p : { ...p, status: 'error', error: message }))
            );
        }
    };

    init();
  }, [prompt, instance, mountFiles, startDevServer, writeFile]);

  const selectedFileContent = selectedFile ? fileContents.get(selectedFile) : null;

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
          <StepsPane phases={phases} error={error} />
        </div>

        {/* File Explorer - 25% */}
        <div className="w-[25%] border-r border-border overflow-hidden flex flex-col">
          <FileExplorer
            fileTree={fileTree}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
          />
        </div>

        {/* Preview/Code Pane - 45% */}
        <div className="w-[45%] overflow-hidden flex flex-col">
          <PreviewPane
            selectedFile={selectedFile}
            fileContent={selectedFileContent}
            files = {files}
            steps = {steps}
            serverUrl = {serverUrl}
            webContainerStatus = {status}
          />
        </div>
      </div>
    </div>
  );
};

export default Builder;