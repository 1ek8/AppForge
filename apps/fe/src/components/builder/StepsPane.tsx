import { useState } from "react";
import { Phase, PhaseKey } from "@/lib/types";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode,
  Loader2,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StepsPaneProps {
  phases: Phase[];
  error: string | null;
  onRetry?: () => void;
}

interface PhaseMeta {
  key: PhaseKey;
  title: string;
  hint: string;
  chip: string;
  icon: "file" | "terminal";
}

const PHASE_META: PhaseMeta[] = [
  {
    key: "templating",
    title: "Create files from template",
    hint: "Setting up the project skeleton",
    chip: "Create",
    icon: "file",
  },
  {
    key: "building",
    title: "Stream app code",
    hint: "Updating files as the AI generates them",
    chip: "Update",
    icon: "file",
  },
  {
    key: "running",
    title: "Run the app",
    hint: "Installing dependencies and starting the dev server",
    chip: "Run",
    icon: "terminal",
  },
];

const StepsPane = ({ phases, error, onRetry }: StepsPaneProps) => {
  const [expanded, setExpanded] = useState<Record<PhaseKey, boolean>>({
    templating: false,
    building: false,
    running: true,
  });

  const toggleExpanded = (key: PhaseKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const doneCount = phases.filter((p) => p.status === "done").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Build Steps</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Progress of your website generation
        </p>
      </div>

      {/* Phases */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4">
            <p className="font-medium">Error</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-sm break-words">{error}</p>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="shrink-0 gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {PHASE_META.map((meta) => {
            const phase = phases.find((p) => p.key === meta.key);
            if (!phase) return null;
            return (
              <PhaseSection
                key={meta.key}
                meta={meta}
                phase={phase}
                expanded={expanded[meta.key]}
                onToggle={() => toggleExpanded(meta.key)}
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-1.5">
          {PHASE_META.map((meta) => {
            const phase = phases.find((p) => p.key === meta.key);
            if (!phase) return null;
            return (
              <span
                key={meta.key}
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  phase.status === "done" && "bg-primary/15 text-primary",
                  phase.status === "running" && "bg-accent/60 text-accent-foreground animate-pulse",
                  phase.status === "error" && "bg-destructive/10 text-destructive",
                  phase.status === "idle" && "bg-muted/40 text-muted-foreground"
                )}
              >
                {meta.chip}
              </span>
            );
          })}
        </div>
        <div className="mt-2 h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(doneCount / PHASE_META.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{doneCount}</span> of{" "}
          {PHASE_META.length} phases complete
        </div>
      </div>
    </div>
  );
};

interface PhaseSectionProps {
  meta: PhaseMeta;
  phase: Phase;
  expanded: boolean;
  onToggle: () => void;
}

const PhaseSection = ({ meta, phase, expanded, onToggle }: PhaseSectionProps) => {
  return (
    <div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <StatusIcon status={phase.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {meta.icon === "terminal" ? (
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <h3 className="font-medium text-foreground truncate">{meta.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.hint}</p>
        </div>
      </div>

      <div className="ml-9 mt-2 space-y-2">
        {phase.error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {phase.error}
          </p>
        )}

        {phase.status === "running" && phase.current && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium text-foreground truncate">
              {phase.current}
            </span>
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
          </div>
        )}

        {phase.status !== "running" && phase.summary && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{phase.summary}</span>
          </div>
        )}

        {phase.status === "idle" && !phase.error && (
          <p className="text-sm text-muted-foreground">Waiting…</p>
        )}

        {phase.ledger.length > 0 && (
          <div>
            <button
              type="button"
              onClick={onToggle}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {phase.ledger.length} {meta.icon === "terminal" ? "commands" : "files"}
            </button>
            {expanded && (
              <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                {phase.ledger.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
                  >
                    {meta.icon === "terminal" ? (
                      <Terminal className="w-3 h-3 shrink-0" />
                    ) : (
                      <FileCode className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: Phase["status"] }) => {
  switch (status) {
    case "done":
      return (
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-primary-foreground" />
        </div>
      );
    case "running":
      return (
        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />
        </div>
      );
    case "error":
      return (
        <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
          <AlertCircle className="w-3.5 h-3.5 text-destructive-foreground" />
        </div>
      );
    default:
      return (
        <div className="w-6 h-6 rounded-full border-2 border-border flex items-center justify-center">
          <Circle className="w-3 h-3 text-muted" />
        </div>
      );
  }
};

export default StepsPane;