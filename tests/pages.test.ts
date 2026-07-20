import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("branch-root GitHub Pages entry uses compiled production assets", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /src\/main\.tsx/);
  assert.match(html, /\/solar_orbit\/assets\//);

  const assetUrls = [
    ...html.matchAll(/(?:src|href)="\/solar_orbit\/(assets\/[^"]+)"/g),
  ].map((match) => match[1]);
  assert.ok(assetUrls.length >= 2);
  await Promise.all(assetUrls.map((path) => access(new URL(path, projectRoot))));
  await access(new URL("../.nojekyll", import.meta.url));
});

test("development entry remains connected to the TypeScript source", async () => {
  const html = await readFile(new URL("../dev.html", import.meta.url), "utf8");
  assert.match(html, /src\/main\.tsx/);
});
