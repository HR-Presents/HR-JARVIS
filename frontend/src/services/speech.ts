/** Respect the existing 2,000-character speech endpoint without silently truncating replies. */
export function speechChunks(text: string, max = 1800): string[] {
  const plain = text
    .replace(/```[\s\S]*?```/g, " Code is available in the transcript. ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#`]/g, "")
    .trim();
  const chunks: string[] = [];
  let rest = plain;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
    );
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut < 1) cut = max - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
export function waitForSpeech(
  audio: HTMLAudioElement,
  signal?: AbortSignal,
): Promise<boolean> {
  if (audio.ended) return Promise.resolve(true);
  if (audio.paused || signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("pause", paused);
      audio.removeEventListener("error", failed);
      signal?.removeEventListener("abort", cancel);
    };
    const ended = () => {
      cleanup();
      resolve(true);
    };
    const paused = () => {
      cleanup();
      resolve(audio.ended);
    };
    const failed = () => {
      cleanup();
      reject(new Error("Speech playback failed."));
    };
    const cancel = () => {
      cleanup();
      audio.pause();
      resolve(false);
    };
    audio.addEventListener("ended", ended, { once: true });
    audio.addEventListener("pause", paused, { once: true });
    audio.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", cancel, { once: true });
  });
}
