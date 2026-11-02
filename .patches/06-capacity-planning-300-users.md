# Performance Evaluation Strategy — Capacity Planning for 300 Users

> **Status:** Proposal (bổ sung cho `07-performance-monitoring.md`)
> **Last updated:** 2026-08-03
> **Goal:** Đánh giá khả năng phục vụ 300 developers trước khi rollout

---

## 1. Đánh giá document hiện tại (07-performance-monitoring.md)

### Điểm mạnh
- ✅ Phân tích kỹ infrastructure Continue đã có
- ✅ 3 phương án rõ ràng, progressive (stats page → SQLite → proxy)
- ✅ Code implementation chi tiết, có thể áp dụng ngay

### Thiếu sót cho use-case 300 users

| Cần có | 07-performance-monitoring.md | Gap |
|--------|:---:|-----|
| Load testing (active) | ❌ | Không có stress test trước rollout |
| Concurrent user simulation | ❌ | Chỉ monitor passive |
| Server-side metrics (vLLM native) | ❌ | Chỉ focus client-side |
| Capacity planning | ❌ | Không tính toán concurrent budget |
| SLA definition | ❌ | Không có target metrics |

### Kết luận

Document hiện tại phù hợp cho **Phase 2+ (production monitoring)** sau khi đã rollout. Nhưng trước rollout, cần **Phase 0: Load Testing** để xác định capacity thực tế.

---

## 2. Strategy đề xuất: 4 Phases

```mermaid
flowchart LR
    A[Phase 0<br/>Load Testing] --> B[Phase 1<br/>Server Metrics]
    B --> C[Phase 2<br/>Client Monitoring]
    C --> D[Phase 3<br/>Production Dashboard]
    
    style A fill:#ff6b6b,color:#fff
    style B fill:#ffa726,color:#fff
    style C fill:#66bb6a,color:#fff
    style D fill:#42a5f5,color:#fff
```

---

## 3. Phase 0: Load Testing (TRƯỚC rollout) ⭐ CRITICAL

### Mục tiêu

Xác định:
1. **Max concurrent requests** trước khi latency degrade
2. **TTFT p95** ở các mức concurrency (1, 5, 10, 20, 50)
3. **Throughput** (tokens/second tổng)
4. **Breakpoint** — khi nào server bắt đầu queue/reject

### Tool: `vllm bench serve` (official, built-in)

vLLM 0.26.0 có sẵn CLI benchmark, không cần cài thêm gì:

```bash
# SSH to server
ssh devops-gpu-vt-tpb
source /data/dev/miniconda3/etc/profile.d/conda.sh && conda activate vllm

# Benchmark DeepSeek V4 Flash XL (đang serve port 7021)
vllm bench serve \
  --model deepseek-ai/DeepSeek-V4-Flash \
  --base-url http://localhost:7021 \
  --endpoint /v1/chat/completions \
  --num-prompts 100 \
  --request-rate 5 \
  --random-input-len 2000 \
  --random-output-len 500 \
  --api-key sk-dev-h200-MC0bjr1Kow
```

### Test Matrix

| Test | Concurrent | Input Len | Output Len | Simulates |
|------|:----------:|:---------:|:----------:|-----------|
| Baseline | 1 | 2000 | 500 | Single user, short prompt |
| Light | 5 | 4000 | 1000 | 5 users chatting |
| Medium | 10 | 8000 | 2000 | Active hour |
| Heavy | 20 | 16000 | 4000 | Peak load |
| Stress | 50 | 32000 | 4000 | Worst case |
| Long context | 5 | 100000 | 4000 | Vibe coding (large files) |

### Script tự động

```bash
#!/bin/bash
# bench-capacity.sh — Run capacity benchmark suite

BASE_URL="http://localhost:7021"
MODEL="deepseek-ai/DeepSeek-V4-Flash"
API_KEY="sk-dev-h200-MC0bjr1Kow"
RESULTS_DIR="/data/dev/logs/benchmarks/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "=== Capacity Benchmark Suite ==="
echo "Model: $MODEL"
echo "Results: $RESULTS_DIR"
echo ""

for RATE in 1 5 10 20 50; do
  for INPUT_LEN in 2000 8000 32000; do
    OUTPUT_LEN=2000
    NUM_PROMPTS=$((RATE * 20))  # 20 seconds worth
    
    echo "--- Rate=$RATE req/s, Input=$INPUT_LEN, Output=$OUTPUT_LEN ---"
    
    vllm bench serve \
      --model "$MODEL" \
      --base-url "$BASE_URL" \
      --endpoint /v1/chat/completions \
      --num-prompts "$NUM_PROMPTS" \
      --request-rate "$RATE" \
      --random-input-len "$INPUT_LEN" \
      --random-output-len "$OUTPUT_LEN" \
      --api-key "$API_KEY" \
      2>&1 | tee "$RESULTS_DIR/rate${RATE}_input${INPUT_LEN}.txt"
    
    echo ""
    sleep 5  # Cool down
  done
done

echo "=== Done! Results in $RESULTS_DIR ==="
```

