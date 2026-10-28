# Node.js Scaling

A hands-on experiment to understand **vertical and horizontal scaling** of a Node.js API using Docker, PM2, Nginx, and k6.

The goal is to compare how the same API behaves when we:

- **Scale vertically**: give one machine or container more CPU and run more workers (PM2).
- **Scale horizontally**: run many app containers and spread traffic across them with Nginx.

Both experiments use the same endpoint and the same k6 script, so the results are easy to compare. We look at throughput, latency, error rate, and resource usage.

## Stack

- Node.js (Express)
- Docker and Docker Compose
- PM2 for using multiple CPU cores (vertical)
- Nginx as a load balancer (horizontal)
- k6 for load testing with virtual users (VUs)

## Project Structure

```text
scale-app/
├── README.md
├── script.js                  # k6 load test, shared by both experiments
├── vertical/
│   ├── app.js
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── ecosystem.config.cjs   # PM2 workers
│   ├── package.json
│   ├── package-lock.json
│   └── result_vertical.md
└── horizontal/
    ├── app.js
    ├── Dockerfile
    ├── docker-compose.yml
    ├── nginx.conf             # load balancer
    ├── package.json
    ├── package-lock.json
    └── result_horizontal.md
```

## The API under test

Both experiments serve the same kind of work:

- `GET /products` returns 1000 products (about 60KB of JSON). This is the heavy endpoint used for load tests.
- `GET /health` returns a tiny status response. It is handy for checking that the server is up.

## Results

| Experiment | What changes | Full results |
|---|---|---|
| Vertical scaling | CPU allocation, PM2 workers, concurrent users | [`vertical/result_vertical.md`](vertical/result_vertical.md) |
| Horizontal scaling | Number of replicas, CPU per replica, ramp-up shape | [`horizontal/result_horizontal.md`](horizontal/result_horizontal.md) |

### Horizontal scaling at a glance

Same total CPU (1.5 cores), split different ways. Peak 1100 VUs unless noted.

| Setup | Success | Avg | p95 |
|---|---|---|---|
| 3 replicas x 0.5 CPU | 100% | 38 to 45ms | 177 to 191ms |
| 5 replicas x 0.3 CPU | 100% | 24ms | 130ms |
| 5 replicas x 0.3 CPU (1200 VUs) | 99.18% | 60ms | 336ms |
| 15 replicas x 0.1 CPU (1200 VUs) | 97.96% | 98ms | 413ms |

What we saw:

- Starting many users at the same second caused random `EOF` failures. A staged ramp-up removed them.
- At 1000 VUs, going from 2 to 3 replicas (0.5 CPU each) removed the failures and cut average latency from about 195ms to about 14ms.
- With the same total CPU, 5 smaller replicas gave lower latency than 3 bigger ones. Splitting too far (15 x 0.1 CPU) got worse again.

Most setups were run once, so treat the differences as hints. The full tables and caveats are in the result file.

## Setup

You need:

- Docker with Docker Compose v2
- [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/)

Clone the repo and open the project root:

```bash
cd scale-app
```

> Both experiments listen on port `8000`, and the shared `script.js` calls `http://localhost:8000/products`. Run only one experiment at a time, and stop the first before starting the other (`docker compose down`).

## Running the vertical scaling experiment

Start the server:

```bash
cd vertical
docker compose up --build
```

CPU and PM2 workers are set in two files:

```text
vertical/docker-compose.yml
vertical/ecosystem.config.cjs
```

For example:

```yaml
environment:
  - PM2_WORKERS=3

deploy:
  resources:
    limits:
      cpus: '3'
      memory: "512m"
```

Run the load test from the project root (in a second terminal):

```bash
k6 run script.js
```

Stop the server when you are done:

```bash
cd vertical
docker compose down
```

## Running the horizontal scaling experiment

Start Nginx and several app replicas (here, 5):

```bash
cd horizontal
docker compose up --build --scale app=5 -d
```

Check that it works:

```bash
docker ps                       # all containers should be running
curl localhost:8000/health      # should return {"status":"ok"}
curl localhost:8000/products    # should return the product list
```

How it works:

- Nginx listens on `8000` (mapped to port `80` in the container) and forwards requests to the `app` service.
- Docker DNS returns every replica's IP for the name `app`, so Nginx spreads requests across them.
- The CPU and memory limit for each replica is set in `horizontal/docker-compose.yml`:

```yaml
app:
  build: .
  deploy:
    resources:
      limits:
        cpus: "0.3"
        memory: "512m"
```

To try a different split of the same total CPU, change the limit and the replica count together. For example, 3 replicas x 0.5 CPU:

```bash
# set cpus: "0.5" in docker-compose.yml, then
docker compose up --build --scale app=3 -d
```

Run the load test from the project root:

```bash
k6 run script.js
```

Stop everything when you are done:

```bash
docker compose down
```

## The load test

`script.js` ramps users up in stages instead of starting them all at once. Starting hundreds of users in the same second caused random connection failures at the start of the test, so a ramp gives more stable results.

```javascript
import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 100 },
    { duration: "30s", target: 300 },
    { duration: "30s", target: 500 },
    { duration: "30s", target: 1100 }, // peak, change this between runs
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const res = http.get("http://localhost:8000/products");
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}
```

Tip: save the warnings k6 prints with `k6 run script.js 2>log.txt`.

## Watching resource usage

While a test runs, in another terminal:

```bash
docker stats
```

`docker stats` shows CPU as a share of one core. A container limited to `0.3` CPU tops out near 30%, so a container sitting at its limit is fully busy even though the number looks low.

## Reading the numbers

- **Throughput looks flat across setups.** With this ramp and a 1 second sleep per user, the test only sends about 400 requests per second on average, so req/s mostly reflects the test shape and not a hardware limit. Compare latency and failures instead.
- **Everything runs on one machine.** k6, Nginx, and the app containers compete for the same CPU cores, which adds noise.
- **Failure causes are not fully isolated.** Some failures (`EOF`) left no errors in the Nginx or app logs.

## Goal

The main question behind this project is:

> **When should we scale up, and when should we scale out?**

This repo is a practical experiment to understand the trade-offs between **vertical and horizontal scaling** under load.

> These results are experimental and environment-dependent. They are meant to show scaling patterns, not production capacity.

## Next steps

- Repeat each setup a few times and report a range.
- Use a fixed request rate (k6 `constant-arrival-rate`) to find the real limit.
- Run k6 from a separate machine (for example on AWS) so the load generator does not compete with the app.