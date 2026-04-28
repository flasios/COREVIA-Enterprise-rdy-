# COREVIA — Chaos Engineering Runbook

## Purpose

This runbook defines controlled failure experiments for the COREVIA platform
to verify resilience, graceful degradation, and recovery procedures.

---

## Experiment 1: Database Connection Loss

**Hypothesis**: When PostgreSQL becomes unreachable, the application returns
HTTP 503 for data endpoints and keeps the health endpoint responsive with
degraded status.

**Steps**:
1. Deploy COREVIA to staging environment
2. Verify all health checks pass: `curl http://staging/api/health`
3. Simulate DB failure: `docker pause corevia-db`
4. Observe:
   - `GET /api/health` → should return `{ status: 'degraded', db: 'down' }`
   - `GET /api/demands` → should return 503 Service Unavailable
   - Frontend should show "Service temporarily unavailable" banner
5. Restore DB: `docker unpause corevia-db`
6. Verify recovery: all endpoints return 200 within 30 seconds

**Success Criteria**:
- No unhandled exceptions in server logs
- No data corruption after recovery
- Connection pool recovers automatically

---

## Experiment 2: Memory Pressure

**Hypothesis**: Under memory pressure, the application gracefully rejects
new requests rather than crashing with OOM.

**Steps**:
1. Set container memory limit: `docker update --memory=256m corevia-app`
2. Run load test: `k6 run --vus 50 --duration 2m infrastructure/scripts/load-test.js`
3. Monitor memory: `docker stats corevia-app`
4. Observe:
   - Application should shed load with 429/503 responses
   - No OOM kill (check `docker inspect --format='{{.State.OOMKilled}}'`)
   - MemoryCache should auto-evict entries

**Success Criteria**:
- Container stays alive throughout test
- Error rate < 20% under pressure
- Recovery to normal within 60s after load reduction

---

## Experiment 3: Redis/Cache Failure

**Hypothesis**: When the caching layer fails, the application falls back to
direct database queries with acceptable latency.

**Steps**:
1. Verify cache hit rates: `GET /api/metrics` (check cache_hits counter)
2. Disable cache: set `CACHE_ENABLED=false` or kill Redis container
3. Run standard user flows (login, demand list, project workspace)
4. Measure response time increase

**Success Criteria**:
- All endpoints remain functional
- Response time increase < 3x baseline
- No errors in application logs related to cache misses

---

## Experiment 4: AI Service Degradation

**Hypothesis**: When OpenAI/LLM service is slow or unavailable, AI-powered
features degrade gracefully without blocking core workflows.

**Steps**:
1. Set `AI_TIMEOUT_MS=1000` (1 second timeout)
2. Configure network latency: `tc qdisc add dev eth0 root netem delay 5000ms`
3. Trigger AI operations:
   - Business Case generation
   - Task Completion Advisor
   - Risk Evidence AI Verification
4. Observe timeout handling

**Success Criteria**:
- AI requests timeout within configured threshold
- User sees "AI service temporarily unavailable" message
- Core CRUD operations (create demand, update task, etc.) unaffected
- No cascading failures to non-AI endpoints

---

## Experiment 5: Disk Space Exhaustion

**Hypothesis**: When disk space runs low, file uploads are rejected gracefully
and the application continues serving read requests.

**Steps**:
1. Fill disk to 95%: `fallocate -l 10G /tmp/fill-disk`
2. Attempt file upload (evidence, risk documents)
3. Attempt normal CRUD operations
4. Monitor logs for disk-related errors

**Success Criteria**:
- Upload endpoints return 507 Insufficient Storage
- Read/write DB operations continue (DB on separate volume)
- Alert fires for disk space threshold

---

## Experiment 6: DNS Resolution Failure

**Hypothesis**: Internal service discovery failures are handled with retries
and circuit breaking, not cascading failures.

**Steps**:
1. Corrupt DNS: `iptables -A OUTPUT -p udp --dport 53 -j DROP`
2. Restart application (to force DNS lookups)
3. Monitor startup behavior and external API calls

**Success Criteria**:
- Application starts with cached DNS within 30s
- Failed DNS lookups logged at WARN level
- Internal PostgreSQL connection uses IP, not hostname

---

## Experiment 7: Certificate Expiry / TLS Failure

**Hypothesis**: TLS certificate issues produce clear error messages and
do not expose plaintext data.

**Steps**:
1. Configure expired certificate on staging reverse proxy
2. Access application via browser: `https://staging.corevia.ae`
3. Verify HSTS headers prevent downgrade to HTTP
4. Check API clients receive appropriate TLS errors

**Success Criteria**:
- Browser shows certificate warning (not silent degradation)
- API returns connection error (not plaintext response)
- HSTS header present with max-age >= 31536000

---

## Post-Experiment Checklist

- [ ] All experiments logged in incident tracker
- [ ] Findings documented with screenshots/metrics
- [ ] Remediation tickets created for failures
- [ ] Runbook updated with lessons learned
- [ ] Next experiment cycle scheduled (quarterly)

---

## Tools Required

| Tool | Purpose | Installation |
|------|---------|-------------|
| k6 | Load testing | `brew install k6` or `docker pull grafana/k6` |
| tc (netem) | Network simulation | `apt install iproute2` |
| docker | Container management | Pre-installed |
| curl | HTTP testing | Pre-installed |
| iptables | Network filtering | Pre-installed (Linux) |
