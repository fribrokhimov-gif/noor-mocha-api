import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const URL = '/api/v1/merchants/me'; // profile update (note: not vendors/me)
const ME = '/api/v1/vendors/me';

(phone && password ? describe : describe.skip)('Vendors — update profile (PATCH /merchants/me)', () => {
  let token;
  const patch = (body) => api.patch(URL).set('Authorization', bearer(token)).send(body);
  before(async () => {
    token = (await getTokens()).access_token;
  });

  it('rejects an empty name @smoke', async () => {
    const res = await patch({ name: '' }).expect(400);
    expect(payload(res)).to.have.nested.property('error.code', 9400);
    expect(res.body.error.details[0]).to.include({ field: 'name', issue: 'must not be empty' });
  });

  it('rejects an unknown field', async () => {
    const res = await patch({ lang: 'ru' }).expect(400); // only `name` is editable here
    const body = payload(res);
    expect(body).to.have.nested.property('error.code', 1006);
    expect(body.error.details[0]).to.include({ issue: 'unknown field' });
  });

  it('is rejected without a token', async () => {
    const res = await api.patch(URL).send({ name: 'QA' }).expect(401);
    expect(payload(res)).to.have.nested.property('error.code', 1001);
  });

  // Set-and-restore. Needs a restorable (non-empty) current name, since name must not be empty.
  it('updates the merchant name', async function () {
    const current = (await api.get(ME).set('Authorization', bearer(token)).expect(200)).body.name;
    if (!current) this.skip(); // empty name can't be restored (empty is rejected)
    try {
      await patch({ name: `${current} QA` }).expect(200);
      const updated = (await api.get(ME).set('Authorization', bearer(token)).expect(200)).body.name;
      expect(updated).to.equal(`${current} QA`);
    } finally {
      await patch({ name: current }); // restore
    }
  });
});
