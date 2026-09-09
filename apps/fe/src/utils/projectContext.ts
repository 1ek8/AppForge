const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const filesToXml = (files: Map<string, string>): string[] => {
  const parts: string[] = [];
  for (const [filePath, content] of files) {
    if (filePath) parts.push(`<file path="${filePath}">\n${escapeXml(content)}\n</file>`);
  }
  return parts;
};

export function buildProjectContext(files: Map<string, string>): string {
  const parts = filesToXml(files);
  if (parts.length === 0) return '<project_files>\n(no files yet)\n</project_files>';
  return `<project_files>\n${parts.join('\n')}\n</project_files>`;
}

export function buildUserChanges(files: Map<string, string>): string {
  const parts = filesToXml(files);
  if (parts.length === 0) return '';
  return `<bolt_file_modifications>\n${parts.join('\n')}\n</bolt_file_modifications>`;
}