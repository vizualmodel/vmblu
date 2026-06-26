import path from 'path';

export function normalizePath(value) {
  return value.split(path.sep).join('/');
}

export function relativePath(root, filePath) {
  return normalizePath(path.relative(root, filePath));
}

export function withoutExtension(filePath) {
  return filePath.replace(/\.(d\.)?[cm]?[jt]sx?$/i, '');
}

export function slug(value) {
  return String(value)
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9._:/#-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
