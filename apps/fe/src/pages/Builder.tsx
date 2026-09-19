import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Code2, Loader2, Save } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import StepsPane from "@/components/builder/StepsPane";
import FileExplorer from "@/components/builder/FileExplorer";
import PreviewPane from "@/components/builder/PreviewPane";
import ChatPanel, { ChatMessage } from "@/components/builder/ChatPanel";
import axios from 'axios';
import { FileNode, ParsedFile, Phase, PhaseKey, SavedProject, Step } from "@/lib/types";
import { ParseResult, StreamParser } from "@/utils/streamParser";
import { buildFileTree } from "@/utils/fileTreeBuilder";
import { buildProjectContext, buildUserChanges } from "@/utils/projectContext";
import { useWebContainer } from "@/hooks/useWebContainer";
import { HAS_CLERK } from "@/lib/clerk";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const STREAM_ERROR_MARKER = '[appforge-stream-error]';

function hasStreamErrorMarker(chunk: string, carry = ''): { detected: boolean; carry: string } {
  const combined = carry + chunk;
  const detected = combined.includes(STREAM_ERROR_MARKER);
  const tail = combined.slice(-(STREAM_ERROR_MARKER.length - 1));
  return { detected, carry: detected ? '' : tail };
}

interface SaveButtonProps {
  fileContentsRef: React.RefObject<Map<string, string>>;
  savedProject: SavedProject | undefined;
  prompt: string;
  projectId: string | null;
  onSaved: (id: string) => void;
}

const SaveButton = ({ fileContentsRef, savedProject, prompt, projectId, onSaved }: SaveButtonProps) => {
  const { getToken, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!isSignedIn) {
      toast("Sign in to save your project");
      navigate("/sign-in");
      return;
    }

    const files = Array.from(fileContentsRef.current.entries())
      .filter(([, content]) => content !== undefined)
      .map(([filePath, content]) => ({ filePath, content }));

    if (files.length === 0) {
      toast.error("Nothing to save yet");
      return;
    }

    setIsSaving(true);
    try {
      const token = await getToken();
      const body = JSON.stringify({
        name: savedProject?.name ?? (prompt.slice(0, 120) || "Untitled App"),
        prompt,
        files,
      });
      const isUpdate = Boolean(projectId);
      const res = await fetch(
        `${BACKEND_URL}/projects${isUpdate ? `/${projectId}` : ""}`,
        {
          method: isUpdate ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
        }
      );
      if (!res.ok) throw new Error("Failed to save project");
      const data = await res.json();
      if (data.project?.id) onSaved(data.project.id);
      toast.success("Project saved");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isSignedIn) return null;

  return (
    <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 shrink-0">
      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {isSaving ? "Saving..." : projectId ? "Update" : "Save"}
    </Button>
  );
};

const createPhase = (key: PhaseKey): Phase => ({
  key,
  status: 'idle',
  current: null,
  summary: null,
  ledger: [],
  error: null,
});

interface BuilderContentProps {
  getToken: ((opts?: { skipCache?: boolean }) => Promise<string | null>) | null;
}

