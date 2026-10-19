# Node.js Scaling

A hands-on experiment to understand **vertical and horizontal scaling** of a Node.js API using Docker, PM2, and k6.

The goal is to compare how a system behaves when we:

- **Scale vertically** — increase CPU/resources and workers on a machine.
- **Scale horizontally** — run multiple application instances and distribute traffic across them.

The experiments focus on throughput, latency, error rate, and resource usage.

## Stack

- Node.js
- Docker & Docker Compose
- PM2 for multi core utilization
- k6 for load testing with virtual users(vus)

## Project Structure

```text
scale-app/
├── readme.md
├── result.md
├── script.js
└── server/
    ├── app.js
    ├── docker-compose.yml
    ├── Dockerfile
    ├── ecosystem.config.cjs
    ├── package.json
    ├── package-lock.json
    └── result_vertical.md
```

## Current Progress

### Vertical Scaling — Done

The first experiment tests different combinations of:

- CPU allocation
- PM2 workers
- Concurrent virtual users

Current results are documented in:

[`server/result_vertical.md`](server/result_vertical.md)

### Horizontal Scaling — Coming Soon

The next experiment will run multiple application instances and distribute requests between them.

The results will then be compared with vertical scaling in:

[`result.md`](result.md)

## Running the Experiment

Start the server:

```bash
cd server
docker compose up --build
```

Run the load test from the project root:

```bash
k6 run script.js
```

CPU and PM2 worker configuration can be changed in:

```text
server/docker-compose.yml
server/ecosystem.config.cjs
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

## Goal

The main question behind this project is:

> **When should we scale up, and when should we scale out?**

This repo is a practical experiment to understand the trade-offs between **vertical and horizontal scaling** under load.

> These results are experimental and environment-dependent. They are meant to show scaling patterns rather than production capacity.