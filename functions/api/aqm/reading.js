const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-device-token",
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrFallback(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : fallback;
}

function boolFrom(...values) {
  const value = values.find((item) => item !== undefined && item !== null);

  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  if (typeof value === "number") return value !== 0;

  return Boolean(value);
}

function normalizeReading(body) {
  const now = new Date().toISOString();

  const pm1 = numberOrNull(body.pm1);
  const pm25 = numberOrNull(body.pm25);
  const pm10 = numberOrNull(body.pm10);

  return {
    ok: true,

    deviceId: stringOrFallback(body.deviceId || body.device_id, "nbaqm-prototype-001"),
    deviceName: stringOrFallback(body.deviceName || body.device_name, "NBAQM Prototype"),
    deviceModel: stringOrFallback(body.deviceModel || body.device_model, "NBAQM-PM-DEV"),
    firmwareVersion: stringOrFallback(body.firmwareVersion || body.firmware_version, "unknown"),
    location: stringOrFallback(body.location, "Prototype Bench"),

    pm1,
    pm25,
    pm10,

    pm1Cf: numberOrNull(body.pm1Cf || body.pm1_cf),
    pm25Cf: numberOrNull(body.pm25Cf || body.pm25_cf),
    pm10Cf: numberOrNull(body.pm10Cf || body.pm10_cf),

    unit: stringOrFallback(body.unit, "ug/m3"),
    status: stringOrFallback(body.status, "UNKNOWN"),

    wifiRssi: numberOrNull(body.wifiRssi ?? body.wifi_rssi),
    uptimeMs: numberOrNull(body.uptimeMs ?? body.uptime_ms),
    lastValidFrameMs: numberOrNull(body.lastValidFrameMs ?? body.last_valid_frame_ms),

    deviceOnline: boolFrom(body.deviceOnline, body.wifiConnected, body.wifi_connected),
    sensorOnline: boolFrom(body.sensorOnline, body.sensor_online),
    wifiConnected: boolFrom(body.wifiConnected, body.wifi_connected),

    temperature: numberOrNull(body.temperature),
    humidity: numberOrNull(body.humidity),

    ip: stringOrFallback(body.ip, ""),
    source: stringOrFallback(body.source, "esp32_cloudflare_aqm"),

    updatedAt: now,
    receivedAt: now,
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AQM_LATEST) {
    return jsonResponse(
      {
        ok: false,
        error: "AQM_LATEST KV binding missing",
      },
      500
    );
  }

  if (!env.DEVICE_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "DEVICE_TOKEN environment variable missing",
      },
      500
    );
  }

  const token = request.headers.get("x-device-token");

  if (token !== env.DEVICE_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized device",
      },
      401
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body",
      },
      400
    );
  }

  const reading = normalizeReading(body);

  if (reading.pm25 === null || reading.pm1 === null || reading.pm10 === null) {
    return jsonResponse(
      {
        ok: false,
        error: "Missing PM readings",
      },
      400
    );
  }

  await env.AQM_LATEST.put("latest", JSON.stringify(reading));

  return jsonResponse({
    ok: true,
    message: "AQM reading stored",
    updatedAt: reading.updatedAt,
    pm25: reading.pm25,
  });
}
