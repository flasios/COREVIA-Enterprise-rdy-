"""
Engine C Configuration — Environment-based settings.
"""

import os
from pathlib import Path


# Workspace for models, datasets, adapters, GGUF outputs
WORKSPACE = Path(os.getenv("TRAINING_WORKSPACE", "/workspace"))
WORKSPACE.mkdir(parents=True, exist_ok=True)

MODELS_DIR = WORKSPACE / "models"
DATASETS_DIR = WORKSPACE / "datasets"
ADAPTERS_DIR = WORKSPACE / "adapters"
GGUF_DIR = WORKSPACE / "gguf"

for d in (MODELS_DIR, DATASETS_DIR, ADAPTERS_DIR, GGUF_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Ollama endpoint (internal Docker network)
OLLAMA_ENDPOINT = os.getenv("OLLAMA_ENDPOINT", "http://local-llm:11434")

# COREVIA API callback (for status updates)
COREVIA_API_URL = os.getenv("COREVIA_API_URL", "http://api:5000")

# HuggingFace model mapping: Ollama model name → HuggingFace repo
HF_MODEL_MAP = {
    "mistral-nemo": "mistralai/Mistral-Nemo-Instruct-2407",
    "llama3.1": "meta-llama/Llama-3.1-8B-Instruct",
    "phi4": "microsoft/phi-4",
    "qwen2.5": "Qwen/Qwen2.5-7B-Instruct",
    "gemma2": "google/gemma-2-9b-it",
}

# Default hyperparameters
DEFAULT_LORA_RANK = int(os.getenv("DEFAULT_LORA_RANK", "16"))
DEFAULT_LORA_ALPHA = int(os.getenv("DEFAULT_LORA_ALPHA", "32"))
DEFAULT_LORA_DROPOUT = float(os.getenv("DEFAULT_LORA_DROPOUT", "0.05"))
DEFAULT_LEARNING_RATE = float(os.getenv("DEFAULT_LEARNING_RATE", "2e-4"))
DEFAULT_EPOCHS = int(os.getenv("DEFAULT_EPOCHS", "3"))
DEFAULT_BATCH_SIZE = int(os.getenv("DEFAULT_BATCH_SIZE", "4"))
DEFAULT_MAX_SEQ_LENGTH = int(os.getenv("DEFAULT_MAX_SEQ_LENGTH", "2048"))

# Max concurrent training jobs
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "1"))

# Log level
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