### Metrics từ `vllm bench serve`

| Metric | Meaning | Target (300 users) |
|--------|---------|:------------------:|
| **TTFT p50** | Time to first token (median) | < 5s |
| **TTFT p95** | Time to first token (95th) | < 15s |
| **ITL p50** | Inter-token latency (median) | < 50ms |
| **ITL p95** | Inter-token latency (95th) | < 100ms |
| **Throughput** | Total output tokens/sec | > 500 tok/s |
| **Request throughput** | Requests completed/sec | > 5 req/s |
| **Error rate** | % failed requests | < 1% |

### Capacity estimation cho 300 users

```
Assumptions (vibe coding with Continue):
- 300 users, ~30% active at any time = 90 active
- Each active user: 1 request every 2-3 minutes (thinking time)
- Peak: 90 users × 1 req/2min = 45 req/min = 0.75 req/s sustained
- Burst: 10 users submit simultaneously = 10 concurrent

→ Target: handle 10-20 concurrent requests with acceptable latency
→ max_num_seqs=8 might be limiting! May need adjustment.
```

### Quan trọng: max_num_seqs tuning

Hiện tại `ds-v4-flash-xl` config `max_num_seqs=8`. Nếu 10+ concurrent → queue.

```bash
# Option: tăng max_num_seqs, trade-off context per request
max_num_seqs=16  # More concurrent, but less KV per request
max_num_seqs=32  # Even more concurrent
```

Trade-off:
- `max_num_seqs=8`: 8 concurrent × 524K each (single-user optimized)
- `max_num_seqs=16`: 16 concurrent × 262K each (multi-user balanced)
- `max_num_seqs=32`: 32 concurrent × 131K each (high concurrency)

**Recommendation cho 300 users**: `max_num_seqs=16`, `max_model_len=262144`
- 16 concurrent requests đủ cho peak burst
- 262K context vẫn rất rộng cho vibe coding
- KV cache: 1M tokens / 262K = ~4 concurrent full-length, nhưng hầu hết prompts < 50K

---

## 4. Phase 1: Server-side Metrics (vLLM native)

vLLM expose Prometheus metrics tại `/metrics`:

```bash
# Check available metrics
curl -s http://localhost:7021/metrics | grep -E "^vllm_" | head -20
```

### Key metrics to monitor

| Metric | Type | Meaning |
|--------|------|---------|
| `vllm_request_success_total` | Counter | Total successful requests |
| `vllm_request_failure_total` | Counter | Total failed requests |
| `vllm_time_to_first_token_seconds` | Histogram | TTFT distribution |
| `vllm_time_per_output_token_seconds` | Histogram | ITL distribution |
| `vllm_e2e_request_latency_seconds` | Histogram | Total request time |
| `vllm_num_requests_running` | Gauge | Currently processing |
| `vllm_num_requests_waiting` | Gauge | In queue (⚠️ alert if > 0 sustained) |
| `vllm_gpu_cache_usage_perc` | Gauge | KV cache utilization |
| `vllm_num_generation_tokens_total` | Counter | Total generated tokens |

### Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'vllm-ds-v4-flash'
    static_configs:
      - targets: ['10.29.249.151:7021']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: 'vllm-qwen-vl'
    static_configs:
      - targets: ['10.29.249.151:7002']
    metrics_path: /metrics
    scrape_interval: 15s
```

### Alerting rules

```yaml
# alerts.yml
groups:
  - name: vllm
    rules:
      - alert: HighQueueDepth
        expr: vllm_num_requests_waiting > 5
        for: 1m
        annotations:
          summary: "vLLM queue depth > 5 for 1 minute"

      - alert: HighTTFT
        expr: histogram_quantile(0.95, vllm_time_to_first_token_seconds_bucket) > 30
        for: 2m
        annotations:
          summary: "TTFT p95 > 30s"

      - alert: HighErrorRate
        expr: rate(vllm_request_failure_total[5m]) / rate(vllm_request_success_total[5m]) > 0.05
        for: 3m
        annotations:
          summary: "Error rate > 5%"

      - alert: KVCacheNearFull
        expr: vllm_gpu_cache_usage_perc > 0.95
        for: 1m
        annotations:
          summary: "KV cache > 95% — requests may be rejected"
