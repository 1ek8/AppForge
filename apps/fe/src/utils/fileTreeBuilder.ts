import { FileNode, FileNodeMap } from "@/lib/types";

export function buildFileTree(files: {filePath: string, content: string}[]): FileNode[] {
    const root: { [key: string]: FileNodeMap} = {};

    files.forEach(file => {
        const parts = file.filePath.split('/');
        let current = root;
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isFile = index === parts.length - 1;

            if(!current[part]){
                current[part] = {
                    name:part,
                    type: isFile ? 'file' : 'folder',
                    path: currentPath,
                    content: isFile ? file.content : undefined,
                    children: isFile ? undefined : {}
                };
            }

            if(!isFile && current[part]) {
                current = current[part].children as any;
            }
        })
    });

    function objectToArray(obj: {[key: string]: FileNodeMap}): FileNode[] {
    return Object.values(obj).map((node) => ({
      ...node,
      children: node.children ? objectToArray(node.children) : undefined
    }));
  }

    return objectToArray(root);
}