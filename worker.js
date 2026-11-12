import { onRequestGet as broadcastifyGet } from "./functions/api/broadcastify.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Keep the private API inside the Worker; static site files continue
    // to be served by the ASSETS binding.
    if (url.pathname === "/api/broadcastify") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
        });
      }
      return broadcastifyGet({ request, env, ctx });
    }

    return env.ASSETS.fetch(request);
  }
};
