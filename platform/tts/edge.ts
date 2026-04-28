import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_TEXT_LENGTH = 6000;
const EDGE_TTS_TIMEOUT_MS = 30000;
const TEMP_DIR = path.join("/tmp", "corevia-tts");
const EDGE_TTS_SCRIPT = path.join(process.cwd(), "scripts", "edge_tts_synth.py");

export interface EdgeTtsSynthesisParams {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  format?: "wav" | "mp3";
}

function resolveDefaultVoice(language?: string, voice?: string): string {
  if (voice?.trim()) {
    return voice.trim();
  }

  if (language?.startsWith("ar")) {
    return process.env.EDGE_TTS_DEFAULT_ARABIC_VOICE || "ar-AE-FatimaNeural";
  }

  return process.env.EDGE_TTS_DEFAULT_VOICE || "en-GB-SoniaNeural";
}

function getExecErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as { stderr?: string; stdout?: string; message?: string };
    if (typeof e.stderr === "string" && e.stderr.trim()) return e.stderr.trim();
    if (typeof e.stdout === "string" && e.stdout.trim()) return e.stdout.trim();
    if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
  }
  if (error instanceof Error) return error.message;
  const primitiveError = error;
  if (typeof primitiveError === "string") return primitiveError;
  if (typeof primitiveError === "number" || typeof primitiveError === "boolean") {
    return primitiveError.toString();
  }
  return "Unknown execution error";
}

export async function isEdgeTtsAvailable(): Promise<boolean> {
  const pythonBin = process.env.EDGE_TTS_PYTHON_BIN || "python3";

  try {
    await fs.access(EDGE_TTS_SCRIPT);
  } catch {
    return false;
  }

  try {
    await execFileAsync(pythonBin, ["--version"], {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      env: process.env,
    });
    return true;
  } catch {
    return false;
  }
}

async function safeUnlink(filePath: string): Promise<void> {
  try { await fs.unlink(filePath); } catch { /* ignore */ }
}

/**
 * Neural TTS via Microsoft Edge (en-GB-SoniaNeural).
 * Produces human-like female voice in ~2-3 seconds.
 */
export async function synthesizeWithEdgeTts(params: EdgeTtsSynthesisParams): Promise<Buffer> {
  const text = params.text?.trim();
  if (!text) throw new Error("Text is required for speech synthesis");
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds maximum length (${MAX_TEXT_LENGTH} characters)`);
  }

  const pythonBin = process.env.EDGE_TTS_PYTHON_BIN || "python3";
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.access(EDGE_TTS_SCRIPT).catch(() => {
    throw new Error("Edge TTS backend script is missing at scripts/edge_tts_synth.py");
  });

  const id = randomUUID();
  const textFile = path.join(TEMP_DIR, `edge-${id}.txt`);
  const outputFile = path.join(TEMP_DIR, `edge-${id}.mp3`);

  try {
    await fs.writeFile(textFile, text, "utf8");

    const args = [
      EDGE_TTS_SCRIPT,
      "--text-file", textFile,
      "--output", outputFile,
      "--voice", resolveDefaultVoice(params.language, params.voice),
    ];

    await execFileAsync(pythonBin, args, {
      timeout: EDGE_TTS_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024,
      env: process.env,
    });

    const audioBuffer = await fs.readFile(outputFile);
    if (!audioBuffer.length) throw new Error("Edge TTS output was empty");
    return audioBuffer;
  } catch (error) {
    throw new Error(`Neural TTS failed: ${getExecErrorMessage(error)}`);
  } finally {
    await safeUnlink(textFile);
    await safeUnlink(outputFile);
  }
}

