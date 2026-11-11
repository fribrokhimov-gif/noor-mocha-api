import { expect } from 'chai';
import { employeesApi, bearer, payload } from '../src/client.js';
import { getTokens, creds, login, unwrap, sendOtp, confirmOtp, setPassword } from '../src/auth.js';

const { phone, password } = creds();
const PATH = '/merchant-employees';
// Adding an employee lets them log in after activating a password via OTP. In the test env the
// +99800XXXXXXX numbers take a hardcoded OTP — set it here to run the lifecycle, else it skips.
const OTP = process.env.EMPLOYEE_TEST_OTP;
// A fresh virtual number per run (any digits after +99800) so runs don't collide.
const newEmployeePhone = () => `+99800${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const EMP_PASSWORD = 'Noor-Emp-Qa1!'; // password the new employee sets via OTP, then logs in with

// Single employee from whichever shape the create/get responses use.
const unwrapEmployee = (body) => body?.data?.employee ?? body?.data ?? body;

(phone && password ? describe : describe.skip)('Employees — merchant-employees', () => {
  let auth;
  before(async () => {
    auth = { Authorization: bearer((await getTokens()).access_token) };
  });

  const add = (identity) => employeesApi.post(PATH).set(auth).send({ new_identity: identity });
  const list = async () => (await employeesApi.get(PATH).set(auth).expect(200)).body.list ?? [];

  describe('read, validation and access', () => {
    it('lists employees @smoke', async () => {
      const res = await employeesApi.get(PATH).set(auth).expect(200);
      expect(res.body.list, 'list').to.be.an('array');
    });

    it('an unknown employee id returns 404', async () => {
      const res = await employeesApi.get(`${PATH}/00000000-0000-0000-0000-000000000000`).set(auth).expect(404);
      expect(payload(res)).to.have.nested.property('error.code', 9401);
    });

    it("the admin's own phone cannot be added as a manager", async () => {
      const before = (await list()).length;
      const res = await add({ phone, role: 'manager', first_name: 'QA', last_name: 'Self' }).expect(403);
      expect(payload(res)).to.have.nested.property('error.code', 9402);
      expect(await list(), 'nothing was added').to.have.length(before);
    });

    it("the admin's own phone cannot be added as a cashier", async () => {
      const res = await add({ phone, role: 'cashier', first_name: 'QA', last_name: 'Self' }).expect(403);
      expect(payload(res)).to.have.nested.property('error.code', 9402);
    });

    it('a missing phone is rejected', async () => {
      const res = await add({ role: 'manager', first_name: 'QA', last_name: 'NoPhone' }).expect(400);
      expect(payload(res)).to.have.nested.property('error.code', 9400);
    });

    it('an invalid phone is rejected', async () => {
      const res = await add({ phone: 'abc', role: 'manager', first_name: 'QA', last_name: 'Bad' }).expect(400);
      const body = payload(res);
      expect(body).to.have.nested.property('error.code', 9400);
      expect(body.error.details.find((d) => d.field === 'phone').issue).to.match(/E\.164/);
    });

    it('an unknown role is rejected', async () => {
      const res = await add({ phone, role: 'superuser', first_name: 'QA', last_name: 'Role' }).expect(400);
      const body = payload(res);
      expect(body).to.have.nested.property('error.code', 9400);
      expect(body.error.details.find((d) => d.field === 'role').issue).to.match(/manager, cashier/);
    });

    it('list and add without a token are rejected', async () => {
      const l = await employeesApi.get(PATH).expect(401);
      expect(payload(l)).to.have.nested.property('error.code', 1001);
      await employeesApi.post(PATH).send({ new_identity: { phone: '+998000000000', role: 'manager' } }).expect(401);
    });
  });

  // Full lifecycle: the admin adds an employee, the employee activates a password via the
  // hardcoded OTP and logs in, the admin edits and removes them. Creates a real (virtual)
  // employee and cleans up. Skipped unless EMPLOYEE_TEST_OTP is set.
  (OTP ? describe : describe.skip)('add -> activate (OTP) -> login -> edit -> remove', () => {
    const empPhone = newEmployeePhone();
    let emp;

    after(async () => {
      if (emp?.employee_id) await employeesApi.delete(`${PATH}/${emp.employee_id}`).set(auth); // safety net
    });

    it('adds a manager @smoke', async () => {
      const res = await add({ phone: empPhone, role: 'manager', first_name: 'QA', last_name: 'Autotest' }).expect(200);
      emp = unwrapEmployee(res.body);
      expect(emp.employee_id, 'employee_id').to.be.a('string').and.not.empty;
      expect(emp).to.include({ phone: empPhone, role: 'manager', status: 'active', first_name: 'QA', last_name: 'Autotest' });
      expect(emp.merchant_id, 'merchant_id').to.be.a('string').and.not.empty;
    });

    it('new employee appears in the list and by id', async () => {
      expect((await list()).find((e) => e.employee_id === emp.employee_id), 'in list')
        .to.include({ phone: empPhone, role: 'manager' });
      const res = await employeesApi.get(`${PATH}/${emp.employee_id}`).set(auth).expect(200);
      expect(unwrapEmployee(res.body)).to.include({ employee_id: emp.employee_id, phone: empPhone, role: 'manager' });
    });

    it('the employee sets a password via OTP and logs in', async () => {
      await sendOtp(empPhone).expect(200);
      const confirmed = await confirmOtp(empPhone, OTP).expect(200);
      const { confirmation_id } = unwrap(confirmed.body);
      expect(confirmation_id, 'confirmation_id').to.be.a('string').and.not.empty;
      await setPassword(confirmation_id, EMP_PASSWORD).expect(200);

      const res = await login(empPhone, EMP_PASSWORD).expect(200);
      expect(unwrap(res.body).access_token, 'employee access_token').to.be.a('string').and.not.empty;
    });

    it('edits first and last name', async () => {
      const res = await employeesApi
        .patch(`${PATH}/${emp.employee_id}`).set(auth)
        .send({ first_name: 'QA-upd', last_name: 'Autotest-upd' }).expect(200);
      expect(unwrapEmployee(res.body)).to.include({ employee_id: emp.employee_id, first_name: 'QA-upd', last_name: 'Autotest-upd' });
    });

    it('removes the employee; they can no longer log in', async () => {
      const res = await employeesApi.delete(`${PATH}/${emp.employee_id}`).set(auth);
      expect(res.status, res.text).to.be.below(300);
      expect((await list()).map((e) => e.employee_id)).to.not.include(emp.employee_id);
      const relogin = await login(empPhone, EMP_PASSWORD);
      expect(relogin.status, 'login after removal is refused').to.be.at.least(400);
      emp = null;
    });
  });
});
