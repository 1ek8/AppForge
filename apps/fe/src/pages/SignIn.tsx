import { SignIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { ArrowLeft, Code2 } from "lucide-react";
import { HAS_CLERK } from "@/lib/clerk";

const SignInPage = () => {
  if (!HAS_CLERK) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground text-sm">Sign-in is not configured on this deployment.</p>
        <Link to="/" className="text-sm text-primary hover:underline">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">AppForge</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <SignIn fallbackRedirectUrl="/projects" signUpUrl="/sign-up" />
        </div>
      </main>
    </div>
  );
};

export default SignInPage;