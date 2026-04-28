# ============================================================================
#  COREVIA Engine C — Distillation & Fine-Tuning Service
#  GPU-accelerated LoRA/QLoRA training container
# ============================================================================
#  Base: PyTorch 2.2 + CUDA 12.1 (NVIDIA runtime required)
#  Stack: transformers, peft, trl, bitsandbytes, FastAPI, llama.cpp
# ============================================================================

FROM ubuntu:22.04 AS builder

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# System dependencies for llama.cpp build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Build llama.cpp for GGUF conversion (CPU-only — quantization doesn't need GPU)
RUN git clone --depth 1 https://github.com/ggerganov/llama.cpp.git /opt/llama.cpp && \
    cd /opt/llama.cpp && \
    cmake -B build -DGGML_CUDA=OFF && \
    cmake --build build --config Release -j$(nproc) --target llama-quantize && \
    cp build/bin/llama-quantize /opt/llama.cpp/llama-quantize 2>/dev/null || \
    cp build/llama-quantize /opt/llama.cpp/llama-quantize 2>/dev/null || true

# ── Runtime stage ───────────────────────────────────────────────────────

FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

LABEL org.opencontainers.image.title="COREVIA Engine C - Distillation"
LABEL com.corevia.runtime="engine-c-distillation"
LABEL com.corevia.tier="intelligence"

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV HF_HOME=/workspace/hf_cache
ENV TRANSFORMERS_CACHE=/workspace/hf_cache
ENV TOKENIZERS_PARALLELISM=false

# Minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy llama.cpp tools from builder
COPY --from=builder /opt/llama.cpp/convert_hf_to_gguf.py /opt/llama.cpp/convert_hf_to_gguf.py
COPY --from=builder /opt/llama.cpp/llama-quantize /opt/llama.cpp/llama-quantize
# Copy supporting Python modules needed by the convert script
COPY --from=builder /opt/llama.cpp/gguf-py /opt/llama.cpp/gguf-py

# Install gguf, make quantize executable, install Python deps + optional Unsloth
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir /opt/llama.cpp/gguf-py && \
    chmod +x /opt/llama.cpp/llama-quantize 2>/dev/null || true && \
    pip install --no-cache-dir -r /tmp/requirements.txt && \
    pip install --no-cache-dir "unsloth @ git+https://github.com/unslothai/unsloth.git" 2>/dev/null || \
    echo "Unsloth not installed — will use standard PEFT training"

WORKDIR /app

# Copy application
COPY app/ ./app/

# Create workspace directories
RUN mkdir -p /workspace/models /workspace/datasets /workspace/adapters /workspace/gguf /workspace/hf_cache /shared/gguf

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8090/health || exit 1

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
