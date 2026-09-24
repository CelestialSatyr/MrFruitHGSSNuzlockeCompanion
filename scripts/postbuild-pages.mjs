import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("apps/site/dist");

await copyFile(resolve(dist, "index.html"), resolve(dist, "404.html"));
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, ".nojekyll"), "", "utf8");

console.log("GitHub Pages fallback generated: apps/site/dist/404.html");
