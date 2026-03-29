import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runScript<T>(
  scriptName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const scriptPath = path.join(__dirname, "scripts", scriptName);
  const { stdout, stderr } = await exec("osascript", [
    "-l",
    "JavaScript",
    scriptPath,
    JSON.stringify(params),
  ]);
  if (stderr && !stdout) {
    throw new Error(`AppleScript error: ${stderr}`);
  }
  try {
    return JSON.parse(stdout.trim()) as T;
  } catch {
    throw new Error(`Failed to parse script output: ${stdout}`);
  }
}