const BuilderContent = ({ getToken }: BuilderContentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const prompt = location.state?.prompt || "No prompt provided";
  const savedProject = location.state?.project as SavedProject | undefined;

  const [projectId, setProjectId] = useState<string | null>(savedProject?.id ?? null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [phases, setPhases] = useState<Phase[]>([createPhase('templating'), createPhase('building'), createPhase('running')]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{ role: 'user', content: prompt }]);
  const [isStreaming, setIsStreaming] = useState(false);

  const { instance, serverUrl, status, events, mountFiles, startDevServer, writeFile, reset } = useWebContainer();
  const [attempt, setAttempt] = useState(0);
  const [templateReady, setTemplateReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const templateDataRef = useRef<{ steps: Step[]; files: ParsedFile[]; userPrompt: string; templateLength: number; prompts: string[] } | null>(null);
  const activePhaseRef = useRef<PhaseKey>('templating');
  const writtenFileContents = useRef(new Map<string, string>());
  const ledgeredFiles = useRef(new Set<string>());
  const processedEvents = useRef(0);
  const locallyEditedFiles = useRef(new Set<string>());
  const editTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const isMountedRef = useRef(true);
  const fileContentsRef = useRef(fileContents);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    fileContentsRef.current = fileContents;
  }, [fileContents]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updatePhase = useCallback((key: PhaseKey, patch: Partial<Phase>) => {
    setPhases((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }, []);

  const getAuthToken = useCallback(async (opts?: { skipCache?: boolean }): Promise<string | null> => {
    if (!getTokenRef.current) return null;
    try {
      return await getTokenRef.current(opts);
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return null;
    }
  }, []);

  const postChat = useCallback(async (body: object, signal: AbortSignal): Promise<Response> => {
    const send = async (token: string | null) =>
      fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });

    let token = await getAuthToken();
    let response = await send(token);

    if (response.status === 401) {
      token = await getAuthToken({ skipCache: true });
      response = await send(token);
    }

    return response;
  }, [getAuthToken]);

  const applyParsedChunk = useCallback(async (result: ParseResult, signal: AbortSignal, alive: () => boolean) => {
    const {
      steps: parsedSteps,
      files: parsedFiles,
      openAction,
      completedActions
    } = result;

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

    for (const file of parsedFiles) {
      const isUpdate = writtenFileContents.current.has(file.filePath);

      if (
        file.type === 'file' &&
        file.filePath &&
        file.content !== undefined &&
        !locallyEditedFiles.current.has(file.filePath) &&
        writtenFileContents.current.get(file.filePath) !== file.content
      ) {
        writtenFileContents.current.set(file.filePath, file.content);
        await writeFile(file.filePath, file.content);
        if (signal.aborted || !alive()) return;
      }

      if (!ledgeredFiles.current.has(file.filePath)) {
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

    setFileContents((prev) => {
      const next = new Map(prev);
      for (const f of parsedFiles) {
        if (f.filePath && !locallyEditedFiles.current.has(f.filePath)) {
          next.set(f.filePath, f.content);
        }
      }
      return next;
    });
  }, [writeFile, updatePhase]);

  const handleMonacoEdit = (filePath: string, content: string) => {
    setFileContents((prev) => {
      if (prev.get(filePath) === content) return prev;
      const next = new Map(prev);
      next.set(filePath, content);
      return next;
    });

    locallyEditedFiles.current.add(filePath);
    writtenFileContents.current.set(filePath, content);

    const existing = editTimers.current.get(filePath);
    if (existing) clearTimeout(existing);
    editTimers.current.set(filePath, setTimeout(async () => {
      try {
        await writeFile(filePath, content);
      } catch (err) {
        console.error(`Failed to write ${filePath} to WebContainer:`, err);
      } finally {
        editTimers.current.delete(filePath);
      }
    }, 400));
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
  }, [events, updatePhase]);

  useEffect(() => {
    if (status === 'ready' && serverUrl) {
      updatePhase('running', { status: 'done', current: null, summary: 'App ready' });
    }
  }, [status, serverUrl, updatePhase]);

  useEffect(() => {
    const abort = new AbortController();
    let mounted = true;

    setTemplateReady(false);
    templateDataRef.current = null;
    activePhaseRef.current = 'templating';
    setSteps([]);
    setFiles([]);
    setFileTree([]);
    setFileContents(new Map());
    setSelectedFile(null);

    if (savedProject?.files?.length) {
      const loadedFiles: ParsedFile[] = savedProject.files
        .filter((f) => f.filePath && f.content !== undefined)
        .map((f) => ({ type: 'file', filePath: f.filePath, content: f.content }));

      const loadedSteps: Step[] = loadedFiles.map((f, index) => ({
        id: index,
        title: `Load ${f.filePath}`,
        description: `Loading file ${f.filePath}`,
        status: 'completed',
        type: 'file',
        filePath: f.filePath,
        content: f.content,
      }));

      templateDataRef.current = {
        steps: loadedSteps,
        files: loadedFiles,
        userPrompt: prompt,
        templateLength: 0,
        prompts: [],
      };

      setSteps(loadedSteps);
      setFiles(loadedFiles);
      setFileTree(buildFileTree(loadedFiles.map((f) => ({ filePath: f.filePath, content: f.content }))));

      const contentMap = new Map<string, string>();
      loadedFiles.forEach((f) => contentMap.set(f.filePath, f.content));
      setFileContents(contentMap);

      if (loadedFiles.length > 0) setSelectedFile(loadedFiles[0].filePath);
      setProjectId(savedProject.id);

      updatePhase('templating', {
        status: 'done',
        current: null,
        summary: `${loadedFiles.length} files loaded`,
        ledger: loadedFiles.map((f) => f.filePath),
      });

      setTemplateReady(true);
      return;
    }

    setIsLoading(true);
    updatePhase('templating', { status: 'running', current: "Processing the prompt...", error: null });

    const classifyTemplate = async () => {
      const token = await getAuthToken();
      if (!token) {
        if (!mounted) return;
        const message = 'Sign in to generate your app.';
        setError(message);
        setIsLoading(false);
        updatePhase('templating', { status: 'error', current: null, error: message });
        return;
      }

      if (!mounted || abort.signal.aborted) return;

      updatePhase('templating', { status: 'running', current: "Receiving template files...", error: null });

      const templateResponse = await axios.post(`${BACKEND_URL}/template`, {
        prompt
      }, {
        signal: abort.signal,
        headers: { Authorization: `Bearer ${token}` }
      });

      const { userPrompt, templateLength, prompts } = templateResponse.data;

      if(!prompts || prompts.length === 0){
        throw new Error('No templates received from server')
      }

      if (!mounted || abort.signal.aborted) return;

      updatePhase('templating', { status: 'running', current: "Setting up project skeleton...", error: null });

      const parser = new StreamParser();
      let parsedSteps: Step[] = [];
      let parsedFiles: ParsedFile[] = [];

      for(const templatePrompt of prompts){
        const parsedResult = parser.parseChunk(templatePrompt);
        parsedSteps = parsedResult.steps;
        parsedFiles = parsedResult.files;
      }

      templateDataRef.current = {
        steps: parsedSteps,
        files: parsedFiles,
        userPrompt,
        templateLength,
        prompts,
      };

      updatePhase('templating', {
        status: 'done',
        current: null,
        summary: `${parsedFiles.length} files created`,
        ledger: parsedFiles.map((f) => f.filePath)
      });

      if (!mounted || abort.signal.aborted) return;

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

      setTemplateReady(true);
    };

    classifyTemplate().catch((error) => {
      if (abort.signal.aborted || !mounted) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Failed to classify template for prompt: ${prompt}, got the following error\n${error}`);
      setError(message);
      setIsLoading(false);
      setPhases((prev) =>
        prev.map((p) =>
          p.key === activePhaseRef.current
            ? { ...p, status: 'error', current: null, error: message }
            : p
        )
      );
    });

    return () => {
      mounted = false;
      abort.abort();
    };
  }, [prompt, savedProject, attempt, updatePhase, getAuthToken]);

  useEffect(() => {
    if (!instance || !templateReady) return;

    const abort = new AbortController();
    abortRef.current = abort;
    let mounted = true;
    activePhaseRef.current = 'building';

    const buildProject = async () => {
      setIsLoading(true);

      const data = templateDataRef.current;
      if (!data) {
        setIsLoading(false);
        return;
      }

      if (data.prompts.length === 0) {
        const filesToMount = data.files.map((f) => ({ filePath: f.filePath, content: f.content }));
        await mountFiles(filesToMount);
        if (!mounted || abort.signal.aborted) return;
        filesToMount.forEach((f) => writtenFileContents.current.set(f.filePath, f.content));

        updatePhase('building', { status: 'done', current: null, summary: 'Loaded from library', ledger: [] });

        await startDevServer();
        if (!mounted || abort.signal.aborted) return;
        setIsLoading(false);
        return;
      }

      const filesToMount = data.files.filter(f => f.type === 'file' && f.filePath && f.content !== undefined)
                          .map(f => ({ filePath: f.filePath, content: f.content }));

      await mountFiles(filesToMount);
      if (!mounted || abort.signal.aborted) return;

      filesToMount.forEach(f => writtenFileContents.current.set(f.filePath, f.content));

      await startDevServer();
      if (!mounted || abort.signal.aborted) return;

      updatePhase('building', { status: 'running', current: 'Streaming app code...', error: null });

      const { userPrompt, templateLength, prompts } = data;

      const codeResponse = await postChat({ userPrompt, templateLength, prompts }, abort.signal);

      if(!codeResponse.ok){
        throw new Error('Failed to fetch chat response');
      }

      const reader = codeResponse.body?.getReader();
      const decoder = new TextDecoder();

      if(!reader) {
        throw new Error('No reader available');
      }

      const parser = new StreamParser();
      let streamFinished = false;
      let artifactClosed = false;
      let hasArtifact = false;
      let streamErrorCarry = '';

      while(!streamFinished){
        if (abort.signal.aborted || !mounted) break;

        const {done, value} = await reader.read();

        if(done) {
          streamFinished = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        const marker = hasStreamErrorMarker(chunk, streamErrorCarry);
        streamErrorCarry = marker.carry;
        if (marker.detected) {
          throw new Error('Response interrupted on the server');
        }

        const parsed = parser.parseChunk(chunk);

        if (parsed.isComplete) artifactClosed = true;
        if (parsed.hasArtifact) hasArtifact = true;

        if (!mounted || abort.signal.aborted) break;

        await applyParsedChunk(parsed, abort.signal, () => mounted);

        if(!mounted || abort.signal.aborted) break;
      }

      if (!abort.signal.aborted && mounted && streamFinished) {
        setIsLoading(false);
        if (artifactClosed) {
          updatePhase('building', {
            status: 'done',
            current: null,
            summary: `${ledgeredFiles.current.size} files updated`
          });
        } else if (hasArtifact) {
          const message = 'The AI response ended before the app was fully generated. The last file may be incomplete — send a follow-up like "continue where you left off".';
          setError(message);
          updatePhase('building', { status: 'error', current: null, error: message });
        } else {
          const message = 'The AI response did not include any project files. Please try again.';
          setError(message);
          updatePhase('building', { status: 'error', current: null, error: message });
        }
      }
    };

    buildProject().catch((error) => {
      if (abort.signal.aborted || !mounted) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Failed to build project for prompt: ${prompt}, got the following error\n${error}`);
      setError(message);
      setIsLoading(false);
      setPhases((prev) =>
        prev.map((p) =>
          p.key === activePhaseRef.current
            ? { ...p, status: 'error', current: null, error: message }
            : p
        )
      );
    });

    return () => {
      mounted = false;
      abort.abort();
      abortRef.current = null;
    };
  }, [prompt, instance, templateReady, mountFiles, startDevServer, attempt, applyParsedChunk, updatePhase, postChat]);

  const selectedFileContent = selectedFile ? fileContents.get(selectedFile) : null;

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);
    setTemplateReady(false);
    templateDataRef.current = null;
    activePhaseRef.current = 'templating';
    setSteps([]);
    setFiles([]);
    setFileTree([]);
    setFileContents(new Map());
    setSelectedFile(null);
    writtenFileContents.current.clear();
    ledgeredFiles.current.clear();
    locallyEditedFiles.current.clear();
    processedEvents.current = 0;
    setMessages([{ role: 'user', content: prompt }]);
    setPhases([
      createPhase('templating'),
      createPhase('building'),
      createPhase('running'),
    ]);
    abortRef.current?.abort();
    await reset();
    setAttempt((a) => a + 1);
  };

  const sendFollowUp = async (query: string) => {
    const text = query.trim();
    if (!text || isStreaming || !instance) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setIsLoading(true);

    const abort = new AbortController();
    abortRef.current?.abort();
    abortRef.current = abort;

    const parser = new StreamParser();
    let assistantText = '';
    let artifactClosed = false;
    let streamFinished = false;
    let hasArtifact = false;
    let streamErrorCarry = '';

    try {
      const projectContext = buildProjectContext(fileContentsRef.current);
      const userChanges = buildUserChanges(
        new Map(
          Array.from(locallyEditedFiles.current)
            .filter((filePath) => fileContentsRef.current.has(filePath))
            .map((filePath) => [filePath, fileContentsRef.current.get(filePath) as string])
        )
      );

      updatePhase('building', { status: 'running', current: 'Applying changes...', error: null });
      activePhaseRef.current = 'building';

      const response = await postChat({
        userPrompt: text,
        context: projectContext,
        userChanges
      }, abort.signal);

      if (!response.ok) {
        throw new Error('Failed to fetch follow-up response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        if (abort.signal.aborted || !isMountedRef.current) break;

        const { done, value } = await reader.read();

        if (done) {
          streamFinished = true;
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        const marker = hasStreamErrorMarker(chunk, streamErrorCarry);
        streamErrorCarry = marker.carry;
        if (marker.detected) {
          throw new Error('Response interrupted on the server');
        }

        assistantText += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: assistantText };
          return next;
        });

        const parsed = parser.parseChunk(chunk);

        if (parsed.isComplete) artifactClosed = true;
        if (parsed.hasArtifact) hasArtifact = true;

        if (abort.signal.aborted || !isMountedRef.current) break;

        await applyParsedChunk(parsed, abort.signal, () => isMountedRef.current);
      }

      if (streamFinished && !artifactClosed && hasArtifact) {
        const message = 'The AI response ended before finishing. The last file may be incomplete — send a follow-up like "continue where you left off".';
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: `${assistantText}\n\n[${message}]` };
          return next;
        });
        setError(message);
      }
    } catch (error) {
      if (abort.signal.aborted || !isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Failed to stream follow-up for prompt: ${text}, got the following error\n${error}`);
      setError(message);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: `${assistantText}\n\n[Error: ${message}]` };
        return next;
      });
      setPhases((prev) =>
        prev.map((p) =>
          p.key === activePhaseRef.current
            ? { ...p, status: 'error', current: null, error: message }
            : p
        )
      );
    } finally {
      if (!abort.signal.aborted && streamFinished) {
        if (artifactClosed) {
          updatePhase('building', {
            status: 'done',
            current: null,
            summary: `${ledgeredFiles.current.size} files updated`
          });
        } else if (hasArtifact) {
          updatePhase('building', {
            status: 'error',
            current: null,
            error: 'The AI response ended before finishing.'
          });
        } else {
          updatePhase('building', {
            status: 'done',
            current: null,
            summary: `Reply received`
          });
        }
      }
      if (abortRef.current === abort) abortRef.current = null;
      setIsStreaming(false);
      setIsLoading(false);
    }
  };

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
          <span className="font-semibold text-foreground">AppForge</span>
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground truncate max-w-2xl">
            {prompt}
          </div>
        </div>
        {HAS_CLERK && (
          <SaveButton
            fileContentsRef={fileContentsRef}
            savedProject={savedProject}
            prompt={prompt}
            projectId={projectId}
            onSaved={setProjectId}
          />
        )}
      </header>

      {/* Main Content - Three Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Steps Pane - 30% */}
        <div className="w-[30%] border-r border-border overflow-hidden flex flex-col">
          <StepsPane phases={phases} error={error} onRetry={handleRetry} />
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
            serverUrl = {serverUrl}
            webContainerStatus = {status}
            onEditFile={handleMonacoEdit}
          />
        </div>
      </div>

      {/* Follow-up Prompt Bar */}
      <ChatPanel
        messages={messages}
        onSend={sendFollowUp}
        streaming={isStreaming}
        className="max-h-72 shrink-0"
      />
    </div>
  );
};

const AuthBuilder = () => {
  const { getToken } = useAuth();
  return <BuilderContent getToken={getToken} />;
};

const Builder = () => {
  if (!HAS_CLERK) {
    return <BuilderContent getToken={null} />;
  }
  return <AuthBuilder />;
};

export default Builder;
