import { expect } from 'chai';
import { api } from '../src/client.js';

// Placeholder example. Paths, payloads and expected values are NOT confirmed.
describe.skip('Orders (placeholder)', () => {
  let createdId;

  after(async () => {
    if (createdId) await api.delete(`/orders/${createdId}`);
  });

  it('creates an order @smoke', async () => {
    const res = await api.post('/orders').send({ /* TODO: confirm payload */ }).expect(201);
    createdId = res.body.id; // TODO: confirm id field
    expect(createdId).to.exist;
  });

  it('rejects invalid payload with 400', async () => {
    await api.post('/orders').send({}).expect(400);
  });

  it('rejects anonymous request with 401', async () => {
    await api.anon.get('/orders').expect(401);
  });

  it('returns 404 for unknown order', async () => {
    await api.get('/orders/does-not-exist').expect(404);
  });
});
