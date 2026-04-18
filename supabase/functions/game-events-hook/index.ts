import { createClient } from "npm:@supabase/supabase-js@2";

type IncomingPayload = {
  type: string;
  description: string;
  fromTeamId?: number | null;
  fromTeamName?: string | null;
  toTeamId?: number | null;
  toTeamName?: string | null;
  epoch?: number;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return jsonResponse(200, { ok: true, service: "game-events-hook" });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const expectedSecret = Deno.env.get("EDGE_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!expectedSecret || bearer !== expectedSecret) {
    return jsonResponse(401, { ok: false, error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: "Missing Supabase runtime secrets" });
  }

  let payload: IncomingPayload;
  try {
    payload = (await req.json()) as IncomingPayload;
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  if (!payload.type || !payload.description) {
    return jsonResponse(400, { ok: false, error: "type and description are required" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase
    .from("game_events")
    .insert({
      type: payload.type,
      from_team_id: payload.fromTeamId ?? null,
      from_team_name: payload.fromTeamName ?? null,
      to_team_id: payload.toTeamId ?? null,
      to_team_name: payload.toTeamName ?? null,
      description: payload.description,
      epoch: payload.epoch ?? 0,
    })
    .select()
    .single();

  if (error) {
    return jsonResponse(500, { ok: false, error: error.message });
  }

  return jsonResponse(200, { ok: true, inserted: data });
});
