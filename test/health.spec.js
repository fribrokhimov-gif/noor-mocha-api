import { expect } from 'chai';
import { api } from '../src/client.js';

// Placeholder: replace with a real endpoint (see CLAUDE.md "Next tasks").
describe('Health', () => {
  it('returns 200 @smoke', async () => {
    const res = await api.get('/health').expect(200);
    expect(res.body).to.be.an('object'); // TODO: confirm response shape
  });
});
