import { createVfsError } from "./errors";
import { fail, ok, type VfsResult } from "./result";

const windowsDrivePattern = /^[A-Za-z]:([/\\]|$)/;

const containsWindowsSeparator = (path: string): boolean => path.includes("\\");

export function splitVfsPath(path: string): readonly string[] {
  if (path === "/") {
    return [];
  }

  return path.split("/").filter((part) => part.length > 0);
}

export function normalizeVfsPath(path: string, cwd = "/"): VfsResult<string> {
  if (windowsDrivePattern.test(path) || containsWindowsSeparator(path)) {
    return fail(createVfsError("INVALID_PATH", "VFS paths must use POSIX separators.", { path }));
  }

  if (!cwd.startsWith("/") || containsWindowsSeparator(cwd)) {
    return fail(createVfsError("INVALID_PATH", "cwd must be an absolute VFS path.", { path: cwd }));
  }

  const basePath = path.length === 0 ? cwd : path.startsWith("/") ? path : `${cwd}/${path}`;
  const segments: string[] = [];

  for (const part of basePath.split("/")) {
    if (part.length === 0 || part === ".") {
      continue;
    }

    if (part === "..") {
      segments.pop();
      continue;
    }

    segments.push(part);
  }

  return ok(segments.length === 0 ? "/" : `/${segments.join("/")}`);
}

export function joinVfsPath(...segments: readonly string[]): string {
  const joined = segments.filter((segment) => segment.length > 0).join("/");
  const normalized = normalizeVfsPath(joined.startsWith("/") ? joined : `/${joined}`);

  return normalized.ok ? normalized.value : "/";
}

export function getVfsBasename(path: string): string {
  const normalized = normalizeVfsPath(path);

  if (!normalized.ok || normalized.value === "/") {
    return "/";
  }

  const segments = splitVfsPath(normalized.value);

  return segments[segments.length - 1] ?? "/";
}

export function getVfsDirname(path: string): string {
  const normalized = normalizeVfsPath(path);

  if (!normalized.ok || normalized.value === "/") {
    return "/";
  }

  const segments = splitVfsPath(normalized.value).slice(0, -1);

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function validateVfsNodeName(name: string): VfsResult<string> {
  if (name.length === 0) {
    return fail(createVfsError("INVALID_NAME", "Node name cannot be empty."));
  }

  if (name === "." || name === "..") {
    return fail(createVfsError("INVALID_NAME", "Node name cannot be a path segment."));
  }

  if (name.includes("/") || name.includes("\0")) {
    return fail(createVfsError("INVALID_NAME", "Node name contains an invalid character."));
  }

  return ok(name);
}
