import { Router } from 'express';
import { prisma, Prisma } from '@repo/db';
import { requireAuth, userIdOf } from './auth.ts';

interface FileInput {
  filePath?: unknown;
  content?: unknown;
}

const sanitizeFiles = (files: unknown): Array<{ filePath: string; content: string }> => {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f): f is FileInput => !!f && typeof (f as FileInput).filePath === 'string' && typeof (f as FileInput).content === 'string')
    .map((f) => ({ filePath: f.filePath as string, content: f.content as string }))
    .slice(0, 200);
};

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.get('/', async (req, res) => {
  try {
    const userId = userIdOf(res);
    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prompt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { files: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ projects });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

projectsRouter.post('/', async (req, res) => {
  try {
    const userId = userIdOf(res);
    const { name, prompt, files } = req.body ?? {};

    const projectName = typeof name === 'string' && name.trim() ? name.slice(0, 200) : 'Untitled project';
    const fileList = sanitizeFiles(files);

    const project = await prisma.project.create({
      data: {
        userId,
        name: projectName,
        prompt: typeof prompt === 'string' ? prompt.slice(0, 4000) : null,
        files: {
          create: fileList.map((f) => ({ filePath: f.filePath, content: f.content })),
        },
      },
      include: { files: true },
    });

    res.json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

projectsRouter.get('/:id', async (req, res) => {
  try {
    const userId = userIdOf(res);
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId },
      include: { files: { orderBy: { filePath: 'asc' } } },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

projectsRouter.put('/:id', async (req, res) => {
  try {
    const userId = userIdOf(res);
    const { name, prompt, files } = req.body ?? {};

    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const fileList = files !== undefined ? sanitizeFiles(files) : null;

    const project = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (fileList) {
        await tx.projectFile.deleteMany({ where: { projectId: existing.id } });
      }
      return tx.project.update({
        where: { id: existing.id },
        data: {
          name: typeof name === 'string' && name.trim() ? name.slice(0, 200) : undefined,
          prompt: typeof prompt === 'string' ? prompt.slice(0, 4000) : undefined,
          ...(fileList ? { files: { create: fileList.map((f) => ({ filePath: f.filePath, content: f.content })) } } : {}),
        },
        include: { files: true },
      });
    });

    res.json({ project });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

projectsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = userIdOf(res);

    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await prisma.project.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});