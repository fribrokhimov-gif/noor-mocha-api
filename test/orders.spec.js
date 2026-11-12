import { expect } from 'chai';
import { payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';
import { orderBody, evalOrder, createOrder, getOrder, cancelOrder, myOrders } from '../src/orders.js';

const { phone, password } = creds();
// Creating an order dispatches a real courier search, so the create->cancel lifecycle is opt-in.
const CREATE = process.env.ORDER_CREATE;
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

(phone && password ? describe : describe.skip)('Orders — delivery', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  describe('eval — price estimate', () => {
    it('prices a valid in-zone order @smoke', async () => {
      const res = await evalOrder(token, orderBody()).expect(200);
      expect(res.body.total_delivery_price, 'total_delivery_price').to.be.a('number').and.above(0);
      expect(res.body.order_distance, 'order_distance (m)').to.be.a('number').and.above(0);
      expect(res.body.evaluated_stage, 'evaluated_stage').to.equal(1); // 1 = good to go
      for (const k of ['eta_to_pu', 'eta_to_del', 'dead_head_distance', 'additional_fixed_price'])
        expect(res.body, k).to.have.property(k);
    });

    it('rejects an invalid body', async () => {
      const res = await evalOrder(token, {}).expect(400);
      expect(res.body).to.have.nested.property('error.code', 8003);
      expect(res.body.error.details[0]).to.include({ issue: 'origin' });
    });
  });

  // Required-field validation at create. These are rejected (400) so no order is created.
  describe('create — required fields', () => {
    it('rejects an order with no receiver phone', async () => {
      const body = orderBody();
      delete body.destination[0].client.phone;
      const res = await createOrder(token, body).expect(400);
      expect(Object.keys(payload(res)), 'names the missing phone field').to.include('destination[0].client.phone');
    });

    it('rejects an order with no sender phone', async () => {
      const body = orderBody();
      delete body.origin[0].client.phone;
      const res = await createOrder(token, body).expect(400);
      expect(Object.keys(payload(res))).to.include('origin[0].client.phone');
    });

    it('rejects an order with no client block', async () => {
      const body = orderBody();
      delete body.destination[0].client;
      await createOrder(token, body).expect(400);
    });

    // FINDING: address is not enforced — an order with no address is accepted and created
    // (should be 400). Skipped so the suite doesn't create orders; un-skip once enforced.
    it.skip('should reject an order with no address (currently accepted and created)', async () => {
      const body = orderBody();
      delete body.destination[0].address;
      await createOrder(token, body).expect(400);
    });
  });

  // Creates a REAL order and cancels it. Opt-in via ORDER_CREATE so CI doesn't dispatch couriers.
  (CREATE ? describe : describe.skip)('create -> get -> list -> cancel', () => {
    let id;

    after(async () => {
      if (id) await cancelOrder(token, id); // safety net if a step failed before cancel
    });

    it('creates an order @smoke', async () => {
      const res = await createOrder(token, orderBody()).expect(200);
      expect(res.body.stage, 'stage').to.equal(1);
      const o = res.body.order;
      id = o.id;
      expect(id, 'order id').to.be.a('number');
      expect(o.display_id, 'display_id').to.be.a('number');
      expect(o.payment_type, 'payment_type').to.equal('BALANCE');
      expect(o.origin, 'origin').to.have.length(1);
      expect(o.destination, 'destination').to.have.length(1);
    });

    it('is retrievable by id with full detail', async () => {
      const res = await getOrder(token, id).expect(200);
      expect(res.body.id).to.equal(id);
      expect(res.body).to.include.all.keys(['pricing', 'distances', 'delivery', 'stage', 'payment_type', 'origin', 'destination']);
    });

    it('appears in the merchant orders list', async () => {
      const res = await myOrders(token, `?limit=20&skip=0&from_date=${day(0)}&till_date=${day(1)}`).expect(200);
      expect(res.body.data.map((o) => o.id), 'list contains the new order').to.include(id);
    });

    it('can be cancelled', async () => {
      await cancelOrder(token, id).expect(204);
      const res = await getOrder(token, id).expect(200);
      expect(res.body.stage, 'cancelled stage').to.be.at.least(20); // 22 = cancelled
      id = null;
    });
  });
});
