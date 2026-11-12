import request from 'supertest';

// Core API: auth + delivery. Override with API_BASE only to point at another env.
export const CORE_URL = process.env.API_BASE || 'https://core.test.api.noor.uz';
// Merchant-employees live on the eats host.
export const EMPLOYEES_URL = process.env.EMPLOYEES_API_URL || 'https://eats.test.api.noor.uz/api/v1';
// Authenticated endpoints require X-Platform: web | ios | android.
export const X_PLATFORM = process.env.X_PLATFORM || 'web';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function build(base, platform) {
  return Object.fromEntries(
    METHODS.map((m) => [
      m,
      (path) => {
        const req = request(base)[m](path).set('Accept', 'application/json');
        return platform ? req.set('X-Platform', X_PLATFORM) : req;
      },
    ]),
  );
}

// A client for a host: methods send X-Platform; `.anon` omits it (for the guard checks).
// For protected calls add .set('Authorization', bearer(token)).
export function clientFor(base) {
  const c = build(base, true);
  c.anon = build(base, false);
  return c;
}

export const api = clientFor(CORE_URL); // core: auth + delivery
export const employeesApi = clientFor(EMPLOYEES_URL); // eats: merchant-employees

export const bearer = (token) => `Bearer ${token}`;

// Generated files (reports) are served from the file host.
export const FILES_URL = process.env.FILES_URL || 'https://tback.noor.uz';
const binaryParser = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(Buffer.from(c)));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};
/** Download a generated file (e.g. a report's `path` like "reports/….xlsx") as a Buffer. */
export async function downloadFile(path) {
  const res = await request(FILES_URL).get(`/files/${path}`).buffer(true).parse(binaryParser);
  return res.body;
}

// Some gateway/middleware errors (missing X-Platform, auth failures) return JSON with a
// `text/plain` content-type, so Supertest leaves res.body empty. Read the body either way.
export function payload(res) {
  if (res.body && Object.keys(res.body).length) return res.body;
  try {
    return JSON.parse(res.text);
  } catch {
    return {};
  }
}
