export function formatVirtualVfsFileUri(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error("Virtual VFS file URIs require an absolute path.");
  }

  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");

  return `file://${encodedPath}`;
}
