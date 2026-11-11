import { expect } from 'chai';
import { api, bearer, payload } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const REPORTS = '/api/v1/orders/reports';
const EXPORT = '/api/v1/orders/export';

(phone && password ? describe : describe.skip)('Orders — reports & export', () => {
  let token;
  before(async () => {
    token = (await getTokens()).access_token;
  });
  const auth = () => ({ Authorization: bearer(token) });

  describe('GET /orders/reports — list generated reports', () => {
    it('returns a paginated list of report records @smoke', async () => {
      const res = await api.get(`${REPORTS}?limit=5&skip=0`).set(auth()).expect(200);
      expect(res.body.data, 'data').to.be.an('array');
      for (const k of ['count', 'page_size', 'current_page', 'last_page'])
        expect(res.body[k], k).to.be.a('number');
      for (const r of res.body.data) {
        expect(r.id, 'id').to.be.a('number');
        for (const k of ['from_date', 'till_date', 'path', 'created_at']) expect(r, k).to.have.property(k);
      }
    });

    it('is rejected without a token', async () => {
      const res = await api.get(`${REPORTS}?limit=5&skip=0`).expect(401);
      expect(payload(res)).to.have.nested.property('error.code', 1001);
    });
  });

  describe('GET /orders/export — generate a report', () => {
    const from = '2026-11-01';
    const till = '2026-11-12';

    // NOTE: each call creates a new report record (an .xlsx file in the reports list).
    it('generates a report for a date range', async () => {
      const res = await api.get(`${EXPORT}?from_date=${from}&till_date=${till}`).set(auth()).expect(200);
      expect(res.body.id, 'id').to.be.a('number');
      expect(res.body.from_date, 'from_date echoed').to.equal(from);
      expect(res.body.till_date, 'till_date echoed').to.equal(till);
      expect(res.body.path, 'path').to.be.a('string').and.match(/\.xlsx$/);
      expect(res.body.created_at, 'created_at').to.be.a('string');
    });

    it('requires from_date and till_date', async () => {
      const res = await api.get(EXPORT).set(auth()).expect(400);
      expect(payload(res)).to.include.all.keys(['from_date', 'till_date']);
    });

    it('is rejected without a token', async () => {
      await api.get(`${EXPORT}?from_date=${from}&till_date=${till}`).expect(401);
    });
  });
});
