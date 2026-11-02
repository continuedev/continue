# TLS Self-Signed Certificate Fix

> **Trạng thái:** Active — áp dụng trong branch `develop` / `release/v2.1.x-onprem`
> **File thay đổi chính:** `packages/fetch/src/getAgentOptions.ts`, `extensions/vscode/src/extension.ts`

---

## Vấn đề

Môi trường on-prem sử dụng **self-signed certificates** từ Internal CA (Nginx reverse proxy
trước các LLM servers). Node.js mặc định reject self-signed certs → Extension không kết nối
được đến bất kỳ API endpoint nào.

---

## Giải pháp đã áp dụng

Thay đổi default behavior của `getAgentOptions.ts`: `rejectUnauthorized` mặc định là `false`
(thay vì `true` như upstream), cho phép self-signed certs trong môi trường on-prem.

### `packages/fetch/src/getAgentOptions.ts`

```typescript
const agentOptions: { [key: string]: any } = {
  ca,
  // Default to false to allow self-signed certs for on-prem/internal services
  // Users can explicitly set verifySsl: true to enforce strict validation
  rejectUnauthorized: requestOptions?.verifySsl ?? false,
  timeout,
  sessionTimeout: timeout,
  keepAlive: true,
};
```

> **Khác với upstream:** Upstream default là `true` (secure). Custom build default là `false`
> nhưng user có thể override bằng `verifySsl: true` trong config.

### `extensions/vscode/src/extension.ts`

```typescript
// Cho phép self-signed certs toàn bộ extension activation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
```

---

## Config sử dụng (`config.yaml`)

```yaml
models:
  - name: "NIM — Nemotron Ultra"
    provider: openai
    apiBase: https://nim.internal.company.com/v1
    requestOptions:
      verifySsl: false        # Accept self-signed cert
      # caBundlePath: /path/to/ca.crt  # Optional: bundle CA cert thay vi skip verify
```

---

## Verify patch còn hoạt động

```bash
# Check getAgentOptions
grep -n "rejectUnauthorized\|verifySsl" packages/fetch/src/getAgentOptions.ts
# Expected: rejectUnauthorized: requestOptions?.verifySsl ?? false

# Check extension.ts
grep -n "NODE_TLS_REJECT_UNAUTHORIZED" extensions/vscode/src/extension.ts
# Expected: process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
```

---

## Lưu ý khi sync upstream

`getAgentOptions.ts` là file hay bị conflict khi rebase vì upstream thay đổi TLS logic thường xuyên.

Khi resolve conflict, **luôn giữ** `rejectUnauthorized: requestOptions?.verifySsl ?? false`
thay vì để về default `true` của upstream.

---

## So sánh với upstream

| | Upstream | Custom (on-prem) |
|---|---|---|
| Default `rejectUnauthorized` | `true` (strict) | `false` (permissive) |
| Override qua config | `verifySsl: false` để tắt | `verifySsl: true` để bật |
| `NODE_TLS_REJECT_UNAUTHORIZED` | Không set | `"0"` tại extension activation |

> **Lịch sử:** Phiên bản trước đã thử implement `insecureSkipVerify` field với priority
> logic phức tạp (`insecureSkipVerify > verifySsl > env var > default`). Phương án đơn
> giản hơn (default `false`) đủ đáp ứng nhu cầu on-prem và ít conflict hơn khi sync upstream.
