const TRAVEL_MODES = new Set(['DRIVE', 'WALK', 'BICYCLE']);

function validate(body) {
  if (!body || typeof body !== 'object') {
    return 'body must be JSON object';
  }
  if (typeof body.latitude !== 'number' || isNaN(body.latitude) || body.latitude < -90 || body.latitude > 90) {
    return 'invalid latitude';
  }
  if (typeof body.longitude !== 'number' || isNaN(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    return 'invalid longitude';
  }
  if (typeof body.travelMode !== 'string' || !TRAVEL_MODES.has(body.travelMode)) {
    return 'travelMode must be DRIVE, WALK, or BICYCLE';
  }
  if (typeof body.travelDuration !== 'number' || !Number.isInteger(body.travelDuration) || body.travelDuration < 60 || body.travelDuration > 14400) {
    return 'travelDuration must be integer 60-14400';
  }
  return null;
}

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

async function computeIsochrone(dto) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Missing API key');

  const body = {
    location: { latitude: dto.latitude, longitude: dto.longitude },
    travelDuration: `${dto.travelDuration}s`,
    travelMode: dto.travelMode,
    routingPreference: dto.travelMode === 'DRIVE' ? (dto.routingPreference ?? 'TRAFFIC_AWARE') : 'TRAFFIC_UNAWARE',
    travelDirection: 'FROM',
    enableSmoothing: dto.enableSmoothing ?? true,
  };

  const res = await fetch(`https://isochrones.googleapis.com/v1/isochrones:generate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': '*' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data?.isochrone?.geoJson) {
    throw new Error('No reachable area');
  }

  return {
    polygons: [{ travelDuration: `${dto.travelDuration}s`, travelMode: dto.travelMode, geojson: data.isochrone.geoJson }],
    raw: data,
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method ?? 'POST';
  const path = event.requestContext?.http?.path ?? '/';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: json(200, {}).headers, isBase64Encoded: false };
  }

  if (path === '/health') {
    return json(200, { status: 'ok' });
  }

  if (method === 'POST' && path === '/isochrones') {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const err = validate(body);
      if (err) return json(400, { message: err });
      const result = await computeIsochrone(body);
      return json(200, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Internal error';
      if (msg === 'No reachable area') return json(204, { message: msg });
      if (msg.startsWith('Google API error')) return json(502, { message: msg });
      if (msg === 'Missing API key') return json(500, { message: msg });
      console.error(e);
      return json(500, { message: msg });
    }
  }

  return json(404, { message: 'Not found' });
}
