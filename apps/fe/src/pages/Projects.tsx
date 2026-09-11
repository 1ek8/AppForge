import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Code2, FolderPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth, useUser, SignOutButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { HAS_CLERK } from "@/lib/clerk";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface ProjectMeta {
  id: string;
  name: string;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { files: number };
  files?: Array<{ filePath: string; content: string }>;
}

const Projects = () => {
  if (!HAS_CLERK) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground text-sm">Sign-in is not configured on this deployment.</p>
        <Link to="/" className="text-sm text-primary hover:underline">Back to home</Link>
      </div>
    );
  }
  return <ProjectsInner />;
};

const ProjectsInner = () => {
  const navigate = useNavigate();
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !getToken) return;

    const load = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BACKEND_URL}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load projects');
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isLoaded, getToken]);

  const displayName = useMemo(() => {
    if (user?.username) return user.username;
    if (user?.firstName) return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
    return user?.primaryEmailAddress?.emailAddress ?? 'there';
  }, [user]);

  const openProject = (project: ProjectMeta) => {
    navigate('/builder', {
      state: {
        project: {
          id: project.id,
          name: project.name,
          prompt: project.prompt ?? project.name,
          files: project.files ?? [],
        },
      },
    });
  };

  const deleteProject = async (id: string) => {
    if (!getToken) return;
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete project');
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Code2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">AppForge</span>
        </Link>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
              <Plus className="w-4 h-4" />
              New project
            </Button>
            <span className="text-sm text-muted-foreground hidden sm:inline">{displayName}</span>
            <SignOutButton>
              <Button variant="ghost" size="sm">Sign out</Button>
            </SignOutButton>
          </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My projects</h1>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        {!error && projects.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <FolderPlus className="w-10 h-10 text-muted" />
            <p className="text-muted-foreground text-sm">
              No saved projects yet. Build something and hit Save to add it here.
            </p>
            <Button onClick={() => navigate('/')} className="gap-2">
              <Plus className="w-4 h-4" />
              Build your first app
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
            >
              <button
                type="button"
                onClick={() => openProject(project)}
                className="text-left group"
              >
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.prompt || '—'}
                </p>
              </button>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-muted-foreground">
                  {project._count?.files ?? project.files?.length ?? 0} files ·{' '}
                  {new Date(project.updatedAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => openProject(project)}>
                    Open
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteProject(project.id)} aria-label="Delete project">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Projects;