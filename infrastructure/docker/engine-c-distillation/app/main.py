"""
COREVIA Engine C — Distillation & Fine-Tuning Service

FastAPI application providing GPU-accelerated LoRA/QLoRA fine-tuning
for sovereign LLM models (Engine A).

Endpoints:
  GET  /health           — GPU status + service health
  POST /jobs             — Start a fine-tuning job
  GET  /jobs             — List all jobs
  GET  /jobs/{id}        — Get job progress
  POST /jobs/{id}/cancel — Cancel a running job
"""

import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Thread
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    WORKSPACE, GGUF_DIR, OLLAMA_ENDPOINT,
    COREVIA_API_URL, MAX_CONCURRENT_JOBS, LOG_LEVEL,
)
from .models import (
    TrainingRequest,
    TrainingJobResponse,
    HealthResponse,
    JobStatus,
)
from .trainer import run_training, resolve_hf_model
from .ollama_push import convert_to_gguf, push_to_ollama, verify_model_in_ollama

# ── Logging ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("engine-c")

# ── In-memory job store ─────────────────────────────────────────────────

jobs: dict[str, dict] = {}

# Persist jobs to disk for container restarts
JOBS_FILE = WORKSPACE / "jobs.json"


def _save_jobs():
    try:
        with open(JOBS_FILE, "w") as f:
            json.dump(jobs, f, default=str)
    except Exception:
        pass


def _load_jobs():
    global jobs
    if JOBS_FILE.exists():
        try:
            with open(JOBS_FILE, "r") as f:
                jobs = json.load(f)
            # Mark any "running" jobs as failed (container restarted)
            for job in jobs.values():
                if job.get("status") in ("downloading", "training", "merging", "converting", "pushing"):
                    job["status"] = "failed"
                    job["error"] = "Container restarted during training"
        except Exception:
            jobs = {}


# ── App lifecycle ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_jobs()
    logger.info("Engine C - Distillation Service started")
    yield
    _save_jobs()
    logger.info("Engine C - Distillation Service stopped")


