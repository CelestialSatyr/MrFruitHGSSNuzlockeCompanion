import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EditorGitStatus } from "../shared/api-types.ts";
const run = promisify(execFile);
async function git(root: string, args: string[]) {
  return (await run("git", args, { cwd: root, windowsHide: true })).stdout.trim();
}
export async function getGitStatus(root: string): Promise<EditorGitStatus> {
  try {
    if ((await git(root, ["rev-parse", "--is-inside-work-tree"])) !== "true")
      return { available: false, dirtyPaths: [], unrelatedDirtyPaths: [] };
    const [branch, remote, porcelain] = await Promise.all([
      git(root, ["branch", "--show-current"]).catch(() => ""),
      git(root, ["remote", "get-url", "origin"]).catch(() => ""),
      git(root, ["status", "--porcelain"]),
    ]);
    const dirtyPaths = porcelain
      ? porcelain
          .split(/\r?\n/)
          .map((line) => line.slice(3).trim())
          .filter(Boolean)
      : [];
    const unrelatedDirtyPaths = dirtyPaths.filter(
      (p) => !p.replaceAll("\\", "/").startsWith("content/published/"),
    );
    return {
      available: true,
      ...(branch ? { branch } : {}),
      ...(remote ? { remote } : {}),
      dirtyPaths,
      unrelatedDirtyPaths,
    };
  } catch {
    return { available: false, dirtyPaths: [], unrelatedDirtyPaths: [] };
  }
}
export async function commitAndPushPublished(root: string, message: string) {
  await git(root, ["add", "--", "content/published"]);
  const changed = await git(root, ["diff", "--cached", "--quiet"])
    .then(() => false)
    .catch(() => true);
  if (!changed) return { committed: false, pushed: false };
  await git(root, ["commit", "-m", message]);
  await git(root, ["push"]);
  return { committed: true, pushed: true };
}
