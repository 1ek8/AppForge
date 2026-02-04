import { FileNode } from "@/lib/types";

export function buildFileTree(files: {filePath: string, content: string}[]): FileNode[] {
    const root = {};

    files.forEach(file => {
        const parts = file.filePath.split('/');
    })

    return root;
}