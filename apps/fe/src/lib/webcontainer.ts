import { FileSystemTree, WebContainer } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export async function getWebContainer(): Promise<WebContainer> {
  if (webcontainerInstance) return webcontainerInstance;
  
  if (!bootPromise) {
    bootPromise = WebContainer.boot().then((instance) => {
      webcontainerInstance = instance;
      return instance;
    });
  }
  
  return bootPromise;
}

export async function resetWebContainer(): Promise<void> {
  if (webcontainerInstance) {
    try {
      await webcontainerInstance.teardown();
    } catch (error) {
      console.warn('Webcontainer teardown failed:', error);
    }
    webcontainerInstance = null;
  }
  bootPromise = null;
}

type WCFileSystemTree = FileSystemTree;
type WCNode = { directory: WCFileSystemTree } | { file: { contents: string } };

export function fileListToWebContainerFS(
  files: Array<{ filePath: string, content: string}>
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const { filePath, content } of files) {
    const parts = filePath.split('/');
    let current: Record<string, WCNode> = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = (current[part] as { directory: Record<string, WCNode> }).directory;
    }

    current[parts[parts.length - 1]] = {
      file: { contents: content },
    };
  }

  return tree;
}