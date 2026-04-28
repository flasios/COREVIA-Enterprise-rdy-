# COREVIA Domain Model

Date: 2026-03-10

## Purpose

This document describes the bounded-context model that drives repository structure and ownership.

## Domain Ownership Principle

COREVIA uses bounded contexts, not generic feature buckets.

Each domain should own:

- its public API surface,
- its application workflows,
- its domain rules,
- its infrastructure adapters,
- its frontend workspace experience where applicable,
- its contracts with other domains.

## Current Backend Domains

The current backend domains are implemented under `domains/`.

These are the primary contexts visible in the repository and architecture docs:

- identity
- demand
- portfolio
- governance
- intelligence
- knowledge
- compliance
- integration
- operations
- notifications
- platform
- ea

The Brain remains a platform-defining capability and is treated as its own explicit boundary at the top-level `brain/` root.

## Required Internal Layering

Inside each backend domain, the layering rule remains:

`api -> application -> domain -> infrastructure`

This should not change.

The structure is already correct and should be preserved during any future rename from `modules/` to `domains/`.

## Frontend Domain Model

The frontend now reflects domain ownership under `apps/web/modules/`.

Current major UI domains include:

- demand
- portfolio
- knowledge
- intelligence
- compliance
- integration
- admin
- ea
- workspace

The right direction is to keep strengthening module-owned UI trees rather than reintroducing broad shared feature buckets.

## Cross-Domain Rules

The following rules should remain explicit:

1. cross-domain imports go through contracts, ports, or public surfaces,
2. no deep imports across arbitrary implementation folders,
3. transport concerns do not own business policy,
4. shared technical utilities do not absorb domain behavior.

## Naming Guidance

The word `domains` is a better long-term repository name than `modules` because it signals bounded-context ownership and DDD seriousness.

However, the rename should happen only when:

- import churn can be controlled,
- tooling and aliases are ready,
- the physical move does not disrupt active delivery.

## Summary

The current architecture already behaves like a domain-owned modular platform.

The main task is to make that model easier to read in the repository and harder to violate in implementation.

## Primary References

- [../SOURCE_STRUCTURE_TARGET.md](../SOURCE_STRUCTURE_TARGET.md)
- [../COREVIA_CAPABILITY_MAP_2026-03-10.md](../COREVIA_CAPABILITY_MAP_2026-03-10.md)
- [REPOSITORY_STRUCTURE_TRANSITION.md](REPOSITORY_STRUCTURE_TRANSITION.md)