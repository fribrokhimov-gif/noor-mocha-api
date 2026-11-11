import { expect } from 'chai';
import { api, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';
import {
  LOCATIONS, TASHKENT, LONDON,
  addressBody, createAddress, updateAddress, deleteAddress, listAddresses, validatePoint,
} from '../src/branches.js';

const { phone, password } = creds();

(phone && password ? describe : describe.skip)('Addresses — vendors/locations', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });

  describe('create -> list -> update -> delete', () => {
    const name = `QA-autotest-${Date.now()}`;
    let id;

    after(async () => {
      if (id != null) await deleteAddress(token, id); // safety net if a step failed before delete
    });

    it('create returns the new address @smoke', async () => {
      const res = await createAddress(token, addressBody(name, 'QA test address')).expect(200);
      id = res.body.id;
      expect(id, 'id').to.be.a('number');
      // the API collapses the {ru,en,uz} address to a single string
      expect(res.body).to.include({ name, address: 'QA test address', is_business: true, floor: 3, client_phone: '+998901234567' });
      expect(res.body.location).to.deep.equal(TASHKENT);
    });

    it('list and search find the new address', async () => {
      expect((await listAddresses(token)).map((b) => b.id)).to.include(id);
      const found = await listAddresses(token, name);
      expect(found.map((b) => b.id)).to.deep.equal([id]);
    });

    it('update changes name, address and floor', async () => {
      await updateAddress(token, id, addressBody(`${name}-upd`, 'QA updated address', { floor: null })).expect(200);
      const b = (await listAddresses(token)).find((x) => x.id === id);
      expect(b).to.include({ name: `${name}-upd`, address: 'QA updated address' });
      expect(b.floor).to.be.null;
    });

    it('delete removes the address; deleting again is 404', async () => {
      await deleteAddress(token, id).expect(204);
      expect((await listAddresses(token)).map((b) => b.id)).to.not.include(id);
      await deleteAddress(token, id).expect(404);
      id = null;
    });
  });

  describe('list, validation and access', () => {
    it('list returns addresses with the expected fields', async () => {
      const list = await listAddresses(token);
      expect(list).to.be.an('array');
      for (const b of list) {
        expect(b.id, 'id').to.be.a('number');
        expect(b.location, 'location').to.have.keys('lat', 'long');
        expect(b, 'is_business').to.have.property('is_business');
      }
    });

    it('create without a location is rejected', async () => {
      const { location, ...body } = addressBody('QA-no-location', 'x');
      const res = await createAddress(token, body).expect(400);
      expect(payload(res)).to.have.property('location');
    });

    it('search with no match returns an empty list', async () => {
      expect(await listAddresses(token, 'zzqx-no-such-address-91')).to.have.length(0);
    });

    it('delete of an unknown id returns 404', async () => {
      await deleteAddress(token, 1).expect(404);
    });

    it('list and create without a token are rejected', async () => {
      await api.get(LOCATIONS).query({ is_business: true }).expect(401);
      await api.post(LOCATIONS).send(addressBody('QA-no-token', 'x')).expect(401);
    });
  });

  describe('service area — gis/locations/validate', () => {
    it('a point inside the service area is accepted', async () => {
      await validatePoint(token, { location: TASHKENT }).expect(204);
    });

    it('a point outside the service area is rejected', async () => {
      const res = await validatePoint(token, { location: LONDON }).expect(403);
      expect(payload(res)).to.deep.equal({ error: 'out.of.bounds' });
    });

    it('a missing location is rejected', async () => {
      await validatePoint(token, {}).expect(400);
    });
  });
});
