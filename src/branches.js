import { api, bearer } from './client.js';

// Branch addresses — Delivery vendors/locations API.
export const LOCATIONS = '/api/v1/vendors/locations';
export const VALIDATE = '/api/v1/gis/locations/validate';
export const TASHKENT = { lat: 41.311, long: 69.279 };
export const LONDON = { lat: 51.5, long: -0.12 };

const auth = (token) => ({ Authorization: bearer(token) });

// Body as the panel sends it: one address string copied into ru/en/uz, empty fields as null.
export function addressBody(name, address, overrides = {}) {
  return {
    location: TASHKENT,
    address: { ru: address, en: address, uz: address },
    name,
    shop_id: null,
    external_id: null,
    floor: 3,
    apartment: null,
    entrance: null,
    door_phone: null,
    comment: null,
    client_phone: '+998901234567',
    client_name: null,
    is_business: true,
    ...overrides,
  };
}

export const createAddress = (token, body) => api.post(LOCATIONS).set(auth(token)).send(body);
export const updateAddress = (token, id, body) => api.patch(`${LOCATIONS}/${id}`).set(auth(token)).send(body);
export const deleteAddress = (token, id) => api.delete(`${LOCATIONS}/${id}`).set(auth(token));
export const validatePoint = (token, body) => api.post(VALIDATE).set(auth(token)).send(body);

/** GET vendors/locations — the API answers `null` for no matches, so treat that as []. */
export async function listAddresses(token, search) {
  const req = api.get(LOCATIONS).set(auth(token)).query({ is_business: true });
  if (search) req.query({ search });
  const res = await req;
  return res.body ?? [];
}
