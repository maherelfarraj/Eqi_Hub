import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://auth.equivista.net wss://auth.equivista.net https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
});

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const DEFAULT_PUBLIC_DIR = fileURLToPath(
  new URL("./dist/public/", import.meta.url),
);

function applySecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function resolveExistingFile(root, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return { error: 400 };
  }

  if (decodedPath.includes("\0")) return { error: 400 };

  const candidate = resolve(root, decodedPath.replace(/^\/+/, ""));
  if (!isInside(root, candidate)) return { error: 400 };

  try {
    const candidateStat = await stat(candidate);
    const filePath = candidateStat.isDirectory()
      ? resolve(candidate, "index.html")
      : candidate;
    const fileStat = candidateStat.isDirectory() ? await stat(filePath) : candidateStat;
    const canonicalPath = await realpath(filePath);

    if (!fileStat.isFile() || !isInside(root, canonicalPath)) {
      return { error: 404 };
    }

    return { filePath: canonicalPath, fileStat };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { error: 404 };
    }
    throw error;
  }
}

function cacheControlFor(pathname) {
  return pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}

async function sendFile(request, response, file, requestPathname) {
  response.statusCode = 200;
  response.setHeader(
    "Content-Type",
    CONTENT_TYPES.get(extname(file.filePath).toLowerCase()) ??
      "application/octet-stream",
  );
  response.setHeader("Content-Length", String(file.fileStat.size));
  response.setHeader("Last-Modified", file.fileStat.mtime.toUTCString());
  response.setHeader("Cache-Control", cacheControlFor(requestPathname));

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(file.filePath);
  stream.on("error", () => {
    if (!response.headersSent) response.statusCode = 500;
    response.end();
  });
  stream.pipe(response);
}

export async function createStaticServer({ publicDir = DEFAULT_PUBLIC_DIR } = {}) {
  const publicRoot = await realpath(publicDir);
  const indexFile = await resolveExistingFile(publicRoot, "/index.html");

  if (!indexFile.filePath) {
    throw new Error("Production index.html is missing from the public directory.");
  }

  return createServer(async (request, response) => {
    applySecurityHeaders(response);

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD");
      response.end("Method Not Allowed");
      return;
    }

    let requestUrl;
    try {
      requestUrl = new URL(request.url ?? "/", "http://localhost");
    } catch {
      response.statusCode = 400;
      response.end("Bad Request");
      return;
    }

    try {
      const requestedFile = await resolveExistingFile(
        publicRoot,
        requestUrl.pathname,
      );

      if (requestedFile.filePath) {
        await sendFile(request, response, requestedFile, requestUrl.pathname);
        return;
      }

      if (requestedFile.error === 400) {
        response.statusCode = 400;
        response.end("Bad Request");
        return;
      }

      const acceptsHtml = (request.headers.accept ?? "").includes("text/html");
      const looksLikeAsset = extname(requestUrl.pathname) !== "";

      if (acceptsHtml && !looksLikeAsset) {
        await sendFile(request, response, indexFile, "/index.html");
        return;
      }

      response.statusCode = 404;
      response.end("Not Found");
    } catch {
      response.statusCode = 500;
      response.end("Internal Server Error");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const server = await createStaticServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`EquiVista web service listening on port ${port}`);
  });
}
