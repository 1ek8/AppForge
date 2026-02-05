import { Check, Circle, Loader2 } from "lucide-react";

interface Step {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed";
}

interface StepsPaneProps {
  prompt: string;
  isLoading: boolean;
  steps: Step[];
  error: any
}

const StepsPane = ({ prompt }: StepsPaneProps) => {
  // Mock steps for demonstration
  const steps: Step[] = [
    {
      id: 1,
      title: "Analyzing prompt",
      description: "Understanding your requirements",
      status: "completed",
    },
    {
      id: 2,
      title: "Creating project structure",
      description: "Setting up files and folders",
      status: "completed",
    },
    {
      id: 3,
      title: "Generating components",
      description: "Building React components",
      status: "in-progress",
    },
    {
      id: 4,
      title: "Styling with Tailwind",
      description: "Applying responsive styles",
      status: "pending",
    },
    {
      id: 5,
      title: "Adding interactivity",
      description: "Implementing user interactions",
      status: "pending",
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Build Steps</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Progress of your website generation
        </p>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {steps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {steps.filter((s) => s.status === "completed").length}
          </span>{" "}
          of {steps.length} steps completed
        </div>
        <div className="mt-2 h-2 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: `${(steps.filter((s) => s.status === "completed").length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

interface StepItemProps {
  step: Step;
  isLast: boolean;
}

const StepItem = ({ step, isLast }: StepItemProps) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case "completed":
        return (
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        );
      case "in-progress":
        return (
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-accent-foreground animate-spin" />
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

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {getStatusIcon()}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 my-1 ${
              step.status === "completed" ? "bg-primary" : "bg-border"
            }`}
          />
        )}
      </div>
      <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
        <h3
          className={`font-medium ${
            step.status === "pending"
              ? "text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {step.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {step.description}
        </p>
      </div>
    </div>
  );
};

export default StepsPane;
