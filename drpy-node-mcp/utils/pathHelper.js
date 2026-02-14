import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Current: drpy-node-mcp/utils
// .. -> drpy-node-mcp
// .. -> drpy-node (PROJECT_ROOT)
export const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

export function resolvePath(p) {
  return path.resolve(PROJECT_ROOT, p);
}

export function isSafePath(p) {
  const resolved = resolvePath(p);
  return resolved.startsWith(PROJECT_ROOT);
}
