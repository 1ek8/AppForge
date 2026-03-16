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

/** @type {import('@webcontainer/api').FileSystemTree} */
export function fileListToWebContainerFS(
  files: Array<{ filePath: string, content: string}>
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const { filePath, content } of files) {
    const parts = filePath.split('/');
    let current: any = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = current[part].directory;
    }

    current[parts[parts.length - 1]] = {
      file: { contents: content },
    };
  }

  return tree;
}