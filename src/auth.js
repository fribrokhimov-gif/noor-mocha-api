import { api, bearer } from './client.js';

export const creds = () => ({
  phone: process.env.MERCHANT_PHONE,
  password: process.env.MERCHANT_PASSWORD,
});

/** Login (and some other) responses wrap the useful fields in `data`. */
export const unwrap = (body) =>
  body && typeof body === 'object' && 'data' in body ? body.data : body;

/** POST /api/v1/auth/merchant { phone, password } */
export const login = (phone, password) =>
  api.post('/api/v1/auth/merchant').send({ phone, password });

/** Log in with the .env merchant and return { access_token, refresh_token }. */
export async function getTokens() {
  const { phone, password } = creds();
  if (!phone || !password)
    throw new Error('MERCHANT_PHONE / MERCHANT_PASSWORD not set (see .env.example)');
  const res = await login(phone, password);
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${res.text}`);
  const d = unwrap(res.body);
  if (!d?.access_token || !d?.refresh_token) throw new Error('Tokens missing in login response');
  return d;
}

/** POST /api/v1/auth/refresh { refresh_token } */
export const refresh = (refresh_token) =>
  api.post('/api/v1/auth/refresh').send({ refresh_token });

/** POST /api/v1/auth/logout — needs the access token; refresh_token in the body is revoked. */
export const logout = (access_token, refresh_token) => {
  const req = api.post('/api/v1/auth/logout');
  if (access_token) req.set('Authorization', bearer(access_token));
  return req.send(refresh_token ? { refresh_token } : {});
};

/** A protected Delivery endpoint, used to check that a token is accepted/revoked. */
export const VENDOR_ME = '/api/v1/vendors/me';
export const getMe = (access_token) => api.get(VENDOR_ME).set('Authorization', bearer(access_token));
