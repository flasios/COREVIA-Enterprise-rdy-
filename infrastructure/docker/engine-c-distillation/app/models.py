"""
Pydantic models for Engine C API.
"""

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class JobStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    TRAINING = "training"
    MERGING = "merging"
    CONVERTING = "converting"
    PUSHING = "pushing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingMessage(BaseModel):
    """Single training record in chat/instruction format."""
    role: str  # system, user, assistant
    content: str


class TrainingRecord(BaseModel):
    """One training sample."""
    messages: list[TrainingMessage] = []
    # Alternative flat format
    system: Optional[str] = None
    input: Optional[str] = None
    output: Optional[str] = None
    metadata: Optional[dict] = None


class TrainingRequest(BaseModel):
    """Request to start a fine-tuning job."""
    base_model: str = Field(
        default="mistral-nemo",
        description="Ollama model name or HuggingFace repo ID"
    )
    training_data: list[dict] = Field(
        ...,
        description="Training records (instruction-tuning or conversation format)",
        min_length=1,
    )
    ollama_model_name: str = Field(
        default="corevia-mistral-nemo",
        description="Name to register the fine-tuned model under in Ollama"
    )

    # LoRA hyperparameters
    lora_rank: int = Field(default=16, ge=4, le=128)
    lora_alpha: int = Field(default=32, ge=4, le=256)
    lora_dropout: float = Field(default=0.05, ge=0.0, le=0.5)
    learning_rate: float = Field(default=2e-4, gt=0, le=1.0)
    epochs: int = Field(default=3, ge=1, le=50)
    batch_size: int = Field(default=4, ge=1, le=64)
    max_seq_length: int = Field(default=2048, ge=128, le=8192)

    # COREVIA job tracking
    corevia_job_id: Optional[str] = None


class TrainingJobResponse(BaseModel):
    """Training job status response."""
    id: str
    status: JobStatus
    base_model: str
    hf_model: str
    training_samples: int
    ollama_model_name: str

    # Hyperparameters
    lora_rank: int
    lora_alpha: int
    epochs: int
    batch_size: int
    learning_rate: float

    # Progress
    current_epoch: int = 0
    current_step: int = 0
    total_steps: int = 0
    training_loss: Optional[float] = None
    progress_pct: float = 0.0

    # Timing
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    # Output
    adapter_path: Optional[str] = None
    gguf_path: Optional[str] = None
    error: Optional[str] = None

    # COREVIA reference
    corevia_job_id: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    gpu_available: bool
    gpu_name: Optional[str] = None
    gpu_memory_gb: float = 0.0
    cuda_version: Optional[str] = None
    active_jobs: int = 0
    total_jobs: int = 0
