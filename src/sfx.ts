export const SFX_STORAGE_KEY = "cat-board-games.sfx";

export type SfxCue = "place" | "win" | "lose" | "draw";
export type MutationKind = "play" | "undo" | "reset" | "mode" | "style" | "nav";
export type Side = "black" | "white";

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SynthEvent = {
  kind: "tone" | "noise";
  time: number;
  duration: number;
  gain: number;
  frequency?: number;
  frequencyTo?: number;
  type?: OscillatorType;
};

type Boardish = {
  mode?: "ai" | "local";
  winner?: Side | null;
  board?: Array<Side | null>;
  moves?: number;
  over?: boolean;
  pieces?: Array<{ id: string; row: number; col: number }>;
  phase?: string;
};

const GOMOKU_CELLS = 15 * 15;

const humanSide: Record<string, Side> = {
  gomoku: "black",
  go: "black",
  xiangqi: "white",
  jump: "black",
  tycoon: "black",
};

export function coerceSfxEnabled(raw: unknown): boolean {
  if (raw === true) return true;
  if (!raw || typeof raw !== "object") return false;
  return (raw as { enabled?: unknown }).enabled === true;
}

export function readSfxEnabled(store: KeyValueStore | null | undefined): boolean {
  if (!store) return false;
  try {
    const text = store.getItem(SFX_STORAGE_KEY);
    if (!text) return false;
    return coerceSfxEnabled(JSON.parse(text) as unknown);
  } catch {
    return false;
  }
}

export function writeSfxEnabled(store: KeyValueStore | null | undefined, enabled: boolean) {
  if (!store) return;
  try {
    store.setItem(SFX_STORAGE_KEY, JSON.stringify({ enabled }));
  } catch {
    // Private mode should not stop the game, and must not touch the music key.
  }
}

function asBoard(value: unknown): Boardish | null {
  if (!value || typeof value !== "object") return null;
  return value as Boardish;
}

function occupied(board: Array<Side | null> | undefined) {
  if (!board) return 0;
  let count = 0;
  for (const cell of board) if (cell) count += 1;
  return count;
}

function gomokuDrawn(state: Boardish) {
  if (state.winner) return false;
  if (typeof state.moves === "number") return state.moves >= GOMOKU_CELLS;
  return occupied(state.board) >= GOMOKU_CELLS;
}

function gomokuOver(state: Boardish) {
  return Boolean(state.winner) || gomokuDrawn(state);
}

function newStones(before: Boardish, after: Boardish) {
  const prev = before.board ?? [];
  const next = after.board ?? [];
  let count = 0;
  const size = Math.max(prev.length, next.length);
  for (let index = 0; index < size; index += 1) {
    if (!prev[index] && next[index]) count += 1;
  }
  return count;
}

function landings(before: Boardish, after: Boardish) {
  const previous = new Map((before.pieces ?? []).map((piece) => [piece.id, `${piece.row},${piece.col}`]));
  let count = 0;
  for (const piece of after.pieces ?? []) {
    const spot = previous.get(piece.id);
    if (spot && spot !== `${piece.row},${piece.col}`) count += 1;
  }
  return count;
}

function justEnded(gameId: string, before: Boardish, after: Boardish) {
  if (gameId === "gomoku") return !gomokuOver(before) && gomokuOver(after);
  if (gameId === "go") return before.over !== true && after.over === true;
  if (gameId === "tycoon") return before.phase !== "gameover" && after.phase === "gameover";
  return !before.winner && Boolean(after.winner);
}

function resultCue(gameId: string, state: Boardish): SfxCue {
  // Local games have two people at the board, so a winner hears the victory cue.
  // Against the computer, the cue follows the human: gomoku/go play black, xiangqi plays white.
  if (!state.winner) return "draw";
  if (state.mode !== "ai") return "win";
  return state.winner === (humanSide[gameId] ?? "black") ? "win" : "lose";
}

function placesFor(gameId: string, before: Boardish, after: Boardish) {
  if (gameId === "gomoku" || gameId === "go") return newStones(before, after);
  if (gameId === "xiangqi") return landings(before, after);
  return 0;
}

export function cuesForTransition(gameId: string, before: unknown, after: unknown, kind: MutationKind): SfxCue[] {
  if (kind !== "play") return [];
  const prev = asBoard(before);
  const next = asBoard(after);
  if (!prev || !next) return [];
  if (gameId === "gomoku" && gomokuOver(prev)) return [];
  if (gameId === "go" && prev.over === true) return [];
  if ((gameId === "xiangqi" || gameId === "jump") && prev.winner) return [];
  if (gameId === "tycoon" && prev.phase === "gameover") return [];

  const cues: SfxCue[] = [];
  const placed = placesFor(gameId, prev, next);
  for (let index = 0; index < placed; index += 1) cues.push("place");
  if (justEnded(gameId, prev, next)) cues.push(resultCue(gameId, next));
  return cues;
}

export function synthEvents(cue: SfxCue): SynthEvent[] {
  if (cue === "place") {
    return [
      { kind: "noise", time: 0, duration: 0.036, gain: 0.32 },
      { kind: "tone", time: 0, duration: 0.07, gain: 0.36, frequency: 620, frequencyTo: 168, type: "triangle" },
    ];
  }
  if (cue === "win") {
    return [523.25, 659.25, 783.99, 1046.5].map((frequency, index) => ({
      kind: "tone" as const,
      time: index * 0.11,
      duration: 0.18,
      gain: 0.2,
      frequency,
      type: "triangle" as const,
    }));
  }
  if (cue === "lose") {
    return [349.23, 261.63, 174.61].map((frequency, index) => ({
      kind: "tone" as const,
      time: index * 0.16,
      duration: 0.22,
      gain: 0.18,
      frequency,
      type: "sine" as const,
    }));
  }
  return [440, 440].map((frequency, index) => ({
    kind: "tone" as const,
    time: index * 0.07,
    duration: 0.06,
    gain: 0.14,
    frequency,
    type: "sine" as const,
  }));
}

export function cueSpan(cue: SfxCue) {
  return Math.max(...synthEvents(cue).map((event) => event.time + event.duration));
}

let sharedCtx: AudioContext | null = null;

function audioContext() {
  const host = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Ctor = globalThis.AudioContext ?? host.webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => undefined);
  return sharedCtx;
}

function playNoise(ctx: AudioContext, destination: AudioNode, event: SynthEvent, when: number) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * event.duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1480;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(event.gain, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + event.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(when);
  source.stop(when + event.duration + 0.02);
}

function playTone(ctx: AudioContext, destination: AudioNode, event: SynthEvent, when: number) {
  const osc = ctx.createOscillator();
  osc.type = event.type ?? "sine";
  osc.frequency.setValueAtTime(event.frequency ?? 440, when);
  if (event.frequencyTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, event.frequencyTo), when + event.duration);
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, event.gain), when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + event.duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(when);
  osc.stop(when + event.duration + 0.02);
}

export function primeBoardAudio() {
  audioContext();
}

export function playBoardCues(cues: readonly SfxCue[]) {
  if (!cues.length) return;
  const ctx = audioContext();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  let cursor = ctx.currentTime + 0.02;
  for (const cue of cues) {
    for (const event of synthEvents(cue)) {
      const when = cursor + event.time;
      if (event.kind === "noise") playNoise(ctx, master, event, when);
      else playTone(ctx, master, event, when);
    }
    cursor += cue === "place" ? 0.09 : cueSpan(cue) + 0.04;
  }
}
