import { expect } from 'chai';
import { api, bearer } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/orders/eval';

(phone && password ? describe : describe.skip)('Orders — eval (delivery price estimate)', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('rejects an invalid body @smoke', async () => {
    const res = await api.post(URL).set('Authorization', bearer(token)).send({}).expect(400);
    expect(res.body).to.have.nested.property('error.code', 8003);
    expect(res.body.error.message).to.equal('invalid request');
    expect(res.body.error.details[0]).to.include({ issue: 'origin' }); // origin point is required
  });

  // A priced estimate needs a full, in-zone order payload:
  //   { origin: <point>, destination: [<point>, …], payment_type, equipment_id, door_to_door }
  // where each point is { location:{lat,long}, type:'origin'|'destination', address, client, products }.
  // The exact client/products sub-schemas aren't pinned yet — un-skip once confirmed.
  // Response (observed shape): total_delivery_price, additional_fixed_price, eta_to_pu, eta_to_del,
  //   order_distance, dead_head_distance, evaluated_stage, out_of_zone_points.
  it.skip('prices a valid in-zone order (TODO: confirm full order payload)', async () => {
    const body = {
      origin: { location: { lat: 41.311, long: 69.279 }, type: 'origin', address: 'QA origin', client: { name: 'QA', phone: '+998901234567' }, products: [] },
      destination: [{ location: { lat: 41.32, long: 69.25 }, type: 'destination', address: 'QA dest', client: { name: 'QA Rec', phone: '+998901234568' }, products: [] }],
      payment_type: 'PAYMENT_TYPE_CASH',
      equipment_id: 4,
      door_to_door: false,
    };
    const res = await api.post(URL).set('Authorization', bearer(token)).send(body).expect(200);
    expect(res.body).to.include.all.keys(['total_delivery_price', 'order_distance', 'eta_to_pu', 'eta_to_del']);
  });
});
