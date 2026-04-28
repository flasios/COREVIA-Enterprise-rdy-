---
agent: agent
description: 'Create a COREVIA architecture decision record (ADR) from repo evidence using the existing docs/adr format and numbering. Use for architecture decisions, tradeoff records, and durable technical governance choices.'
argument-hint: 'What architecture decision should the ADR capture?'
---

Create or update a COREVIA architecture decision record under `docs/adr/`.

## Goal
Produce an ADR that matches the repository's existing MADR-style format, is grounded in implementation and documentation evidence, and is strong enough to guide future engineering decisions.

## Required Inputs
- The decision to record.
- Whether this is a new ADR or a revision to an existing ADR.
- The expected status: `proposed`, `accepted`, `deprecated`, or `superseded`.
- The relevant deciders if known.

If any of those are missing, infer only when evidence is strong. Otherwise ask concise follow-up questions.

## Source Material
Before drafting, inspect the repo for:
- `docs/adr/0000-template.md`
- related ADRs in `docs/adr/`
- architecture documentation in `docs/`
- implementation evidence in the relevant code and deployment files

## Procedure
1. Restate the exact decision to be recorded.
2. Check whether an ADR already exists for the same concern.
3. Read the ADR template and at least two related ADRs to match tone and format.
4. Gather current-state evidence from code, docs, and deployment assets.
5. Draft the ADR using this structure:
   - title with the next ADR number if creating a new one
   - status
   - date
   - deciders
   - context
   - decision
   - consequences: positive, negative, neutral
   - alternatives considered
6. Make the tradeoffs concrete. Do not write generic architecture language with no repo evidence.
7. If the prompt implies a new ADR file, create it in `docs/adr/` using the next available four-digit prefix.
8. If the prompt implies updating an existing ADR, preserve its ADR number and history context.

## Quality Bar
- The ADR must describe a real architectural choice, not a status update.
- The decision must reflect current COREVIA structure and constraints.
- Context must explain why the decision is necessary now.
- Consequences must include real tradeoffs, not only positives.
- Alternatives must be plausible options that were seriously considered.

## Output
When finished:
- save the ADR file if the user asked for creation or update
- summarize the decision in plain language
- list the evidence sources used
- note any unresolved assumptions or governance follow-ups
