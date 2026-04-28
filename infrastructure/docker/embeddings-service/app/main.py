from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("EMBEDDINGS_MODEL", "sentence-transformers/paraphrase-multilingual-mpnet-base-v2")
DIMENSIONS = int(os.getenv("EMBEDDINGS_DIMENSIONS", "768"))
DEVICE = os.getenv("EMBEDDINGS_DEVICE", "cpu")
NORMALIZE = os.getenv("EMBEDDINGS_NORMALIZE", "true").lower() == "true"

app = FastAPI(title="COREVIA Local Embeddings Runtime")


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME, device=DEVICE)


class EmbeddingsRequest(BaseModel):
    model: str | None = None
    input: List[str] = Field(default_factory=list)
    task: str | None = None


class EmbeddingsResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: List[List[float]]


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": DIMENSIONS,
        "device": DEVICE,
    }


@app.post("/embeddings", response_model=EmbeddingsResponse)
def embeddings(request: EmbeddingsRequest) -> EmbeddingsResponse:
    model = get_model()
    vectors = model.encode(
        request.input,
        convert_to_numpy=True,
        normalize_embeddings=NORMALIZE,
        show_progress_bar=False,
    )
    embeddings_list = vectors.tolist() if hasattr(vectors, "tolist") else [list(vector) for vector in vectors]
    return EmbeddingsResponse(
        model=request.model or MODEL_NAME,
        dimensions=model.get_sentence_embedding_dimension(),
        embeddings=embeddings_list,
    )
