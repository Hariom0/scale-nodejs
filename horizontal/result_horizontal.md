# Horizontal Scaling Test Results

A small experiment to see how splitting the same CPU across more app replicas changes latency and failures under load.

## Setup

- **App:** Express API. `GET /products` returns 1000 products (about 60KB of JSON). `GET /health` returns a tiny status.
- **Load balancer:** Nginx, port `8000:80`, round-robin across replicas (found through Docker DNS).
- **Scaling:** `docker compose up --scale app=N`, with a CPU and memory limit per container.
- **Load generator:** k6, staged ramp-up, each virtual user (VU) does `GET /products` then `sleep(1)`.
- **Where it runs:** everything (k6, Nginx, app replicas) on one machine.

```
k6 (VUs)  ->  localhost:8000  ->  Nginx  ->  app-1 ... app-N (Express)
```

Stages used for most tests (30s each): 100 -> 300 -> 500 -> peak -> 0 users. Peak was 1000, 1100 or 1200 depending on the run.

## Experiment 1: Instant load vs staged ramp-up

Starting many users at the same second caused random `EOF` failures at the start, with no errors in Nginx or app logs. A staged ramp-up fixed it.

| Test | Load shape | Requests | Failed | Notes |
|---|---|---|---|---|
| 2 replicas, 0.5 CPU | 400 VUs at once, 1m | 24,000 | 58 (0.24%) | second run: 125 (0.52%) |
| 2 replicas, 0.5 CPU | 300 VUs at once | 1,500 to 2,726 | 11 to 26 (0.7% to 1%) | runs stopped early with Ctrl+C |
| 2 replicas, 0.5 CPU | ramp 100 -> 300 -> 500 | 33,134 | 0 (0%) | avg 1.89ms, p95 3.81ms, max 37.59ms |

**Takeaway:** a sudden spike and a steady ramp are two different tests. A cold start can look like an app bug when it is not.

Note: the instant-load runs were short and some were stopped early, so this comparison is a strong hint, not a controlled benchmark.

## Experiment 2: 2 vs 3 replicas (0.5 CPU each, peak 1000 VUs)

| Replicas | Requests | Success | Failed | Avg | p95 | Max | Req/s |
|---|---|---|---|---|---|---|---|
| 2 (run 1) | 47,893 | 95.71% | 2,052 | 195.01ms | 1.34s | 2.53s | 318 |
| 2 (run 2) | 48,053 | 96.81% | 1,529 | 195.54ms | 1.36s | 2.73s | 318 |
| 3 | 56,637 | 100% | 0 | 13.55ms | 67.17ms | 245.57ms | 376 |

**Takeaway:** adding one replica removed the failures and cut latency a lot. The two 2-replica runs agree with each other.

## Experiment 3: Same total CPU (1.5 cores), different split

| Setup | Peak VUs | Requests | Success | Failed | Avg | p95 | Max | Req/s |
|---|---|---|---|---|---|---|---|---|
| 3 x 0.5 CPU (run 1) | 1100 | 57,867 | 100% | 0 | 45.38ms | 177.27ms | 2.08s | 385 |
| 3 x 0.5 CPU (run 2) | 1100 | 58,258 | 100% | 0 | 38.30ms | 190.57ms | 1.23s | 387 |
| 5 x 0.3 CPU | 1100 | 59,026 | 100% | 0 | 24.15ms | 130.51ms | 418.08ms | 391 |
| 5 x 0.3 CPU | 1150 | 58,375 | 99.23% | 448 | 61.52ms | 304.24ms | 1.72s | 387 |
| 5 x 0.3 CPU | 1200 | 59,810 | 99.18% | 488 | 59.76ms | 336.25ms | 1.14s | 396 |
| 15 x 0.1 CPU (100MB each) | 1200 | 57,819 | 97.96% | 1,179 | 97.76ms | 412.50ms | 2.02s | 384 |

### 5 x 0.3 vs 3 x 0.5 at 1100 VUs (first 3 x 0.5 run as baseline)

| Metric | 3 x 0.5 CPU | 5 x 0.3 CPU | Multiplier |
|---|---|---|---|
| Total CPU | 1.5 cores | 1.5 cores | 1.0x |
| Success rate | 100% | 100% | 1.0x |
| Avg latency | 45ms | 24ms | 0.53x (1.9x faster) |
| p95 latency | 177ms | 130ms | 0.73x (1.4x faster) |
| Max latency | 2.08s | 418ms | 0.20x (5x lower) |

Max latency is a single worst request and varies a lot. The second 3 x 0.5 run had a max of 1.23s, so the 5x gap is the least reliable number here. Avg and p95 are safer to quote.

**Takeaways:**
- Splitting the same CPU into 5 smaller containers gave lower latency than 3 bigger ones.
- Failures appeared when pushing past 1100 VUs, so that is roughly where this setup runs out of room.
- 15 x 0.1 CPU was worse than 5 x 0.3 CPU. Each container was using only about 23MiB of memory, so memory is unlikely to be the cause. The tiny CPU quota is the more likely one, but this was not isolated.

## Resource snapshots

- 5 x 0.3 CPU: each app container showed about 30% CPU in `docker stats`, which is its full 0.3 CPU quota. Nginx showed about 33%.
- Each app container used about 23MiB of its 512MiB memory limit.
- `docker stats` shows CPU as a share of one core, so a 0.3 CPU limit tops out near 30%.

## Things to know when reading these numbers

- **Throughput is not a measured limit.** It stayed around 385 to 396 req/s in every setup. With this ramp and a 1 second sleep per user, the test only sends about 400 req/s on average, so throughput mostly reflects the test shape.
- **Single runs.** Most setups were run once. Treat differences as hints until repeated.
- **Same machine.** k6, Nginx and the apps compete for the same CPU cores, which adds noise.
- **Failure cause not confirmed.** The `EOF` failures left no errors in Nginx or app logs. Possible causes (Nginx connection limits, upstream keep-alive, file descriptor limits, CPU contention) were not isolated.
- **15 x 0.1 changed two things at once** (CPU and memory), so it does not cleanly isolate either.

## Next steps

- Repeat each setup 3 times and report a range.
- Use a fixed request rate (k6 `constant-arrival-rate`) to find the real limit.
- Raise Nginx `worker_connections`, add an `upstream` block with keep-alive, and raise `ulimit -n` for k6.
- Rerun 15 x 0.1 CPU with 512MB memory to isolate the CPU effect.
- Run k6 from a separate machine (AWS) so the load generator stops competing with the app.