async function discoverRunPaths(base: string, agentName: string): Promise<string[]> {
  const paths: string[] = [];
  try {
    const res = await fetch(`${base}/openapi.json`);
    if (!res.ok) return paths;
    const spec = await res.json();
    if (!spec?.paths) return paths;
    const entries = Object.entries(spec.paths as Record<string, unknown>);
    for (const [p, methods] of entries) {
      const m = methods as Record<string, unknown>;
      const post = m["post"];
      if (!post) continue;
      // Restrict to likely agent endpoints only (avoid /apps/.../run_eval etc.)
      const lower = p.toLowerCase();
      const looksLikeAgent = lower.includes("/agent/") || lower.includes("/agents/");
      const mentionsAgent = lower.includes(agentName.toLowerCase());
      const isRun = lower.endsWith("/run") || lower.includes("/run");
      const isExecute = lower.endsWith("/execute") || lower.includes("/execute");
      if (looksLikeAgent && mentionsAgent && (isRun || isExecute)) {
        paths.push(p);
      }
    }
    // prioritize longer (more specific) paths
    paths.sort((a, b) => b.length - a.length);
  } catch {
    // ignore discovery errors; fallbacks will be used
  }
  return paths;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const base = process.env.ADK_UPSTREAM_URL || "http://127.0.0.1:8001";
    const agent = process.env.ADK_AGENT_NAME || "finwise_agent";
    const explicitPath = process.env.ADK_RUN_PATH; // e.g., /agent/finwise_agent/run
    const clientSessionId = typeof body?.sessionId === "string" ? body.sessionId : undefined;
    const clientUserId = typeof body?.userId === "string" ? body.userId : "web-user";

    // Candidate list: explicit > known fallbacks > discovered
    const candidates: string[] = [];
    if (explicitPath) {
      const path = explicitPath.startsWith("/") ? explicitPath : `/${explicitPath}`;
      candidates.push(`${base}${path}`);
    }

    // Fallbacks
    candidates.push(
      `${base}/agent/${agent}/run`,
      `${base}/agents/${agent}/run`,
      `${base}/agent/${agent}/execute`,
      `${base}/agents/${agent}/execute`
    );

    // Discovered (filtered)
    const discovered = await discoverRunPaths(base, agent);
    for (const p of discovered) candidates.push(`${base}${p}`);
    let lastResp: Response | null = null;

    // If the incoming payload already looks like a RunAgentRequest, forward as-is.
    const looksLikeRunRequest =
      body && typeof body === "object" && body.appName && body.newMessage && body.sessionId;

    // Otherwise, transform our frontend payload { transactions, prompt } into RunAgentRequest
    const runPayload = looksLikeRunRequest
      ? body
      : {
          appName: agent,
          userId: clientUserId,
          sessionId:
            clientSessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          streaming: false,
          newMessage: {
            role: "user",
            parts: [
              { text: (body?.prompt as string) || "Analyze these transactions and summarize." },
              // Provide transactions JSON as a separate text part the agent can use for tool args
              { text: JSON.stringify(body?.transactions ?? []) },
            ],
          },
        };

    for (const url of candidates) {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runPayload),
      });
      if (resp.status !== 404 && resp.status !== 405) {
        const text = await resp.text();
        return new Response(text, {
          status: resp.status,
          headers: {
            "Content-Type": resp.headers.get("content-type") || "application/json",
            "x-adk-upstream": url,
          },
        });
      }
      lastResp = resp;
    }

    if (lastResp) {
      const text = await lastResp.text();
      return new Response(text || JSON.stringify({ error: "Upstream endpoint not found" }), {
        status: lastResp.status,
        headers: { "Content-Type": lastResp.headers.get("content-type") || "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No upstream response" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
