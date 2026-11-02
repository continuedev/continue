# Patch 11 — config.yaml Global Settings & Session Title Control

> **Ngày:** 2026-10-12
> **Custom version:** `2.2.1`
> **Commit:** `e2b3dff4b` — `feature - own titleSession Name`
> **Status:** Active (local only — chưa upstream)
> **PR:** —

---

## Vấn đề

Khai báo trong `config.yaml` bị **lặng lẽ bỏ qua**, không báo lỗi, không warning:

```yaml
disableSessionTitles: true      # bị nuốt
allowAnonymousTelemetry: false  # bị nuốt
disableIndexing: true           # bị nuốt
systemMessage: |                # bị nuốt
  ...
```

Hệ quả thực tế: `disableSessionTitles: true` không có tác dụng. Session title vẫn được
LLM sinh ra (`chatDescriber/describe`) với các noun-phrase vô nghĩa như
`"Continue Chat Session Naming"`, không theo quy ước đặt tên `NN-<task>`.

### Root cause

`baseConfigYamlSchema` trong `packages/config-yaml/src/schemas/index.ts` **không khai báo**
các khóa này. Zod mặc định là `strip` — mọi khóa lạ bị **loại âm thầm** ngay tại
`configYamlSchema.safeParse()`.

Điểm gây nhầm lẫn nhất: `core/config/load.ts:638` **có** dòng

```typescript
disableSessionTitles: final.disableSessionTitles,
```

Dòng này chỉ re-assign một field của `ContinueConfig` đã rỗng từ trước — nó **không phải**
điểm đọc YAML. Grep thấy khóa này trong `load.ts` nên dễ kết luận sai là "đã hỗ trợ".

Bằng chứng trước khi sửa:

```
keys after parse: name, version, schema, models
disableSessionTitles => undefined
systemMessage        => undefined
```

Các khóa này vốn chỉ hoạt động qua `config.json` (deprecated) hoặc `sharedConfig`.

---

## Thay đổi

Cần **4 tầng** — thiếu một tầng là chuỗi giá trị vẫn mất:

| # | File | Vai trò |
|---|------|---------|
| 1 | `packages/config-yaml/src/schemas/index.ts` | Khai báo khóa trong `baseConfigYamlSchema` để zod không strip |
| 2 | `packages/config-yaml/src/load/unroll.ts` | `unrollBlocks()` dựng `unrolledAssistant` mới từ đầu — phải copy thủ công các scalar |
| 3 | `core/index.d.ts` | Thêm `"config-yaml-systemMessage"` vào union `RuleSource` (closed union) |
| 4 | `core/config/yaml/loadYaml.ts` | Chuyển flags sang `ContinueConfig`; đẩy `systemMessage` vào `rules[0]` |
| 5 | `gui/src/redux/thunks/session.ts` | `getChatTitleFromMessage`: lấy **dòng đầu** thay vì dòng cuối |

### 1. Schema

```typescript
export const baseConfigYamlSchema = z.object({
  // ... existing keys ...
  allowAnonymousTelemetry: z.boolean().optional(),
  disableIndexing: z.boolean().optional(),
  disableSessionTitles: z.boolean().optional(),
  systemMessage: z.string().optional(),
});
```

`configYamlSchema`, `assistantUnrolledSchema`, `assistantUnrolledSchemaNonNullable` đều
extend `baseConfigYamlSchema` → một sửa bao trùm mọi parse path.

### 2. Unroll — tầng dễ bỏ sót nhất

`unrollBlocks()` khởi tạo object mới với chỉ 3 field (`name`, `version`,
`requestOptions`). Thêm schema mà quên bước này thì key **sống ở parse nhưng chết ở unroll**:

```typescript
const unrolledAssistant: AssistantUnrolled = {
  name: assistant.name,
  version: assistant.version,
  requestOptions: assistant.requestOptions,
  // Scalar global settings are not "blocks" - copy them verbatim so they
  // survive the unroll step
  schema: assistant.schema,
  metadata: assistant.metadata,
  env: assistant.env,
  allowAnonymousTelemetry: assistant.allowAnonymousTelemetry,
  disableIndexing: assistant.disableIndexing,
  disableSessionTitles: assistant.disableSessionTitles,
  systemMessage: assistant.systemMessage,
};
```

Đồng thời phải **omit** các scalar này khỏi mảng `sections` (kiểu
`(keyof Omit<ConfigYaml, ...>)[]`), vì chúng không phải block array.
Thiếu omit → 6 lỗi `TS2345`/`TS7053`.

### 4. systemMessage vào rules

```typescript
if (config.systemMessage) {
  continueConfig.rules.push({
    rule: config.systemMessage,
    source: "config-yaml-systemMessage",
  });
}
for (const rule of config.rules ?? []) { /* ... */ }
```

