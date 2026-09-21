import fs from "node:fs";
import path from "node:path";

const BASE_DIR = "/tmp/mailclaude";

function sanitizeFilename(name: string, maxLen = 50): string {
  const sanitized = name
    .replace(/[^a-zA-Z0-9_\-. äöüÄÖÜß]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, maxLen)
    .replace(/_$/, "");
  // Empty names and dot-only names must never resolve to an output directory.
  return sanitized === "" || /^\.+$/.test(sanitized) ? "untitled" : sanitized;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveCollision(filePath: string): string {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let counter = 2;
  let candidate: string;
  do {
    candidate = path.join(dir, `${base}_${counter}${ext}`);
    counter++;
  } while (fs.existsSync(candidate));
  return candidate;
}

export function getAttachmentPath(
  mailDate: string,
  filename: string
): string {
  const date = new Date(mailDate);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const dir = path.join(BASE_DIR, "attachments", year, month);
  ensureDir(dir);
  return resolveCollision(path.join(dir, sanitizeFilename(filename, 100)));
}

export function getExportPath(
  mailDate: string,
  subject: string
): string {
  const date = new Date(mailDate);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const dir = path.join(BASE_DIR, "exports", year, month);
  ensureDir(dir);
  const filename = `${year}-${month}-${day}_${sanitizeFilename(subject)}.eml`;
  return resolveCollision(path.join(dir, filename));
}
