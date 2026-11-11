# Noor merchant panel: API map

Source: `tmerchant.noor.uz` (test env), 2026-11-11. Built from logged-in panel traffic (read-only navigation), the JS bundle, and direct probes.
Status: **observed**, not a spec. Anything not marked as observed is `// TODO: confirm`.

## Hosts (from `/env.js`)

| Var | Host | Used for |
|---|---|---|
| `VITE_AUTH_API_URL` / `VITE_CORE_API_URL` | `core.test.api.noor.uz` | auth, Delivery (`/api/v1/vendors/*`, `/orders/*`) |
| `VITE_API_BASE_URL` | `test.api.noor.uz/api/v1` | Eats (`/merchant/*`), `merchants/me`, uploads |
| `VITE_MERCHANT_EMPLOYEE_API_BASE_URL` | `eats.test.api.noor.uz/api/v1` | `merchant-employees` |
| `VITE_FILE_API_URL` | `tback.noor.uz/files` | receipts, logos |
| `VITE_ROUTE_API_URL` | `routing.test.api.noor.uz` | routing (not probed) |
| `VITE_LEGACY_SOCKET_URL` | `wss://tback.noor.uz/ws` | realtime (not probed) |

## Required headers

- `X-Platform: web|ios|android` — **required on every authenticated call**. Missing → `400 {"message":"Invalid or missing X-Platform header…","code":1006}`. Login works without it.
- `Authorization: Bearer <access_token>`.

## Auth (observed)

| Call | Body | Result |
|---|---|---|
| `POST core/api/v1/auth/merchant` | `{phone, password}` | 200 `{data:{access_token, refresh_token}, meta:{timestamp}}` |
| same, wrong password | | 401 `{error:{code:5001,message:"invalid credentials"}}` |
| same, `{}` | | 400 `{error:{code:5000,message:"validation failed",details:[{field,issue:"required"}…]}}` |
| `POST core/api/v1/auth/refresh` | `{refresh_token}` | 200 new pair; **refresh tokens are single-use** (2nd use → 401) |
| `POST core/api/v1/auth/logout` | `{refresh_token}` + Bearer | 200; after it, access token → 401 and refresh → 401 |
| Other (bundle) | | `auth/change-password`, `auth/merchants/set-password`, `otp/send`, `otp/confirm` |

JWT: ES256, **TTL 5 min**, claims `aud exp iat iss phone role session_id sub type user_type`. Suites must refresh or re-login for runs > 5 min.

## Delivery — `core.test.api.noor.uz/api/v1`

Observed GET (200): `vendors/me`, `vendors/stats?from_date&till_date&type=daily`, `vendors/pricing`, `vendors/locations?is_business=true`, `vendors/clients?new_clients_from&new_clients_till&limit&skip`, `vendors/cards`, `vendors/invoices?limit&skip`, `vendors/broadcasts?limit&skip&status=fresh`, `vendors/broadcasts/unread-count`, `orders/for-merchant?limit&skip&from_date&till_date`, `orders/reports?limit&skip`, `ratings?limit&skip`, `equipments`, `geocode/map-keys`.
Pagination: `limit` / `skip`.

Writes (bundle only): `POST orders`, `POST orders/eval`, `POST orders/{id}/eval`, `POST orders/{id}/re-order`, `PATCH orders/{id}`, `PATCH orders/{id}/cancel`, `PATCH orders/{id}/payment/status`, `POST|DELETE orders/{id}/offer`, `GET orders/{id}`, `GET orders/{id}/couriers/{cid}/location`, `GET orders/export`, `POST orders/reports`, `POST|PATCH|DELETE vendors/locations[/{id}]`, `PATCH vendors/me`, `PATCH vendors/callback`, `POST vendors/integration/generate-token`, `PATCH vendors/broadcasts/{id}/respond|viewed`, `GET|PUT vendors/employees/{id}/locations`, `GET|POST chats`, `GET|POST chats/{id}/messages`, `POST gis/locations/validate`.

