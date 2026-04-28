interface BrowserTtsOptions {
  text: string;
  language?: string;
  rate?: number;
}

function resolveLanguage(language?: string): string {
  if (!language) {
    return "en-GB";
  }

  const normalized = language.trim();
  if (!normalized) {
    return "en-GB";
  }

  if (normalized.startsWith("ar")) {
    return normalized.includes("-") ? normalized : "ar-AE";
  }

  if (normalized.startsWith("en")) {
    return normalized.includes("-") ? normalized : "en-GB";
  }

  return normalized;
}

export function canUseBrowserTts(): boolean {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof window.SpeechSynthesisUtterance !== "undefined";
}

export function cancelBrowserTts(): void {
  if (canUseBrowserTts()) {
    window.speechSynthesis.cancel();
  }
}

export function speakWithBrowserTts(options: BrowserTtsOptions): Promise<void> {
  if (!canUseBrowserTts()) {
    return Promise.reject(new Error("Browser speech synthesis is unavailable"));
  }

  const text = options.text.trim();
  if (!text) {
    return Promise.resolve();
  }

  const language = resolveLanguage(options.language);
  const rate = Math.min(Math.max(options.rate ?? 1, 0.5), 2);

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = rate;

    let settled = false;
    const finalize = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    utterance.onend = () => finalize(resolve);
    utterance.onerror = (event) => finalize(() => reject(new Error(event.error || "Browser TTS failed")));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}