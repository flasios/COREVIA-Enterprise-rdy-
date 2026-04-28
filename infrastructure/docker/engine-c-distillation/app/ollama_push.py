"""
GGUF Conversion & Ollama Push — Converts merged HF model to GGUF and pushes to Ollama.

Flow:
  1. Convert merged HF safetensors → GGUF (Q4_K_M quantization)
  2. Create Ollama Modelfile referencing the GGUF
  3. Push to Ollama via POST /api/create
"""

import logging
import subprocess
import shutil
from pathlib import Path
from typing import Optional

import httpx

from .config import GGUF_DIR, OLLAMA_ENDPOINT

logger = logging.getLogger("engine-c.ollama")

# Path to llama.cpp convert script (installed in Docker image)
CONVERT_SCRIPT = Path("/opt/llama.cpp/convert_hf_to_gguf.py")
QUANTIZE_BIN = Path("/opt/llama.cpp/llama-quantize")


def convert_to_gguf(
    merged_model_dir: Path,
    job_id: str,
    quantization: str = "Q4_K_M",
) -> Path:
    """
    Convert merged HF model to GGUF format.

    Steps:
      1. Convert HF → GGUF F16
      2. Quantize F16 → Q4_K_M (or specified quantization)
    """
    output_dir = GGUF_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    f16_path = output_dir / "model-f16.gguf"
    quantized_path = output_dir / f"model-{quantization}.gguf"

    # Step 1: Convert HF to GGUF F16
    logger.info(f"[{job_id}] Converting HF model to GGUF F16...")

    if CONVERT_SCRIPT.exists():
        result = subprocess.run(
            [
                "python3", str(CONVERT_SCRIPT),
                str(merged_model_dir),
                "--outtype", "f16",
                "--outfile", str(f16_path),
            ],
            capture_output=True,
            text=True,
            timeout=3600,
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"GGUF conversion failed: {result.stderr[-500:]}"
            )
    else:
        # Fallback: try using the llama-cpp-python package
        _convert_with_python(merged_model_dir, f16_path)

    if not f16_path.exists():
        raise FileNotFoundError(f"F16 GGUF not produced at {f16_path}")

    logger.info(f"[{job_id}] F16 GGUF size: {f16_path.stat().st_size / 1e9:.1f} GB")

    # Step 2: Quantize
    if QUANTIZE_BIN.exists() and quantization != "f16":
        logger.info(f"[{job_id}] Quantizing to {quantization}...")
        result = subprocess.run(
            [str(QUANTIZE_BIN), str(f16_path), str(quantized_path), quantization],
            capture_output=True,
            text=True,
            timeout=3600,
        )
        if result.returncode != 0:
            logger.warning(f"[{job_id}] Quantization failed, using F16: {result.stderr[-200:]}")
            quantized_path = f16_path
        else:
            # Remove F16 to save space
            f16_path.unlink(missing_ok=True)
    else:
        logger.info(f"[{job_id}] Skipping quantization (llama-quantize not found or f16 requested)")
        quantized_path = f16_path

    logger.info(f"[{job_id}] Final GGUF: {quantized_path} ({quantized_path.stat().st_size / 1e9:.1f} GB)")
    return quantized_path


def _convert_with_python(model_dir: Path, output_path: Path):
    """Fallback GGUF conversion using HuggingFace export."""
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        import torch

        logger.info("Using HuggingFace-based GGUF export...")
        model = AutoModelForCausalLM.from_pretrained(
            str(model_dir),
            torch_dtype=torch.float16,
            device_map="cpu",
        )
        # Save in safetensors format (GGUF tools can pick this up)
        model.save_pretrained(str(model_dir), safe_serialization=True)
        # Try gguf export if available
        try:
            from huggingface_hub import snapshot_download
            # The convert script from llama.cpp is the canonical way
            raise ImportError("Use llama.cpp convert script")
        except ImportError:
            raise RuntimeError(
                "GGUF conversion requires llama.cpp tools. "
                "Ensure /opt/llama.cpp is installed in the Docker image."
            )
    except Exception as e:
        raise RuntimeError(f"GGUF conversion fallback failed: {e}")


def push_to_ollama(
    gguf_path: Path,
    model_name: str,
    job_id: str,
    system_prompt: Optional[str] = None,
    ollama_endpoint: Optional[str] = None,
) -> bool:
    """
    Push a GGUF model to Ollama by creating a Modelfile and calling /api/create.

    The GGUF file must be accessible to the Ollama container via a shared volume.
    We map the path relative to the shared mount point.
    """
    endpoint = ollama_endpoint or OLLAMA_ENDPOINT

    # The GGUF path inside the Ollama container via shared volume
    # Shared volume is mounted at /shared in both containers
    shared_gguf_path = Path("/shared/gguf") / job_id / gguf_path.name

    # Copy GGUF to shared volume
    shared_dir = Path("/shared/gguf") / job_id
    shared_dir.mkdir(parents=True, exist_ok=True)
    shared_dest = shared_dir / gguf_path.name

    if gguf_path != shared_dest:
        logger.info(f"[{job_id}] Copying GGUF to shared volume: {shared_dest}")
        shutil.copy2(gguf_path, shared_dest)

    # Build Modelfile
    modelfile_lines = [f"FROM {shared_gguf_path}"]

    if system_prompt:
        escaped = system_prompt.replace('"', '\\"')
        modelfile_lines.append(f'SYSTEM """{escaped}"""')

    # Set reasonable defaults for inference
    modelfile_lines.extend([
        "PARAMETER temperature 0.2",
        "PARAMETER top_p 0.9",
        "PARAMETER num_predict 2048",
    ])

    modelfile = "\n".join(modelfile_lines)

    logger.info(f"[{job_id}] Creating Ollama model '{model_name}'...")
    logger.info(f"[{job_id}] Modelfile:\n{modelfile}")

    try:
        with httpx.Client(timeout=600.0) as client:
            response = client.post(
                f"{endpoint}/api/create",
                json={
                    "name": model_name,
                    "modelfile": modelfile,
                },
            )

            if response.status_code == 200:
                logger.info(f"[{job_id}] Model '{model_name}' created in Ollama")
                return True
            else:
                logger.error(
                    f"[{job_id}] Ollama create failed ({response.status_code}): "
                    f"{response.text[:500]}"
                )
                return False
    except httpx.HTTPError as e:
        logger.error(f"[{job_id}] Ollama push error: {e}")
        return False


def verify_model_in_ollama(
    model_name: str,
    ollama_endpoint: Optional[str] = None,
) -> bool:
    """Verify the model is available in Ollama after push."""
    endpoint = ollama_endpoint or OLLAMA_ENDPOINT
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{endpoint}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return any(model_name in m for m in models)
    except httpx.HTTPError:
        pass
    return False
