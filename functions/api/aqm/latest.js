const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.AQM_LATEST) {
    return jsonResponse(
      {
        ok: false,
        error: "AQM_LATEST KV binding missing",
      },
      500
    );
  }

  const latest = await env.AQM_LATEST.get("latest", "json");

  if (!latest) {
    return jsonResponse(
      {
        ok: false,
        error: "No AQM reading stored yet",
      },
      404
    );
  }

  const updatedAtMs = latest.updatedAt ? new Date(latest.updatedAt).getTime() : 0;
  const ageMs = updatedAtMs ? Date.now() - updatedAtMs : null;

  const stale = ageMs !== null && ageMs > 30000;

  return jsonResponse({
    ...latest,
    ageMs,
    deviceOnline: stale ? false : latest.deviceOnline,
    sensorOnline: stale ? false : latest.sensorOnline,
    stale,
  });
}
