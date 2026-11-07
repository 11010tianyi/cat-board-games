import {
  categoryById,
  findTrack,
  musicCatalog,
  stepTrackId,
  type MusicCategoryId,
  type MusicTrack,
} from "./music-catalog.ts";

export const MUSIC_STORAGE_KEY = "cat-board-games.music";
export const DEFAULT_VOLUME = 0.65;
export const MUSIC_PLAY_ERROR = "这首没能放出来，换一首试试。";

export type PersistedMusic = {
  categoryId: MusicCategoryId;
  trackIds: Record<MusicCategoryId, string>;
  volume: number;
  musicOn: boolean;
};

export type MusicRuntime = {
  persisted: PersistedMusic;
  playing: boolean;
  loadedTrackId: string | null;
};

export type PlaybackAction = "show-category" | "select-track" | "toggle" | "previous" | "next" | "ended";
export type PlaybackDecision = "keep" | "start" | "pause";

const categoryIds: MusicCategoryId[] = ["study", "album"];

function defaultTrackId(categoryId: MusicCategoryId) {
  return categoryById(categoryId).tracks[0].id;
}

export function defaultPersisted(): PersistedMusic {
  return {
    categoryId: "study",
    trackIds: {
      study: defaultTrackId("study"),
      album: defaultTrackId("album"),
    },
    volume: DEFAULT_VOLUME,
    musicOn: false,
  };
}

function isCategoryId(value: unknown): value is MusicCategoryId {
  return value === "study" || value === "album";
}

