import { expect } from 'chai';
import { api, bearer } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/vendors/pricing';

// Prices are in sum, distances in metres, free_wait_time in minutes.
(phone && password ? describe : describe.skip)('Pricing — vendors/pricing', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });
  const get = () => api.get(URL).set('Authorization', bearer(token));

  it('returns the tariff with all sections @smoke', async () => {
    const p = (await get().expect(200)).body;
    for (const k of ['courier_call', 'door_to_door', 'payment_per_km', 'fixed_price', 'new_point', 'cancelled_paid_price'])
      expect(p.base_rate[k], `base_rate.${k}`).to.be.a('number');
    expect(p.base_rate).to.have.property('dynamic_pricings');
    expect(p.wait_time.free_wait_time, 'free_wait_time').to.be.a('number');
    expect(p.wait_time.price_per_minute_after, 'price_per_minute_after').to.be.a('number');
    expect(p.time_frame_coefficient, 'time_frame_coefficient').to.be.a('number');
    expect(p.calculate_discount_for_courier, 'calculate_discount_for_courier').to.be.a('boolean');
    for (const k of ['discount', 'discount_valid_from', 'discount_valid_till', 'tariff'])
      expect(p, k).to.have.property(k);
  });

  it('prices are not negative', async () => {
    const p = (await get().expect(200)).body;
    const nums = {
      ...Object.fromEntries(Object.entries(p.base_rate).filter(([, v]) => typeof v === 'number')),
      free_wait_time: p.wait_time.free_wait_time,
      price_per_minute_after: p.wait_time.price_per_minute_after,
      time_frame_coefficient: p.time_frame_coefficient,
    };
    for (const [k, v] of Object.entries(nums)) expect(v, k).to.be.at.least(0);
  });

  it('distance tiers are sorted by distance with no duplicates', async function () {
    const tiers = (await get().expect(200)).body.base_rate.dynamic_pricings ?? [];
    if (!tiers.length) this.skip();
    for (const t of tiers) {
      expect(t.distance, JSON.stringify(t)).to.be.above(0);
      expect(t.price, JSON.stringify(t)).to.be.at.least(0);
    }
    const distances = tiers.map((t) => t.distance);
    expect(distances).to.deep.equal([...distances].sort((a, b) => a - b));
    expect(new Set(distances).size).to.equal(distances.length);
  });

  it('discount dates are set only together with a discount', async () => {
    const p = (await get().expect(200)).body;
    if (p.discount == null) {
      expect(p.discount_valid_from).to.be.null;
      expect(p.discount_valid_till).to.be.null;
    } else {
      expect(p.discount).to.be.above(0).and.at.most(100);
    }
  });

  it('is rejected without a token', async () => {
    await api.get(URL).expect(401);
  });

  it('is rejected with an invalid token', async () => {
    await api.get(URL).set('Authorization', bearer('abc.def.ghi')).expect(401);
  });

  // The panel shows these fees from `tariff` (the summary base_rate/wait_time block
  // zeroes them out — see the known-bug test below). Each must carry a real value.
  describe('tariff — configured fees always have a value', () => {
    let tariff;
    before(async () => {
      tariff = (await get().expect(200)).body.tariff;
    });

    it('identifies the tariff', () => {
      expect(tariff).to.include.keys(['id', 'vendor_id', 'name']);
      expect(tariff.id, 'id').to.be.a('number');
      expect(tariff.name, 'name').to.be.a('string').and.not.empty;
    });

    it('base price (new point) has a value', () => {
      expect(tariff.price, 'tariff.price').to.be.a('number').and.above(0); // e.g. 5000 сум
    });

    it('order-cancel price has a value', () => {
      expect(tariff.cancelled_paid_price, 'cancelled_paid_price').to.be.a('number').and.above(0); // e.g. 12000 сум
    });

    it('free wait time has a value', () => {
      expect(tariff.free_wait_time, 'free_wait_time').to.be.a('number').and.above(0); // e.g. 10 min
    });

    it('price per minute after free wait has a value', () => {
      expect(tariff.price_per_minute_after_wait, 'price_per_minute_after_wait').to.be.a('number').and.above(0); // e.g. 500 сум
    });
  });

  // KNOWN BUG: the base_rate / wait_time summary returns 0 for fees the tariff defines,
  // so the panel reads them from `tariff`. Un-skip once the summary carries the real values.
  it.skip('summary block mirrors the tariff fees (known mismatch: summary returns 0)', async () => {
    const p = (await get().expect(200)).body;
    expect(p.wait_time.free_wait_time, 'free_wait_time').to.equal(p.tariff.free_wait_time);
    expect(p.wait_time.price_per_minute_after, 'price_per_minute_after').to.equal(p.tariff.price_per_minute_after_wait);
    expect(p.base_rate.cancelled_paid_price, 'cancelled_paid_price').to.equal(p.tariff.cancelled_paid_price);
  });
});
