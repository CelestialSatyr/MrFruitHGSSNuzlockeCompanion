import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { editorApiPlugin } from "./server/editorApiPlugin.ts";

export default defineConfig(({ mode }) => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const env = loadEnv(mode, repoRoot, "");
  return {
    envDir: repoRoot,
    plugins: [
      react(),
      editorApiPlugin({
        repoRoot,
        ...(env.YOUTUBE_API_KEY ? { youtubeApiKey: env.YOUTUBE_API_KEY } : {}),
      }),
    ],
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
