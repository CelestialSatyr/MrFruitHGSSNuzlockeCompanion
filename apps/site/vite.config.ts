import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const requiredPublicAssets = [
  "JohtoMap.png",
  "badges/zephyr.png",
  "badges/hive.png",
  "badges/plain.png",
  "badges/fog.png",
  "badges/storm.png",
  "badges/mineral.png",
  "badges/glacier.png",
  "badges/rising.png",
] as const;

for (const asset of requiredPublicAssets) {
  const assetPath = resolve(siteRoot, "public", asset);
  if (!existsSync(assetPath)) {
    throw new Error(
      `Missing required public asset: ${assetPath}. Restore the asset before running or building the site.`,
    );
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
