import { expect } from 'chai';
import { api, bearer } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/equipments';

(phone && password ? describe : describe.skip)('Equipments — /equipments', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('returns the equipment catalogue @smoke', async () => {
    const res = await api.get(URL).set('Authorization', bearer(token)).expect(200);
    expect(res.body.equipments, 'equipments').to.be.an('array').and.not.empty;
    const e = res.body.equipments[0];
    expect(e).to.include.all.keys([
      'id', 'name', 'photo', 'is_visible', 'width', 'height', 'length',
      'max_weight', 'max_range', 'max_volume', 'max_order_count', 'linked_equipments',
    ]);
    expect(e.id, 'id').to.be.a('number');
    expect(e.name, 'name').to.be.a('string');
    expect(e.is_visible, 'is_visible').to.be.a('boolean');
    for (const k of ['width', 'height', 'length', 'max_weight', 'max_range', 'max_volume', 'max_order_count'])
      expect(e[k], k).to.be.a('number');
    expect(e.linked_equipments, 'linked_equipments').to.be.an('array');
  });

  // NOTE: the catalogue is served without a token (public reference data). Confirm if intended.
  it('is reachable without a token', async () => {
    const res = await api.get(URL).expect(200);
    expect(res.body.equipments).to.be.an('array');
  });
});
