# Vertical Scaling Results

Load test of a Node.js API with Docker, PM2 and k6. Goal: see what more CPU and more workers do on one machine.

## Setup

| Item | Value |
|---|---|
| Machine | Intel i3 laptop, 4 cores |
| Runtime | Docker, memory limit 512 MB |
| Process manager | PM2 cluster mode |
| Load tool | k6, constant VUs, 2 min, `sleep(1)` per iteration |
| Endpoint | `GET /products` |

k6 and the server ran on the same laptop.

## Results

| Setup | VUs | Req/s | Fail | Median | p95 |
|---|---:|---:|---:|---:|---:|
| 1 worker, 1 CPU | 3000 | 1,330 | 1.19% | 242 ms | 452 ms |
| 1 worker, 2 CPU | 3000 | 1,369 | 1.02% | 258 ms | 507 ms |
| 2 workers, 2 CPU | 3000 | **2,048** | 0.05% | 334 ms | 533 ms |
| 2 workers, 2 CPU | 2000 | 1,898 | **0%** | **20 ms** | **131 ms** |
| 3 workers, 3 CPU | 3000 | 1,638 | 0.27% | 379 ms | 644 ms |
| 3 workers, 3 CPU | 2000 | 1,697 | 0% | 146 ms | 311 ms |

## Findings

1. **More CPU alone did nothing.** 1 CPU vs 2 CPU gave 1,330 vs 1,369 req/s. Node uses one core per process.
2. **2 PM2 workers gave +50% throughput** (1,369 to 2,048 req/s) and cut failures from 1.02% to 0.05%.
3. **3 workers were slower than 2.** The 4 cores were shared by the workers, k6, Docker and the OS.
4. **Past capacity, only waiting grows.** Going from 2000 to 3000 VUs raised req/s by 8% but median latency from 20 ms to 334 ms.

## Best setup

2 workers, 2 CPU, 512 MB, at 2000 VUs: 1,898 req/s, 0 failures, 131 ms p95.

## Caveats

- Each configuration was run once. Differences of a few percent are noise.
- With `sleep(1)`, req/s cannot go far above the VU count.
- k6 and the server shared 4 cores, so treat the numbers as a pattern, not real capacity.
- The 3-worker slowdown is likely a resource limit of this laptop, not a Node limit.

## Reproduce

```bash
docker run --cpus="2" -m 512m ...
k6 run script.js
```