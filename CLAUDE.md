# CLAUDE.md — API test project

## Context

* Owner: Senior QA Engineer / QA Lead. Wants terse, executable output.
* Goal: AI-assisted API test automation. Claude writes and maintains tests; humans review; CI decides pass/fail.
* Related stack elsewhere: web E2E in Playwright + TypeScript, mobile in Appium (iOS). Postman used for API exploration.

## Stack (decided)

* Plain JavaScript, ESM (`"type": "module"`), Node 22
* Mocha 11 + Chai 6 + Supertest 7, dotenv for config
* Reports: mochawesome (HTML), mocha-junit-reporter (JUnit) via mocha-multi-reporters
* CI: GitHub Actions (`.github/workflows/api-tests.yml`), repo var `API_BASE`, secret `API_TOKEN`

## Layout

* `src/client.js`: Supertest wrapper. Use `api.get/post/put/patch/delete`; use `api.anon.*` for no-auth (401/403) checks. Never call `request()` directly in specs.
* `test/<resource>.spec.js`: one file per resource/flow. `orders.spec.js` is a placeholder example.
* `collections/`: put exported Postman collections (v2.1 JSON) here as source material.

## Commands

* `npm test`: all tests, HTML report in `reports/`
* `npm run test:smoke`: tests with `@smoke` in the title
* `npm run test:ci`: HTML + `reports/junit.xml`

## Conventions

* `describe` per resource, `it` per behavior; tag critical paths `@smoke`.
* Each spec: happy path, validation (400), auth (401/403), not found (404) where applicable.
* Assert status via Supertest `.expect(code)`, body via Chai `expect`.
* Tests create their own data and clean it up; no dependence on pre-existing records.
* Secrets only from env. Never hardcode tokens or real customer data.

## Rules for AI-written tests

* Do NOT invent expected values. If a value isn't in the collection, spec or response examples, write `// TODO: confirm` and leave the assertion loose.
* Never change an existing assertion's expected value just to make a test pass. Report it as a possible bug instead.
* Do not upgrade Mocha to 12: mocha-junit-reporter breaks on it.
* Run `npm test` after changes and report results.

## Next tasks

1. Convert Postman collections in `collections/` into specs here.
2. Replace the placeholder `orders.spec.js` and `/health` check with real endpoints.
3. Optional: add `ajv` response-schema validation from the OpenAPI spec.
