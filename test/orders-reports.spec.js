import { expect } from 'chai';
import ExcelJS from 'exceljs';
import { api, bearer, payload, downloadFile } from '../src/client.js';
import { getTokens, creds } from '../src/auth.js';

const { phone, password } = creds();
const REPORTS = '/api/v1/orders/reports';
const EXPORT = '/api/v1/orders/export';
const STATS = '/api/v1/vendors/stats';

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

  // Download the generated .xlsx and verify its contents. Uses settled past dates so the
  // numbers are stable; asserts relationships (not hardcoded counts) that hold for any data.
  describe('report contents (.xlsx)', function () {
    this.timeout(60000);
    const D0 = '2026-11-10', D1 = '2026-11-11', D2 = '2026-11-12';

    const exportRange = (from, till) =>
      api.get(`${EXPORT}?from_date=${from}&till_date=${till}`).set(auth());

    // Download the report's xlsx and return { header, dataRows }.
    async function report(from, till) {
      const res = await exportRange(from, till).expect(200);
      const buf = await downloadFile(res.body.path);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      return { header: ws.getRow(1).values.slice(1).map(String), dataRows: ws.rowCount - 1 };
    }

    async function orderCount(from, till) {
      const res = await api.get(`${STATS}?from_date=${from}&till_date=${till}&type=daily`).set(auth()).expect(200);
      const buckets = Array.isArray(res.body) ? res.body : [];
      return buckets.reduce((sum, b) => sum + b.count, 0);
    }

    it('a one-day report is an xlsx with one row per order @smoke', async () => {
      const r = await report(D1, D2);
      expect(r.header[0], 'first column').to.equal('Sotuvchi ID');
      expect(r.header, 'column count').to.have.length(34);
      expect(r.dataRows, 'row count = orders in range').to.equal(await orderCount(D1, D2));
    });

    it('a two-day report equals the sum of its two one-day reports', async () => {
      const [a, b, ab] = [await report(D0, D1), await report(D1, D2), await report(D0, D2)];
      expect(ab.dataRows, 'two-day = dayA + dayB').to.equal(a.dataRows + b.dataRows);
      expect(ab.dataRows, 'two-day >= each one-day').to.be.at.least(Math.max(a.dataRows, b.dataRows));
      expect(ab.dataRows, 'two-day row count = orders in range').to.equal(await orderCount(D0, D2));
    });
  });
});
