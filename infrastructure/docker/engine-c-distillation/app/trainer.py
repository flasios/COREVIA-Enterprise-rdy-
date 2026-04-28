"""
Engine C Trainer — LoRA/QLoRA fine-tuning with Unsloth or HuggingFace PEFT.

Supports:
  - Unsloth accelerated training (2x faster, lower VRAM)
  - Fallback to standard transformers + peft + trl
  - QLoRA 4-bit quantization for large models
  - Progress tracking with step-level callbacks
"""

import json
import logging
import time
from pathlib import Path
from typing import Optional, Callable

import torch
from datasets import Dataset

from .config import (
    MODELS_DIR, ADAPTERS_DIR, HF_MODEL_MAP,
    DEFAULT_MAX_SEQ_LENGTH,
)
from .models import JobStatus

logger = logging.getLogger("engine-c.trainer")


def resolve_hf_model(ollama_name: str) -> str:
    """Map Ollama model name to HuggingFace repo ID."""
    if "/" in ollama_name:
        return ollama_name  # Already a HF repo
    return HF_MODEL_MAP.get(ollama_name, ollama_name)


def _detect_unsloth() -> bool:
    """Check if Unsloth is available."""
    try:
        import unsloth  # noqa: F401
        return True
    except ImportError:
        return False


def _normalize_training_data(raw_records: list[dict]) -> list[dict]:
    """
    Normalize training records into conversation format:
    [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]
    """
    normalized = []
    for record in raw_records:
        messages = []

        # Already in conversation format
        if "messages" in record and isinstance(record["messages"], list):
            messages = record["messages"]
        # Flat instruction format
        elif "system" in record or "input" in record or "output" in record:
            if record.get("system"):
                messages.append({"role": "system", "content": str(record["system"])})
            if record.get("input"):
                messages.append({"role": "user", "content": str(record["input"])})
            if record.get("output"):
                messages.append({"role": "assistant", "content": str(record["output"])})
        else:
            continue  # Skip malformed records

        if len(messages) >= 2:  # Need at least user + assistant
            normalized.append({"messages": messages})

    return normalized


def _format_for_training(records: list[dict], tokenizer) -> list[str]:
    """Format records into text using the tokenizer's chat template."""
    formatted = []
    for record in records:
        messages = record.get("messages", [])
        try:
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
            formatted.append(text)
        except Exception:
            # Fallback: manual formatting
            parts = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                parts.append(f"<|{role}|>\n{content}")
            formatted.append("\n".join(parts))
    return formatted


class ProgressCallback:
    """Training callback that updates job state in real-time."""

    def __init__(self, job: dict, on_update: Optional[Callable] = None):
        self.job = job
        self.on_update = on_update

    def on_step(self, step: int, total_steps: int, loss: float, epoch: float):
        self.job["current_step"] = step
        self.job["total_steps"] = total_steps
        self.job["training_loss"] = round(loss, 6)
        self.job["current_epoch"] = int(epoch)
        self.job["progress_pct"] = round(
            (step / total_steps * 100) if total_steps > 0 else 0, 1
        )
        if self.on_update:
            self.on_update(self.job)


def run_training(
    job: dict,
    training_data: list[dict],
    hf_model: str,
    lora_rank: int = 16,
    lora_alpha: int = 32,
    lora_dropout: float = 0.05,
    learning_rate: float = 2e-4,
    epochs: int = 3,
    batch_size: int = 4,
    max_seq_length: int = DEFAULT_MAX_SEQ_LENGTH,
    on_update: Optional[Callable] = None,
) -> Path:
    """
    Run LoRA/QLoRA fine-tuning. Returns path to merged model output.

    Tries Unsloth first (faster, lower VRAM), falls back to standard PEFT.
    """
    job_id = job["id"]
    output_dir = ADAPTERS_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # Normalize training data
    records = _normalize_training_data(training_data)
    if not records:
        raise ValueError("No valid training records after normalization")

    logger.info(f"[{job_id}] {len(records)} training records normalized")
    logger.info(f"[{job_id}] Base model: {hf_model}")
    logger.info(f"[{job_id}] LoRA rank={lora_rank}, alpha={lora_alpha}, epochs={epochs}")

    progress = ProgressCallback(job, on_update)
    use_unsloth = _detect_unsloth()

    if use_unsloth:
        merged_path = _train_with_unsloth(
            job_id, hf_model, records, output_dir,
            lora_rank, lora_alpha, lora_dropout,
            learning_rate, epochs, batch_size,
            max_seq_length, progress,
        )
    else:
        merged_path = _train_with_peft(
            job_id, hf_model, records, output_dir,
            lora_rank, lora_alpha, lora_dropout,
            learning_rate, epochs, batch_size,
            max_seq_length, progress,
        )

    return merged_path


