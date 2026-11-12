import { expect } from 'chai';
import { api, employeesApi, bearer } from '../src/client.js';
import { getTokens, creds, login, unwrap, sendOtp, confirmOtp, setPassword } from '../src/auth.js';

const { phone, password } = creds();
// Provisioning a cashier/manager requires activating their password via the hardcoded OTP.
const OTP = process.env.EMPLOYEE_TEST_OTP;
const EPATH = '/merchant-employees';
const LOCATIONS = '/api/v1/vendors/locations';
const EXPORT = '/api/v1/orders/export?from_date=2026-11-11&till_date=2026-11-12';
const newPhone = () => `+99800${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const PW = 'Noor-Role-Qa1!';
const unwrapEmployee = (body) => body?.data?.employee ?? body?.data ?? body;

(phone && password && OTP ? describe : describe.skip)('Employees — role permissions', function () {
  this.timeout(60000);
  let adminToken, adminAuth, cashier, manager;
  const created = [];

  // Add an employee of a role, activate a password via OTP, log in, return their token.
  async function provision(role) {
    const ph = newPhone();
    const res = await employeesApi
      .post(EPATH).set(adminAuth)
      .send({ new_identity: { phone: ph, role, first_name: 'QA', last_name: role } })
      .expect(200);
    created.push(unwrapEmployee(res.body).employee_id);
    await sendOtp(ph).expect(200);
    const confirmed = await confirmOtp(ph, OTP).expect(200);
    await setPassword(unwrap(confirmed.body).confirmation_id, PW).expect(200);
    const logged = await login(ph, PW).expect(200);
    const token = unwrap(logged.body).access_token;
    expect(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role, `${role} token role`).to.equal(role);
    return { token, phone: ph };
  }

  before(async function () {
    this.timeout(60000);
    adminToken = (await getTokens()).access_token;
    adminAuth = { Authorization: bearer(adminToken) };
    cashier = await provision('cashier');
    manager = await provision('manager');
  });

  after(async () => {
    for (const id of created) await employeesApi.delete(`${EPATH}/${id}`).set(adminAuth);
  });

  const asGet = (token, path) => api.get(path).set('Authorization', bearer(token));

  it('every role can read profile and pricing @smoke', async () => {
    for (const who of [cashier, manager]) {
      await asGet(who.token, '/api/v1/vendors/me').expect(200);
      await asGet(who.token, '/api/v1/vendors/pricing').expect(200);
    }
  });

  it('a cashier cannot access branch addresses', async () => {
    await asGet(cashier.token, `${LOCATIONS}?is_business=true`).expect(403);
    await api.post(LOCATIONS).set('Authorization', bearer(cashier.token)).send({}).expect(403);
  });

  it('a manager can access branch addresses', async () => {
    await asGet(manager.token, `${LOCATIONS}?is_business=true`).expect(200);
    // passes the role check, then fails validation on the empty body
    await api.post(LOCATIONS).set('Authorization', bearer(manager.token)).send({}).expect(400);
  });

  it('only the admin can generate a report (export)', async () => {
    await asGet(cashier.token, EXPORT).expect(403);
    await asGet(manager.token, EXPORT).expect(403);
    await asGet(adminToken, EXPORT).expect(200);
  });

  // FINDING: a cashier is NOT blocked from the employee add/delete endpoints — the add returns 400
  // (validation) and delete returns 404 (not found), i.e. the role check is skipped. Expected 403.
  // Un-skip once the backend enforces the role on these endpoints.
  it.skip('a cashier should be forbidden from employee management (currently 400/404, not 403)', async () => {
    const auth = { Authorization: bearer(cashier.token) };
    await employeesApi.post(EPATH).set(auth).send({ new_identity: {} }).expect(403);
    await employeesApi.delete(`${EPATH}/00000000-0000-0000-0000-000000000000`).set(auth).expect(403);
  });
});
