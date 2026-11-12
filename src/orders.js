import { api, bearer } from './client.js';

export const ORDERS = '/api/v1/orders';
const auth = (token) => ({ Authorization: bearer(token) });

// A valid in-zone delivery order (Tashkent). Shape matches the Vendors integration docs:
// origin/destination are arrays of points; delivery config is nested under `delivery`.
export function orderBody(overrides = {}) {
  return {
    vendor_order_id: `qa-${Date.now()}`,
    origin: [{
      location: { long: 69.279, lat: 41.311 }, order: 1, address: 'QA origin',
      entrance: '1', floor: 1, apartment: '1', comment: 'QA autotest',
      client: { phone: '+998901234567', name: 'QA Sender', email: '' },
    }],
    destination: [{
      location: { long: 69.25, lat: 41.32 }, order: 1, address: 'QA dest',
      entrance: '1', floor: 2, apartment: '2', comment: 'QA autotest',
      products: { type_id: 1, description: 'QA parcel', items: [] },
      client: { phone: '+998901234568', name: 'QA Receiver', email: '' },
    }],
    payment_type: 'BALANCE',
    delivery: { type: 'EXPRESS', time: null, send_link: false, door_to_door: false, product_paid: false, equipment_id: 4 },
    ...overrides,
  };
}

export const evalOrder = (token, body) => api.post(`${ORDERS}/eval`).set(auth(token)).send(body);
export const createOrder = (token, body) => api.post(ORDERS).set(auth(token)).send(body);
export const getOrder = (token, id) => api.get(`${ORDERS}/${id}`).set(auth(token));
export const cancelOrder = (token, id) => api.patch(`${ORDERS}/${id}/cancel`).set(auth(token));
export const myOrders = (token, qs = '') => api.get(`${ORDERS}/for-merchant${qs}`).set(auth(token));
