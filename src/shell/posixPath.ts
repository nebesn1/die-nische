const trimTrailingSlashes = (path: string): string => {
  if (path.length === 0) {
    return path;
  }

  let end = path.length;

  while (end > 1 && path[end - 1] === "/") {
    end -= 1;
  }

  return path.slice(0, end);
};

export function getShellPosixBasename(path: string): string {
  const normalized = trimTrailingSlashes(path);

  if (normalized === "/") {
    return "/";
  }

  if (normalized.length === 0) {
    return ".";
  }

  const slashIndex = normalized.lastIndexOf("/");

  return slashIndex < 0 ? normalized : normalized.slice(slashIndex + 1);
}

export function getShellPosixDirname(path: string): string {
  const normalized = trimTrailingSlashes(path);

  if (normalized === "/") {
    return "/";
  }

  if (normalized.length === 0 || normalized === "." || normalized === "..") {
    return ".";
  }

  const slashIndex = normalized.lastIndexOf("/");

  if (slashIndex < 0) {
    return ".";
  }

  if (slashIndex === 0) {
    return "/";
  }

  return trimTrailingSlashes(normalized.slice(0, slashIndex)) || "/";
}