app = FastAPI(
    title="COREVIA Engine C - Distillation",
    description="GPU-accelerated LoRA/QLoRA fine-tuning for Engine A sovereign models",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper ──────────────────────────────────────────────────────────────

def _job_to_response(job: dict) -> TrainingJobResponse:
    return TrainingJobResponse(
        id=job["id"],
        status=job["status"],
        base_model=job["base_model"],
        hf_model=job["hf_model"],
        training_samples=job["training_samples"],
        ollama_model_name=job["ollama_model_name"],
        lora_rank=job["lora_rank"],
        lora_alpha=job["lora_alpha"],
        epochs=job["epochs"],
        batch_size=job["batch_size"],
        learning_rate=job["learning_rate"],
        current_epoch=job.get("current_epoch", 0),
        current_step=job.get("current_step", 0),
        total_steps=job.get("total_steps", 0),
        training_loss=job.get("training_loss"),
        progress_pct=job.get("progress_pct", 0.0),
        created_at=job["created_at"],
        started_at=job.get("started_at"),
        completed_at=job.get("completed_at"),
        adapter_path=job.get("adapter_path"),
        gguf_path=job.get("gguf_path"),
        error=job.get("error"),
        corevia_job_id=job.get("corevia_job_id"),
    )


def _active_job_count() -> int:
    return sum(
        1 for j in jobs.values()
        if j.get("status") in ("downloading", "training", "merging", "converting", "pushing")
    )


def _notify_corevia(job: dict):
    """Best-effort callback to COREVIA API with job status."""
    corevia_job_id = job.get("corevia_job_id")
    if not corevia_job_id:
        return
    try:
        import httpx
        with httpx.Client(timeout=10.0) as client:
            client.patch(
                f"{COREVIA_API_URL}/api/corevia/learning/fine-tune/{corevia_job_id}/status",
                json={
                    "status": job["status"],
                    "currentEpoch": job.get("current_epoch", 0),
                    "currentStep": job.get("current_step", 0),
                    "totalSteps": job.get("total_steps", 0),
                    "trainingLoss": job.get("training_loss"),
                    "progressPct": job.get("progress_pct", 0.0),
                    "error": job.get("error"),
                    "ollamaModelName": job.get("ollama_model_name"),
                },
            )
    except Exception as e:
        logger.debug(f"COREVIA callback failed (non-critical): {e}")


# ── Training worker ─────────────────────────────────────────────────────

def _training_worker(job_id: str, req: TrainingRequest, hf_model: str):
    """Background worker that runs the full fine-tuning pipeline."""
    job = jobs[job_id]

    try:
        # Phase 1: Download & train
        job["status"] = JobStatus.DOWNLOADING.value
        job["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _save_jobs()
        _notify_corevia(job)

        job["status"] = JobStatus.TRAINING.value
        _save_jobs()
        _notify_corevia(job)

        merged_path = run_training(
            job=job,
            training_data=req.training_data,
            hf_model=hf_model,
            lora_rank=req.lora_rank,
            lora_alpha=req.lora_alpha,
            lora_dropout=req.lora_dropout,
            learning_rate=req.learning_rate,
            epochs=req.epochs,
            batch_size=req.batch_size,
            max_seq_length=req.max_seq_length,
            on_update=lambda j: (_save_jobs(), _notify_corevia(j)),
        )

        # Check if cancelled
        if job["status"] == JobStatus.CANCELLED.value:
            logger.info(f"[{job_id}] Job cancelled during training")
            return

        job["adapter_path"] = str(merged_path)

        # Phase 2: Convert to GGUF
        job["status"] = JobStatus.CONVERTING.value
        _save_jobs()
        _notify_corevia(job)

        gguf_path = convert_to_gguf(merged_path, job_id)
        job["gguf_path"] = str(gguf_path)

        # Phase 3: Push to Ollama
        job["status"] = JobStatus.PUSHING.value
        _save_jobs()
        _notify_corevia(job)

        push_success = push_to_ollama(
            gguf_path=gguf_path,
            model_name=req.ollama_model_name,
            job_id=job_id,
            system_prompt=(
                "You are COREVIA Brain, a government portfolio intelligence engine. "
                "Analyze decisions with precision, transparency, and alignment to "
                "UAE government frameworks and standards."
            ),
        )

        if push_success:
            # Verify
            verified = verify_model_in_ollama(req.ollama_model_name)
            if verified:
                logger.info(f"[{job_id}] Model '{req.ollama_model_name}' verified in Ollama")
            else:
                logger.warning(f"[{job_id}] Model push succeeded but verification failed")

        job["status"] = JobStatus.COMPLETED.value
        job["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        job["progress_pct"] = 100.0
        _save_jobs()
        _notify_corevia(job)

        logger.info(f"[{job_id}] Fine-tuning pipeline completed successfully")

    except Exception as e:
        logger.error(f"[{job_id}] Training failed: {e}", exc_info=True)
        job["status"] = JobStatus.FAILED.value
        job["error"] = str(e)[:2000]
        job["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _save_jobs()
        _notify_corevia(job)


# ── API Routes ──────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health():
    """Service health check with GPU status."""
    import torch

    gpu_available = torch.cuda.is_available()

    return HealthResponse(
        status="healthy",
        service="engine-c-distillation",
        gpu_available=gpu_available,
        gpu_name=torch.cuda.get_device_name(0) if gpu_available else None,
        gpu_memory_gb=round(
            torch.cuda.get_device_properties(0).total_mem / 1e9, 1
        ) if gpu_available else 0.0,
        cuda_version=torch.version.cuda if gpu_available else None,
        active_jobs=_active_job_count(),
        total_jobs=len(jobs),
    )


@app.post("/jobs", response_model=dict)
def create_job(req: TrainingRequest):
    """Start a new fine-tuning job."""

    # Guard: no GPU
    import torch
    if not torch.cuda.is_available():
        raise HTTPException(
            status_code=503,
            detail="No GPU available. Fine-tuning requires an NVIDIA GPU with CUDA support.",
        )

    # Guard: max concurrent jobs
    if _active_job_count() >= MAX_CONCURRENT_JOBS:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {MAX_CONCURRENT_JOBS} concurrent training job(s). Wait for current job to finish.",
        )

    # Guard: minimum training data
    if len(req.training_data) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 5 training samples, got {len(req.training_data)}.",
        )

    # Resolve HuggingFace model
    hf_model = resolve_hf_model(req.base_model)

    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "status": JobStatus.PENDING.value,
        "base_model": req.base_model,
        "hf_model": hf_model,
        "training_samples": len(req.training_data),
        "ollama_model_name": req.ollama_model_name,
        "lora_rank": req.lora_rank,
        "lora_alpha": req.lora_alpha,
        "epochs": req.epochs,
        "batch_size": req.batch_size,
        "learning_rate": req.learning_rate,
        "current_epoch": 0,
        "current_step": 0,
        "total_steps": 0,
        "training_loss": None,
        "progress_pct": 0.0,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "started_at": None,
        "completed_at": None,
        "adapter_path": None,
        "gguf_path": None,
        "error": None,
        "corevia_job_id": req.corevia_job_id,
    }
    jobs[job_id] = job
    _save_jobs()

    # Save training data to disk
    data_dir = WORKSPACE / "datasets" / job_id
    data_dir.mkdir(parents=True, exist_ok=True)
    data_file = data_dir / "training_data.jsonl"
    with open(data_file, "w") as f:
        for record in req.training_data:
            f.write(json.dumps(record) + "\n")

    # Launch training in background thread
    thread = Thread(
        target=_training_worker,
        args=(job_id, req, hf_model),
        name=f"training-{job_id[:8]}",
        daemon=True,
    )
    thread.start()

    logger.info(
        f"[{job_id}] Job created: {hf_model}, "
        f"{len(req.training_data)} samples, "
        f"rank={req.lora_rank}, epochs={req.epochs}"
    )

    return {"success": True, "job": _job_to_response(job).model_dump()}


@app.get("/jobs", response_model=dict)
def list_jobs(status: Optional[str] = None):
    """List all training jobs, optionally filtered by status."""
    job_list = list(jobs.values())
    if status:
        job_list = [j for j in job_list if j.get("status") == status]

    return {
        "success": True,
        "jobs": [_job_to_response(j).model_dump() for j in job_list],
        "total": len(job_list),
    }


@app.get("/jobs/{job_id}", response_model=dict)
def get_job(job_id: str):
    """Get detailed status of a training job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "job": _job_to_response(jobs[job_id]).model_dump()}


@app.post("/jobs/{job_id}/cancel", response_model=dict)
def cancel_job(job_id: str):
    """Cancel a running training job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = jobs[job_id]
    if job["status"] in ("completed", "failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Job already in terminal state: {job['status']}",
        )

    job["status"] = JobStatus.CANCELLED.value
    job["completed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _save_jobs()
    _notify_corevia(job)

    return {"success": True, "message": f"Job {job_id} cancelled"}


# ── Entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
