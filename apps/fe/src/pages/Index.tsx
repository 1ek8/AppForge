import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useAuth, useClerk } from "@clerk/clerk-react";
import { FolderOpen, Sparkles, Zap, Code2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HAS_CLERK } from "@/lib/clerk";

const PENDING_PROMPT_KEY = "appforge_pending_prompt";

const Index = () => {
  return HAS_CLERK ? <ClerkLanding /> : <StaticLanding />;
};

const StaticLanding = () => {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (prompt.trim()) navigate("/builder", { state: { prompt } });
  };

  return (
    <LandingShell
      prompt={prompt}
      onPromptChange={setPrompt}
      onGenerate={handleSubmit}
      headerRight={null}
      generateSlot={
        <Button onClick={handleSubmit} disabled={!prompt.trim()} className="gap-2">
          <Zap className="w-4 h-4" />
          Generate
        </Button>
      }
    />
  );
};

const ClerkLanding = () => {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const { openSignIn } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (value.trim()) {
      sessionStorage.setItem(PENDING_PROMPT_KEY, value);
    } else {
      sessionStorage.removeItem(PENDING_PROMPT_KEY);
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    sessionStorage.removeItem(PENDING_PROMPT_KEY);
    navigate("/builder", { state: { prompt } });
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (pending && pending.trim()) {
      sessionStorage.removeItem(PENDING_PROMPT_KEY);
      navigate("/builder", { state: { prompt: pending } });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <LandingShell
      prompt={prompt}
      onPromptChange={handlePromptChange}
      onKeyDown={handleKeyDown}
      onGenerate={handleGenerate}
      headerRight={
        <>
          <SignedIn>
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <FolderOpen className="w-4 h-4" />
              My Projects
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Button variant="outline" size="sm" onClick={() => openSignIn()}>
              Sign in
            </Button>
          </SignedOut>
        </>
      }
      generateSlot={
        <GenerateGate
          prompt={prompt}
          isLoaded={isLoaded}
          isSignedIn={isSignedIn}
          onGenerate={handleGenerate}
          onSignIn={() => openSignIn()}
        />
      }
    />
  );
};

const GenerateGate = ({
  prompt,
  isLoaded,
  isSignedIn,
  onGenerate,
  onSignIn,
}: {
  prompt: string;
  isLoaded: boolean;
  isSignedIn: boolean;
  onGenerate: () => void;
  onSignIn: () => void;
}) => {
  if (!isLoaded) {
    return (
      <Button disabled className="gap-2">
        <Zap className="w-4 h-4" />
        Loading…
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <Button onClick={onSignIn} className="gap-2">
        <Zap className="w-4 h-4" />
        Sign in to generate
      </Button>
    );
  }

  return (
    <Button onClick={onGenerate} disabled={!prompt.trim()} className="gap-2">
      <Zap className="w-4 h-4" />
      Generate
    </Button>
  );
};

const LandingShell = ({
  prompt,
  onPromptChange,
  onKeyDown,
  onGenerate,
  headerRight,
  generateSlot,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onGenerate: () => void;
  headerRight: React.ReactNode;
  generateSlot: React.ReactNode;
}) => (
  <div className="min-h-screen bg-background flex flex-col">
    {/* Header */}
    <header className="border-b border-border px-6 py-4 flex items-center gap-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Code2 className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">AppForge</span>
      </div>
      {headerRight && <div className="ml-auto flex items-center gap-3">{headerRight}</div>}
    </header>

    {/* Hero Section */}
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-3xl w-full text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          AI-Powered Website Builder
        </div>

        {/* Main Heading */}
        <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
          Build websites with
          <span className="text-primary block mt-2">natural language</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Describe your vision, and watch it come to life. No coding required.
          Just type what you want to build.
        </p>

        {/* Prompt Input */}
        <div className="relative mt-8">
          <div className="bg-card border border-border rounded-2xl p-2 shadow-lg">
            <Textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe the website you want to build..."
              className="min-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted text-lg"
            />
            <div className="flex items-center justify-between pt-2 px-2">
              <span className="text-sm text-muted">Press Enter to generate</span>
              {generateSlot}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <FeatureCard
            icon={<Sparkles className="w-5 h-5" />}
            title="AI-Powered"
            description="Advanced AI understands your intent and generates clean code"
          />
          <FeatureCard
            icon={<Layers className="w-5 h-5" />}
            title="Step by Step"
            description="Watch as your website is built incrementally with clear steps"
          />
          <FeatureCard
            icon={<Code2 className="w-5 h-5" />}
            title="Full Control"
            description="Access and modify every line of code in your project"
          />
        </div>
      </div>
    </main>

    {/* Footer */}
    <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted">
      Built with AI precision
    </footer>
  </div>
);

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="bg-card border border-border rounded-xl p-6 text-left hover:border-primary/50 transition-colors">
    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
);

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default Index;