# ADR-0010: pgvector Over External Vector Database

> **Status:** accepted
>
> **Date:** 2025-02-12
>
> **Deciders:** Platform Architecture Team

## Context

The knowledge base and RAG (Retrieval-Augmented Generation) pipeline require vector similarity search over document embeddings. Options include external vector databases (Pinecone, Weaviate, Qdrant, Milvus) or the pgvector extension on our existing PostgreSQL instance.

## Decision

We use **pgvector** (PostgreSQL extension) for all vector operations:

- Document embeddings stored in `vector(1536)` columns alongside document metadata
- Cosine similarity search via `<=>` operator
- IVFFlat or HNSW indexes for approximate nearest neighbor (ANN) search
- Same ACID guarantees as the rest of the application data

## Consequences

### Positive

- Zero additional infrastructure — vectors live in the same database as the rest of the data
- Transactional consistency: document + embedding are inserted/updated atomically
- Simpler operations: one database to backup, monitor, scale, and secure
- Data sovereignty: embeddings stay within the same PostgreSQL instance (UAE compliance)
- pgvector supports both exact and approximate KNN out of the box

### Negative

- At extreme scale (100M+ vectors), dedicated vector databases offer better ANN performance
- pgvector ANN indexes consume significant memory for large datasets
- Limited to PostgreSQL — can't easily switch to a different primary database

### Neutral

- For our current scale (10K–100K documents), pgvector performance is indistinguishable from Pinecone
- If scale demands it, we can add a dedicated vector DB later while keeping pgvector for small-scale/transactional queries
