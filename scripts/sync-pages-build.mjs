import { cp, copyFile, rm } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const distRoot = new URL("../dist/", import.meta.url);
const builtHtml = new URL("dev.html", distRoot);
const distIndex = new URL("index.html", distRoot);
const rootIndex = new URL("index.html", projectRoot);
const distAssets = new URL("assets/", distRoot);
const rootAssets = new URL("assets/", projectRoot);

await copyFile(builtHtml, distIndex);
await rm(builtHtml);
await rm(rootAssets, { recursive: true, force: true });
await cp(distAssets, rootAssets, { recursive: true });
await copyFile(distIndex, rootIndex);

console.log("Synchronized the production build for branch-based GitHub Pages.");