Push **trước** vòng lặp `rules` để `systemMessage` đứng đầu system prompt, khớp hành vi
cũ của `config.json` (`load.ts:513` dùng `unshift`).

### 5. Session title

```typescript
// TRƯỚC: dòng cuối non-empty
.filter((l) => l.trim() !== "").slice(-1)[0]

// SAU: dòng đầu non-empty, strip markdown prefix
.map((l) => l.replace(/^[#>\-*]+\s*/, "").trim())
.filter((l) => l !== "" && !/^-+$/.test(l))
.slice(0, 1)[0] || ""
```

Lý do: với `disableSessionTitles: true`, title lấy từ **tin nhắn mở đầu**. Quy ước đặt tên
`01-my-task` nằm ở dòng **đầu**, không phải dòng cuối.

---

## Luồng hoạt động

```
config.yaml
  └─ parseConfigYaml()          → zod giữ lại (schema đã khai báo)
      └─ unrollBlocks()         → copy scalar verbatim
          └─ configYamlToContinueConfig()
              ├─ ContinueConfig.disableSessionTitles
              └─ rules[0] = systemMessage
                  └─ finalToBrowserConfig()   → BrowserSerializedContinueConfig
                      └─ GUI: saveCurrentSession
                          ├─ disableSessionTitles=false → LLM chatDescriber
                          └─ disableSessionTitles=true  → getChatTitleFromMessage (dòng đầu)
```

Lưu ý cơ chế: title chỉ gán **một lần khi session được lưu** (`saveCurrentSession`), và chỉ
khi `title === NEW_SESSION_TITLE`. Phải **chuyển sang session khác** để thấy title đổi.

---

## Hướng đã loại trừ

| Hướng | Lý do loại |
|-------|-----------|
| Dùng `env:` trong config.yaml | `env` chỉ dùng cho `${{ secrets }}` substitution (`load.ts:79-89`) và **không có** trong `BrowserSerializedContinueConfig` → GUI không đọc được |
| Dựa vào `sharedConfig` | `modifyAnyConfigWithSharedConfig` sẽ **ghi đè** config.yaml nếu key tồn tại trong `globalContext.json` |
| Sửa `migrateSharedConfig.ts` | Chỉ strip key từ `config.json`, không liên quan đường YAML |

---

## Cách kiểm chứng

```bash
NODE=<node20-x>/node.exe
cd <repo>

# 1. Parse layer — keys phải còn
"$NODE" -e "
const {parseConfigYaml}=require('./packages/config-yaml/dist/load/unroll.js');
const r=parseConfigYaml('name: t\nversion: 1.0.0\ndisableSessionTitles: true\nsystemMessage: |\n  hello\nmodels: []\n');
console.log(r.disableSessionTitles, JSON.stringify(r.systemMessage));
"
# -> true "hello\n"

# 2. Unroll layer — tầng rủi ro cao nhất, phải test tường minh
"$NODE" -e "
(async()=>{
const {parseConfigYaml,unrollBlocks}=require('./packages/config-yaml/dist/load/unroll.js');
const p=parseConfigYaml('name: t\nversion: 1.0.0\ndisableSessionTitles: true\nsystemMessage: |\n  hello\nmodels:\n  - name: m1\n    provider: ollama\n    model: llama3\n');
const reg={async resolve(){return{config:{}}},async listWithPagination(){return{items:[],hasMore:false}}};
const {config}=await unrollBlocks(p,reg,undefined);
console.log(config.disableSessionTitles, JSON.stringify(config.systemMessage));
})()"
# -> true "hello\n"
```

> `tsc` **pass không đủ** để kết luận tầng unroll đúng — đó là object copy thủ công,
> thiếu field vẫn type-safe nếu field là optional. Phải chạy runtime check ở trên.

### Verify extension đã cài

```bash
EXT=~/.vscode/extensions/continue.continue-2.2.1
grep -c "config-yaml-systemMessage"            $EXT/out/extension.js   # 1
grep -c "Scalar global settings are not"       $EXT/out/extension.js   # 1
grep -c "disableSessionTitles: booleanType"    $EXT/out/extension.js   # 1
grep -c "slice(0,1)\[0\]"                      $EXT/gui/assets/index.js # 1
```

### Test thủ công

Reload Window → New Session (Ctrl+L) → gửi tin nhắn bắt đầu bằng `01-xyz...` →
**switch sang session khác** → title phải là `01-xyz...`, không có LLM call.

---

## Liên quan

- Patch 10 — WSL terminal output capture (cùng phiên làm việc)
- Build: xem [`deploy/01-build-extension/README.md`](../deploy/01-build-extension/README.md)