function clampVolume(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

export function coercePersisted(raw: unknown): PersistedMusic {
  const fallback = defaultPersisted();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<PersistedMusic>;
  const categoryId = isCategoryId(data.categoryId) ? data.categoryId : fallback.categoryId;
  const trackIds = { ...fallback.trackIds };
  const storedTracks = data.trackIds;
  if (storedTracks && typeof storedTracks === "object") {
    for (const categoryId of categoryIds) {
      const trackId = (storedTracks as Record<string, unknown>)[categoryId];
      if (typeof trackId === "string" && findTrack(trackId)?.category.id === categoryId) {
        trackIds[categoryId] = trackId;
      }
    }
  }
  return {
    categoryId,
    trackIds,
    volume: clampVolume(data.volume),
    musicOn: data.musicOn === true,
  };
}

export function createInitialRuntime(raw?: unknown): MusicRuntime {
  return {
    persisted: coercePersisted(raw),
    playing: false,
    loadedTrackId: null,
  };
}

export function decidePlayback(playing: boolean, action: PlaybackAction): PlaybackDecision {
  if (action === "show-category") return "keep";
  if (action === "select-track" || action === "previous" || action === "next") {
    return playing ? "start" : "keep";
  }
  if (action === "toggle") return playing ? "pause" : "start";
  if (action === "ended") return playing ? "start" : "keep";
  return "keep";
}

function readStored(): unknown {
  try {
    if (typeof localStorage === "undefined") return null;
    const text = localStorage.getItem(MUSIC_STORAGE_KEY);
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function writeStored(persisted: PersistedMusic) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Private mode or a full disk should not stop the game.
  }
}

let runtime: MusicRuntime = createInitialRuntime();
let expanded = false;
let errorMessage = "";
let showResumeHint = false;
let playToken = 0;
let mounted = false;
let dock: HTMLElement | null = null;
let audio: HTMLAudioElement | null = null;

export function musicPanelExpanded() {
  return expanded;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

function selectedTrack(categoryId = runtime.persisted.categoryId): MusicTrack {
  const category = categoryById(categoryId);
  const trackId = runtime.persisted.trackIds[categoryId];
  return category.tracks.find((track) => track.id === trackId) ?? category.tracks[0];
}

function barTitle() {
  if (runtime.playing && runtime.loadedTrackId) {
    const found = findTrack(runtime.loadedTrackId);
    if (found) return `在播 · ${found.track.title}`;
  }
  return `待播 · ${selectedTrack().title}`;
}

function statusText() {
  if (runtime.playing) return "正在播放";
  if (showResumeHint) return "上次开过音乐，点播放继续";
  return "默认安静，点播放才出声";
}

function syncLaunchers() {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>("[data-music-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

function render() {
  if (!dock) return;
  const category = categoryById(runtime.persisted.categoryId);
  const selected = selectedTrack();
  const playing = runtime.playing;
  dock.classList.toggle("is-open", expanded);
  dock.innerHTML = `
    <div class="music-bar">
      <button type="button" class="music-expand" data-music-action="expand" aria-expanded="${expanded}" aria-controls="music-panel">
        <span class="music-mark" aria-hidden="true">
          <svg class="music-mark-svg" viewBox="0 0 36 36">
            <circle cx="13" cy="20" r="8" fill="#171613" stroke="#ffd84d" stroke-width="1.4"></circle>
            <path d="M7.4 13.4 L5.2 6.6 L11.4 11.4 Z M18.6 13.4 L22.4 6.4 L16 11.2 Z" fill="#171613" stroke="#ffd84d" stroke-width="1"></path>
            <circle cx="10.5" cy="19.2" r="1.25" fill="#ffd84d"></circle>
            <circle cx="15.6" cy="19.2" r="1.25" fill="#ffd84d"></circle>
            <circle cx="27.2" cy="13.5" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
            <path d="M31.8 13.5 V26.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
          </svg>
          ${playing ? `<span class="music-eq"><span></span><span></span><span></span></span>` : ""}
        </span>
        <span class="music-now">
          <span class="music-now-kicker">听曲</span>
          <span class="music-now-title">${escapeHtml(barTitle())}</span>
        </span>
      </button>
      <button type="button" class="music-icon-button music-bar-step" data-music-action="previous" aria-label="上一首">‹</button>
      <button type="button" class="music-play" data-music-action="toggle" aria-pressed="${playing}" aria-label="${playing ? "暂停" : "播放"}">${playing ? "❚❚" : "▶"}</button>
      <button type="button" class="music-icon-button music-bar-step" data-music-action="next" aria-label="下一首">›</button>
    </div>
    <div class="music-panel" id="music-panel" role="region" aria-label="背景音乐" data-tone="${category.id}" ${expanded ? "" : "hidden"}>
      <div class="music-panel-head">
        <p class="music-kicker">背景音乐</p>
        <button type="button" class="music-text-button" data-music-action="expand">收起</button>
      </div>
      <div class="music-cats" role="group" aria-label="曲目分类">
        ${musicCatalog
          .map((item) => {
            const active = item.id === category.id;
            return `
              <button type="button" class="music-cat music-cat-${item.id} ${active ? "is-active" : ""}" data-category="${item.id}" aria-pressed="${active}">
                <span class="music-cat-tone">${escapeHtml(item.tone)}</span>
                <span class="music-cat-name">${escapeHtml(item.name)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      <p class="music-blurb">${escapeHtml(category.blurb)}</p>
      <div class="music-tracks" role="listbox" aria-label="${escapeHtml(category.name)}">
        ${category.tracks
          .map((track, index) => {
            const isSelected = track.id === selected.id;
            const isPlaying = playing && runtime.loadedTrackId === track.id;
            return `
              <button type="button" role="option" class="music-track ${isSelected ? "is-selected" : ""} ${isPlaying ? "is-playing" : ""}" data-track-id="${track.id}" aria-selected="${isSelected}">
                <span class="music-track-index">${index + 1}</span>
                <span class="music-track-copy">
                  <span class="music-track-title">${escapeHtml(track.title)}</span>
                  ${track.originalTitle ? `<span class="music-track-en">${escapeHtml(track.originalTitle)}</span>` : ""}
                </span>
                ${isPlaying ? `<span class="music-track-state">在播</span>` : ""}
              </button>
            `;
          })
          .join("")}
      </div>
      <p class="music-credit">${escapeHtml(category.credit)}</p>
      <div class="music-transport">
        <button type="button" class="music-text-button" data-music-action="previous">上一首</button>
        <button type="button" class="music-play music-play-wide" data-music-action="toggle" aria-pressed="${playing}">${playing ? "暂停" : "播放"}</button>
        <button type="button" class="music-text-button" data-music-action="next">下一首</button>
      </div>
      <label class="music-volume">
        <span>音量</span>
        <input type="range" min="0" max="100" step="1" value="${Math.round(runtime.persisted.volume * 100)}" data-volume aria-label="音量" />
        <span data-volume-label>${Math.round(runtime.persisted.volume * 100)}</span>
      </label>
      <p class="music-status">${escapeHtml(statusText())}</p>
      ${errorMessage ? `<p class="music-error" role="status">${escapeHtml(errorMessage)}</p>` : ""}
    </div>
  `;
  syncLaunchers();
}

function persist() {
  writeStored(runtime.persisted);
}

function failPlayback() {
  if (!runtime.playing && errorMessage === MUSIC_PLAY_ERROR) return;
  runtime.playing = false;
  runtime.persisted.musicOn = false;
  errorMessage = MUSIC_PLAY_ERROR;
  try {
    audio?.pause();
    if (audio) {
      delete audio.dataset.trackId;
      audio.removeAttribute("src");
    }
  } catch {
    // Ignore a player that has already been torn down.
  }
  persist();
  render();
}

function startTrack(categoryId: MusicCategoryId, trackId: string, reveal = true) {
  if (!audio) return;
  const category = categoryById(categoryId);
  const track = category.tracks.find((item) => item.id === trackId) ?? category.tracks[0];
  if (reveal) runtime.persisted.categoryId = categoryId;
  runtime.persisted.trackIds[categoryId] = track.id;
  runtime.loadedTrackId = track.id;
  runtime.playing = true;
  showResumeHint = false;
  errorMessage = "";
  const token = ++playToken;
  audio.volume = runtime.persisted.volume;
  audio.dataset.playToken = String(token);
  if (audio.dataset.trackId !== track.id) {
    audio.dataset.trackId = track.id;
    audio.src = track.url;
  }
  const pending = audio.play();
  render();
  pending
    ?.then(() => {
      if (token !== playToken) return;
      runtime.playing = true;
      runtime.persisted.musicOn = true;
      persist();
    })
    .catch(() => {
      if (token !== playToken) return;
      failPlayback();
    });
}

function pausePlayback() {
  playToken += 1;
  runtime.playing = false;
  runtime.persisted.musicOn = false;
  showResumeHint = false;
  try {
    audio?.pause();
  } catch {
    // The game keeps running even if the audio element refuses to pause.
  }
  persist();
  render();
}

function moveSelection(delta: number) {
  const categoryId = runtime.persisted.categoryId;
  const nextId = stepTrackId(categoryId, runtime.persisted.trackIds[categoryId], delta);
  runtime.persisted.trackIds[categoryId] = nextId;
  errorMessage = "";
  persist();
  if (decidePlayback(runtime.playing, delta < 0 ? "previous" : "next") === "start") {
    startTrack(categoryId, nextId);
    return;
  }
  render();
}

function selectCategory(categoryId: MusicCategoryId) {
  runtime.persisted.categoryId = categoryId;
  errorMessage = "";
  persist();
  if (decidePlayback(runtime.playing, "show-category") === "start") {
    startTrack(categoryId, selectedTrack(categoryId).id);
    return;
  }
  render();
}

function selectTrack(trackId: string) {
  const categoryId = runtime.persisted.categoryId;
  if (!categoryById(categoryId).tracks.some((track) => track.id === trackId)) return;
  runtime.persisted.trackIds[categoryId] = trackId;
  errorMessage = "";
  persist();
  if (decidePlayback(runtime.playing, "select-track") === "start") {
    startTrack(categoryId, trackId);
    return;
  }
  render();
}

function togglePlayback() {
  const decision = decidePlayback(runtime.playing, "toggle");
  if (decision === "pause") {
    pausePlayback();
    return;
  }
  if (decision === "start") startTrack(runtime.persisted.categoryId, selectedTrack().id);
}

function onEnded() {
  if (decidePlayback(runtime.playing, "ended") !== "start") return;
  const loaded = runtime.loadedTrackId ? findTrack(runtime.loadedTrackId) : null;
  const categoryId = loaded?.category.id ?? runtime.persisted.categoryId;
  const currentId = loaded?.track.id ?? runtime.persisted.trackIds[categoryId];
  const nextId = stepTrackId(categoryId, currentId, 1);
  runtime.persisted.trackIds[categoryId] = nextId;
  persist();
  startTrack(categoryId, nextId, false);
}

function setVolume(percent: number) {
  if (!Number.isFinite(percent)) return;
  runtime.persisted.volume = clampVolume(percent / 100);
  if (audio) audio.volume = runtime.persisted.volume;
  persist();
  const label = dock?.querySelector<HTMLElement>("[data-volume-label]");
  if (label) label.textContent = String(Math.round(runtime.persisted.volume * 100));
}

function handleClick(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const categoryButton = target.closest<HTMLElement>("[data-category]");
  if (categoryButton?.dataset.category && isCategoryId(categoryButton.dataset.category)) {
    selectCategory(categoryButton.dataset.category);
    return;
  }
  const trackButton = target.closest<HTMLElement>("[data-track-id]");
  if (trackButton?.dataset.trackId) {
    selectTrack(trackButton.dataset.trackId);
    return;
  }
  const actionButton = target.closest<HTMLElement>("[data-music-action]");
  const action = actionButton?.dataset.musicAction;
  if (action === "expand") {
    expanded = !expanded;
    render();
    return;
  }
  if (action === "previous") moveSelection(-1);
  else if (action === "next") moveSelection(1);
  else if (action === "toggle") togglePlayback();
}

export function placeMusicPlayer() {
  if (!dock || typeof document === "undefined") return;
  const slot = document.querySelector<HTMLElement>("[data-music-slot]");
  const parent = slot ?? document.body;
  if (dock.parentElement !== parent) parent.append(dock);
}

export function toggleMusicPanel() {
  expanded = !expanded;
  render();
  if (expanded) dock?.scrollIntoView({ block: "nearest" });
}

export function mountMusicPlayer() {
  if (mounted || typeof document === "undefined" || !document.body) return;
  mounted = true;
  runtime = createInitialRuntime(readStored());
  showResumeHint = runtime.persisted.musicOn;
  expanded = false;
  errorMessage = "";
  playToken = 0;

  audio = document.createElement("audio");
  audio.preload = "none";
  audio.autoplay = false;
  audio.loop = false;
  audio.setAttribute("playsinline", "");
  audio.hidden = true;
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("error", () => {
    if (!runtime.playing || !audio) return;
    if (audio.dataset.playToken !== String(playToken)) return;
    failPlayback();
  });

  dock = document.createElement("div");
  dock.id = "music-player";
  dock.className = "music-dock";
  dock.dataset.musicRoot = "";
  dock.addEventListener("click", (event) => {
    event.stopPropagation();
    handleClick(event);
  });
  dock.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("[data-volume]")) return;
    setVolume(Number(target.value));
  });
  dock.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });

  document.body.append(audio);
  if (audio) audio.volume = runtime.persisted.volume;
  render();
  placeMusicPlayer();
}
