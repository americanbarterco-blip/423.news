import express from "express";
import crypto from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { RoomConfiguration } from "@livekit/protocol";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "8kb" }));

const allowedOrigins = new Set([
  "https://423.news",
  "https://www.423.news",
  "https://preview.423.news"
]);
const requests = new Map();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: "Origin not allowed" });
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "423.news Claudia token service" }));

app.post("/getToken", async (req, res) => {
  try {
    const key = req.ip || "unknown";
    const now = Date.now();
    const recent = (requests.get(key) || []).filter((time) => now - time < 60_000);
    if (recent.length >= 12) return res.status(429).json({ error: "Please wait before starting another voice session." });
    recent.push(now);
    requests.set(key, recent);

    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: "Voice service is not configured yet." });
    }

    const roomName = "423-news-claudia";
    const identity = "visitor-" + crypto.randomUUID();
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: "423.news visitor",
      ttl: "10m"
    });
    token.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    token.roomConfig = new RoomConfiguration({
      agents: [{ agentName: "claudia-green" }]
    });
    const participantToken = await token.toJwt();
    return res.status(201).json({ server_url: LIVEKIT_URL, participant_token: participantToken });
  } catch (error) {
    console.error("Token creation failed:", error?.message || error);
    return res.status(500).json({ error: "Unable to start the voice session." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log("Claudia token service listening on", port));
