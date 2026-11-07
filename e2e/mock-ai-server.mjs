// Stand-in for the FastAPI AI service during e2e tests (same contract as ai-service/).
// The embedding is derived from a hash of the image bytes: the same photo always yields the same
// vector (similarity 1.0) and different photos yield near-orthogonal vectors (similarity ≈ 0).
// POST /__mode {"mode":"up"|"down"} switches between a working service and HTTP 503.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.env.MOCK_AI_PORT ?? 8010);
const KEY = process.env.AI_SERVICE_KEY ?? "e2e-service-key";
const DIM = 2152;
let mode = "up";

function embeddingFor(bytes) {
  let seed = createHash("sha256").update(bytes).digest().readUInt32LE(0) || 1;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0xffffffff) * 2 - 1;
  };
  const v = Array.from({ length: DIM }, next);
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const body = await readBody(req);
  if (req.url === "/__mode" && req.method === "POST") {
    mode = JSON.parse(body.toString() || "{}").mode === "down" ? "down" : "up";
    return send(res, 200, { mode });
  }
  if (req.url === "/health") return send(res, 200, { status: "ok", model_version: "mock", embedding_dim: DIM });
  if (req.url === "/v1/analyze" && req.method === "POST") {
    if (mode === "down") return send(res, 503, { error: "down" });
    if (req.headers["x-service-key"] !== KEY) return send(res, 401, { error: "unauthorized" });
    // The multipart envelope differs per request, so hash only the file part.
    const boundary = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "")?.[1] ?? "";
    const start = body.indexOf("\r\n\r\n") + 4;
    const end = body.lastIndexOf(Buffer.from(`\r\n--${boundary}`));
    const image = body.subarray(start, end > start ? end : body.length);
    return send(res, 200, {
      quality: { ok: true, reasons: [], blur: 250, brightness: 120, width: 640, height: 480 },
      detection: { found: true, box: [10, 10, 300, 300], score: 0.9 },
      embedding: embeddingFor(image),
      model_version: "mock-ai",
    });
  }
  send(res, 404, { error: "not_found" });
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`mock ai listening on ${PORT}\n`);
});
