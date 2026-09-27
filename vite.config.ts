import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createVfsContentDevPlugin } from "./scripts/vfsContentDevPlugin.mjs";

const normalizeBasePath = (value: string): string => {
  if (value.length === 0 || value === "/") {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
};

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH ?? "/"),
  plugins: [react(), createVfsContentDevPlugin()],
});
