import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const nextDir = resolve(root, ".next");
const standaloneDir = resolve(nextDir, "standalone");
const outputDir = resolve(root, "dist");

if (!existsSync(resolve(standaloneDir, "server.js"))) {
  throw new Error("Next.js standalone output was not generated at .next/standalone/server.js");
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(standaloneDir, outputDir, { recursive: true });

const staticDir = resolve(nextDir, "static");
if (existsSync(staticDir)) {
  const packagedStaticDir = resolve(outputDir, ".next", "static");
  mkdirSync(packagedStaticDir, { recursive: true });
  cpSync(staticDir, packagedStaticDir, { recursive: true });

  // The server-capable deployment image uploads dist/public/* to the CDN.
  // Preserve the /_next/static URL hierarchy in that upload tree.
  const publicStaticDir = resolve(outputDir, "public", "_next", "static");
  mkdirSync(publicStaticDir, { recursive: true });
  cpSync(staticDir, publicStaticDir, { recursive: true });
}

const publicDir = resolve(outputDir, "public");
if (!existsSync(publicDir)) {
  throw new Error("Deployment CDN output was not generated at dist/public");
}

writeFileSync(
  resolve(outputDir, "index.js"),
  "import './server.js';\n",
  "utf8",
);

console.log("Packaged Next.js standalone runtime in dist/.");