## Eats — `test.api.noor.uz/api/v1`

Observed GET (200): `merchants/me`, `merchants/me/realtime`, `merchant/capabilities`, `merchant/restaurants`, `merchant/product-categories`, `merchant/products?pagination.limit&pagination.offset`, `merchant/products/top?limit`, `merchant/promotions?range_start&range_end`, `merchant/reviews?pagination.limit`, `merchant/change-requests`, `merchant/orders/weekday-counts?created_from&created_to`, `orders/by-merchant`.
Pagination: `pagination.limit` / `pagination.offset`. List envelope: `{list:[…]}`.

Resources in bundle (CRUD + `/published` + `submit-for-review`): `merchant/restaurants` (+`/delivery-pricing`), `merchant/product-categories` (+`/order`), `merchant/products` (+`/by-restaurant`, `/restaurant-products`, `/modifier-groups`, `/images/reorder`, `/recommendations`, `modifiers-disabled`), `merchant/modifier-groups` (+`/options`, `/restaurants/{rid}/visibility`), `merchant/modifier-options/{id}`, `merchant/promotions` (+`/batch`, `/products`, `/by-restaurant`), `merchant/images/{entityType}/{parentId}`, `merchant/entities/{type}/bulk-delete`, `merchant/change-requests/{id}/cancel`, `merchant/orders/{id}/merchant-decision|preparation-status|restaurant-cancel`, `merchant/orders/by-restaurant[/{id}]`, `merchant/reviews/by-restaurant`, `merchant/support/conversations[/{id}/messages[/{mid}]]`, `merchant/provider-import/{menu,restaurants,jobs/{id}}`, `merchant/restaurant-categories`, `uploads/presign`.

## Employees — `eats.test.api.noor.uz/api/v1`

`GET merchant-employees` → 200 `{list:[], data:{}, meta:{timestamp}}`. `merchant-employees/{id}` (bundle).

## Error formats (4 different shapes)

| Shape | Seen on |
|---|---|
| `{error:{code,message,details?}}` | auth, Eats 404 (`code 4000 "product not found"`), core 403 (`code 1002`) |
| `{error:"unauthorized"}` | core 401 |
| `{error:{message:"unauthenticated",code:1001}}` | Eats / employees 401 |
| `{message, code}` (no `error`) | X-Platform 400 |
| `{error_msg:"404 Route Not Found"}` | non-UUID path param |
| `{error:"internal.server.error"}` | core 500 |

## Possible bugs / findings

1. **500 on bad query param**: `GET core/orders/for-merchant?limit=abc` → 500. Expected 400.
2. **No pagination validation**: `GET merchant/products?pagination.limit=-1` → 200 with data. Expected 400. `// TODO: confirm` intended behavior.
3. **Unknown order id → 403, not 404**: `GET core/orders/999999999` → 403 `permission denied`. May be deliberate (anti-enumeration). `// TODO: confirm`.
4. **Inconsistent error envelopes** across services (table above) — clients and tests must handle each.
5. **`/env.js` is public and exposes**: Yandex Maps/Geocoder/Places keys, Firebase config, Sentry DSN, and `VITE_MAP_KEYS_BASIC_AUTH` (Base64 user:password for the geocode service). Firebase/Sentry are normally public; the Basic-auth pair and Yandex keys should be checked with backend/security.
6. `merchant-employees` returns both `list` and an empty `data:{}` — odd envelope. `// TODO: confirm`.

## Suggested spec order for this repo

1. `auth.spec.js` @smoke — login, 400/401, refresh single-use, logout revokes.
2. `headers.spec.js` — X-Platform missing/invalid → 400 per host.
3. Eats read: `restaurants`, `product-categories`, `products` (404 known shape).
4. Delivery read: `vendors/me`, `orders/for-merchant` (incl. finding #1).
5. Eats CRUD with cleanup: category → product → promotion (mirrors `noor-api-tests/tests/eats/*`).