def _train_with_unsloth(
    job_id: str,
    hf_model: str,
    records: list[dict],
    output_dir: Path,
    lora_rank: int,
    lora_alpha: int,
    lora_dropout: float,
    learning_rate: float,
    epochs: int,
    batch_size: int,
    max_seq_length: int,
    progress: ProgressCallback,
) -> Path:
    """Train using Unsloth (2x faster, lower VRAM via QLoRA)."""
    from unsloth import FastLanguageModel
    from trl import SFTTrainer
    from transformers import TrainingArguments, TrainerCallback

    logger.info(f"[{job_id}] Loading model with Unsloth (4-bit QLoRA)...")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=hf_model,
        max_seq_length=max_seq_length,
        load_in_4bit=True,
        dtype=None,  # Auto-detect
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=lora_rank,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        use_gradient_checkpointing="unsloth",
    )

    # Format and create dataset
    texts = _format_for_training(records, tokenizer)
    dataset = Dataset.from_dict({"text": texts})

    # Progress callback
    class StepCallback(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kwargs):
            loss = (logs or {}).get("loss", 0.0)
            progress.on_step(
                state.global_step,
                state.max_steps,
                loss,
                state.epoch or 0,
            )

    merged_dir = output_dir / "merged"
    merged_dir.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=TrainingArguments(
            output_dir=str(output_dir / "checkpoints"),
            per_device_train_batch_size=batch_size,
            num_train_epochs=epochs,
            learning_rate=learning_rate,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=1,
            save_strategy="epoch",
            warmup_steps=5,
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=42,
            report_to="none",
        ),
        callbacks=[StepCallback()],
    )

    logger.info(f"[{job_id}] Starting Unsloth training...")
    trainer.train()

    # Merge LoRA weights into base model
    logger.info(f"[{job_id}] Merging LoRA weights...")
    model.save_pretrained_merged(
        str(merged_dir),
        tokenizer,
        save_method="merged_16bit",
    )

    logger.info(f"[{job_id}] Merged model saved to {merged_dir}")
    return merged_dir


def _train_with_peft(
    job_id: str,
    hf_model: str,
    records: list[dict],
    output_dir: Path,
    lora_rank: int,
    lora_alpha: int,
    lora_dropout: float,
    learning_rate: float,
    epochs: int,
    batch_size: int,
    max_seq_length: int,
    progress: ProgressCallback,
) -> Path:
    """Train using standard transformers + PEFT (fallback path)."""
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
        TrainerCallback,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer

    logger.info(f"[{job_id}] Loading model with PEFT (QLoRA 4-bit)...")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(
        hf_model,
        trust_remote_code=True,
        cache_dir=str(MODELS_DIR),
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        hf_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        cache_dir=str(MODELS_DIR),
    )
    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        task_type="CAUSAL_LM",
        bias="none",
    )
    model = get_peft_model(model, lora_config)

    # Format and create dataset
    texts = _format_for_training(records, tokenizer)
    dataset = Dataset.from_dict({"text": texts})

    # Progress callback
    class StepCallback(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kwargs):
            loss = (logs or {}).get("loss", 0.0)
            progress.on_step(
                state.global_step,
                state.max_steps,
                loss,
                state.epoch or 0,
            )

    merged_dir = output_dir / "merged"
    merged_dir.mkdir(parents=True, exist_ok=True)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=TrainingArguments(
            output_dir=str(output_dir / "checkpoints"),
            per_device_train_batch_size=batch_size,
            num_train_epochs=epochs,
            learning_rate=learning_rate,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=1,
            save_strategy="epoch",
            warmup_steps=5,
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=42,
            report_to="none",
            gradient_accumulation_steps=max(1, 8 // batch_size),
        ),
        callbacks=[StepCallback()],
        max_seq_length=max_seq_length,
    )

    logger.info(f"[{job_id}] Starting PEFT training...")
    trainer.train()

    # Save LoRA adapter
    adapter_dir = output_dir / "adapter"
    adapter_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(adapter_dir))

    # Merge into full model for GGUF conversion
    logger.info(f"[{job_id}] Merging LoRA weights into base model...")
    from peft import AutoPeftModelForCausalLM

    merged_model = AutoPeftModelForCausalLM.from_pretrained(
        str(adapter_dir),
        device_map="auto",
        torch_dtype=torch.float16,
    )
    merged_model = merged_model.merge_and_unload()
    merged_model.save_pretrained(str(merged_dir))
    tokenizer.save_pretrained(str(merged_dir))

    logger.info(f"[{job_id}] Merged model saved to {merged_dir}")
    return merged_dir