```

---

## 5. Phase 2: Client Monitoring (từ 07-performance-monitoring.md)

Giữ nguyên **Phương án 2 (SQLite metrics)** từ document gốc — nó phù hợp cho production monitoring per-user. Chỉ bổ sung:

### Thêm TTFT measurement

```typescript
// Trong streaming handler — record time of first chunk
let ttftMs: number | undefined;
const streamStart = Date.now();

for await (const chunk of stream) {
  if (!ttftMs) {
    ttftMs = Date.now() - streamStart;
  }
  // ... process chunk ...
}

// Log with TTFT
DevDataSqliteDb.logRequestMetrics({
  ...metrics,
  ttftMs,  // Now we have actual TTFT
});
```

---

## 6. Phase 3: Production Dashboard

### Option A: Grafana + Prometheus (recommended)

```
vLLM (/metrics) → Prometheus → Grafana
LiteLLM (/metrics) → Prometheus → Grafana
```

Dashboard panels:
- Request rate (per model, per user)
- TTFT p50/p95/p99
- Throughput (tokens/sec)
- Queue depth
- KV cache usage
- Error rate
- Cost per team (LiteLLM spend tracking)

### Option B: Simple script-based (quick)

```bash
#!/bin/bash
# monitor.sh — Quick health check loop
while true; do
  echo "$(date) | Running: $(curl -s localhost:7021/metrics | grep vllm_num_requests_running | awk '{print $2}') | Queue: $(curl -s localhost:7021/metrics | grep vllm_num_requests_waiting | awk '{print $2}') | KV: $(curl -s localhost:7021/metrics | grep gpu_cache_usage | awk '{print $2}')"
  sleep 10
done
```

---

## 7. SLA Definition (cho 300 users)

### Proposed SLA targets

| Metric | Target | Degraded | Critical |
|--------|:------:|:--------:|:--------:|
| TTFT p50 | < 3s | < 10s | > 15s |
| TTFT p95 | < 10s | < 30s | > 60s |
| ITL (inter-token) | < 50ms | < 100ms | > 200ms |
| Throughput | > 500 tok/s | > 200 tok/s | < 100 tok/s |
| Availability | > 99.5% | > 99% | < 99% |
| Error rate | < 1% | < 5% | > 5% |
| Queue depth | 0-2 | 3-5 | > 5 |

### Capacity threshold triggers

| Concurrent Users | Expected TTFT p95 | Action |
|:----------------:|:------------------:|--------|
| 1-5 | ~2-5s | Normal |
| 5-10 | ~5-10s | Monitor |
| 10-16 | ~10-20s | Warning — approaching max_num_seqs |
| 16+ | Queuing → timeout | Scale (add GPUs or reduce max_model_len) |

---

## 8. Recommended Execution Order

### Trước rollout (1-2 ngày)

```bash
# 1. Run benchmark suite
ssh devops-gpu-vt-tpb
cd /data/dev/scripts
bash bench-capacity.sh

# 2. Analyze results
# - Xác định max concurrent trước khi TTFT p95 > 15s
# - Xác định throughput ceiling
# - Decide max_num_seqs value

# 3. Tune nếu cần
# Edit 03-serve-llm.sh: max_num_seqs, max_model_len
# Restart and re-bench
```

### Tuần đầu rollout (10-30 users pilot)

```bash
# 4. Enable Prometheus scraping
# 5. Deploy LiteLLM gateway (rate limiting per user)
# 6. Monitor queue depth + TTFT real-time
```

### Tuần 2-4 (scale to 100-300 users)

```bash
# 7. Client-side SQLite metrics (Phase 2 từ 07-performance-monitoring.md)
# 8. Grafana dashboard
# 9. Alert rules active
```

---

## 9. Quick Decision Matrix

| Câu hỏi | Tool |
|----------|------|
| Server có handle được 20 concurrent? | `vllm bench serve --request-rate 20` |
| TTFT ở full load là bao nhiêu? | `vllm bench serve` → xem p95 |
| User nào dùng nhiều nhất? | LiteLLM spend logs |
| Có ai bị reject không? | `vllm_request_failure_total` (Prometheus) |
| KV cache có đủ không? | `vllm_gpu_cache_usage_perc` |
| Cần tăng GPU/giảm context? | Nếu queue depth > 5 sustained |

---

## 10. Files Reference

| File | Phase | Purpose |
|------|:-----:|---------|
| `bench-capacity.sh` (tạo mới) | 0 | Load testing script |
| `03-serve-llm.sh` | 0 | Tune max_num_seqs |
| Prometheus config | 1 | Server metrics collection |
| `07-performance-monitoring.md` | 2 | Client-side implementation guide |
| Grafana dashboard JSON | 3 | Production visualization |
| LiteLLM `/spend/logs` | 3 | Per-user tracking |
