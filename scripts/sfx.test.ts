import assert from "node:assert/strict";
import test from "node:test";
import { MUSIC_STORAGE_KEY, coercePersisted } from "../src/music-player.ts";
import {
  SFX_STORAGE_KEY,
  cueSpan,
  cuesForTransition,
  readSfxEnabled,
  synthEvents,
  writeSfxEnabled,
  type KeyValueStore,
  type SfxCue,
} from "../src/sfx.ts";
import { gameTest } from "../src/main.ts";

function memoryStore(seed: Record<string, string> = {}): KeyValueStore & { snapshot(): Record<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    snapshot() {
      return Object.fromEntries(data);
    },
  };
}

function frequencies(cue: SfxCue) {
  return synthEvents(cue).flatMap((event) => (typeof event.frequency === "number" ? [event.frequency] : []));
}

test("sound effects stay off until enabled and never play just to restore a preference", () => {
  const empty = memoryStore();
  assert.equal(readSfxEnabled(null), false);
  assert.equal(readSfxEnabled(empty), false);
  assert.equal(readSfxEnabled(memoryStore({ [SFX_STORAGE_KEY]: "{" })), false);
  assert.equal(readSfxEnabled(memoryStore({ [SFX_STORAGE_KEY]: JSON.stringify({ enabled: "yes" }) })), false);
  assert.equal(readSfxEnabled(memoryStore({ [SFX_STORAGE_KEY]: JSON.stringify({ enabled: false }) })), false);

  const saved = memoryStore({ [SFX_STORAGE_KEY]: JSON.stringify({ enabled: true }) });
  assert.equal(readSfxEnabled(saved), true);
  assert.deepEqual(saved.snapshot(), { [SFX_STORAGE_KEY]: JSON.stringify({ enabled: true }) });

  gameTest.resetShell();
  assert.equal(gameTest.isSfxEnabled(), false);
  assert.match(gameTest.shellHtml(), /data-sfx-toggle aria-pressed="false"/);
  gameTest.playCell(7, 7);
  assert.deepEqual(gameTest.drainSfx(), []);

  gameTest.setSfxEnabled(true);
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.useGame("gomoku");
  assert.match(gameTest.shellHtml(), /data-sfx-toggle aria-pressed="true"/);
  assert.match(gameTest.shellHtml(), /data-music-toggle/);
  assert.match(gameTest.shellHtml(), />听曲</);
  assert.deepEqual(gameTest.drainSfx(), []);
});

test("the sound toggle stores itself and leaves the music preference alone", () => {
  assert.notEqual(SFX_STORAGE_KEY, MUSIC_STORAGE_KEY);
  const store = memoryStore({
    [MUSIC_STORAGE_KEY]: JSON.stringify({
      categoryId: "album",
      trackIds: { study: "water-lily", album: "jgirl" },
      volume: 0.25,
      musicOn: true,
    }),
  });
  writeSfxEnabled(store, true);
  writeSfxEnabled(store, false);
  const music = coercePersisted(JSON.parse(store.getItem(MUSIC_STORAGE_KEY) ?? "null"));
  assert.equal(music.musicOn, true);
  assert.equal(music.volume, 0.25);
  assert.equal(music.categoryId, "album");
  assert.equal(music.trackIds.album, "jgirl");
  assert.equal(readSfxEnabled(store), false);
  assert.equal(store.snapshot()[SFX_STORAGE_KEY], JSON.stringify({ enabled: false }));
});

test("placement, capture, and finished games choose different cues", () => {
  const quiet = { mode: "ai" as const, winner: null, moves: 0, board: [null, null] };
  const placed = { ...quiet, moves: 1, board: ["black" as const, null] };
  assert.deepEqual(cuesForTransition("gomoku", quiet, placed, "play"), ["place"]);
  assert.deepEqual(cuesForTransition("gomoku", quiet, placed, "undo"), []);
  assert.deepEqual(cuesForTransition("gomoku", quiet, placed, "reset"), []);
  assert.deepEqual(cuesForTransition("gomoku", quiet, placed, "mode"), []);

  const won = { ...placed, winner: "black" as const, moves: 5 };
  assert.deepEqual(cuesForTransition("gomoku", quiet, won, "play"), ["place", "win"]);
  const aiLoss = { mode: "ai" as const, winner: "white" as const, moves: 9, board: ["white" as const] };
  assert.deepEqual(cuesForTransition("gomoku", quiet, aiLoss, "play"), ["place", "lose"]);
  const localWin = { ...aiLoss, mode: "local" as const };
  assert.deepEqual(cuesForTransition("gomoku", quiet, localWin, "play"), ["place", "win"]);
  const full = Array<"black" | "white" | null>(225).fill("black");
  assert.deepEqual(
    cuesForTransition(
      "gomoku",
      { mode: "local", winner: null, moves: 224, board: full },
      { mode: "local", winner: null, moves: 225, board: full },
      "play",
    ),
    ["draw"],
  );

  const captured = {
    mode: "local" as const,
    over: false,
    winner: null,
    board: [null, "black" as const],
  };
  assert.deepEqual(
    cuesForTransition("go", { mode: "local", over: false, winner: null, board: ["white", null] }, captured, "play"),
    ["place"],
  );
  assert.deepEqual(
    cuesForTransition("go", { mode: "ai", over: false, winner: null, board: [] }, { mode: "ai", over: true, winner: null, board: [] }, "play"),
    ["draw"],
  );
  assert.deepEqual(
    cuesForTransition(
      "go",
      { mode: "ai", over: false, winner: null, board: [] },
      { mode: "ai", over: true, winner: "white", board: ["white"] },
      "play",
    ),
    ["place", "lose"],
  );

  const parked = { mode: "ai" as const, winner: null, pieces: [{ id: "rook", row: 0, col: 0 }] };
  assert.deepEqual(cuesForTransition("xiangqi", parked, { ...parked, selected: "rook" }, "play"), []);
  assert.deepEqual(
    cuesForTransition(
      "xiangqi",
      parked,
      { mode: "ai", winner: "white", pieces: [{ id: "rook", row: 0, col: 4 }] },
      "play",
    ),
    ["place", "win"],
  );
  assert.deepEqual(
    cuesForTransition("jump", { mode: "ai", winner: null }, { mode: "ai", winner: "white" }, "play"),
    ["lose"],
  );
  assert.deepEqual(
    cuesForTransition("tycoon", { mode: "ai", phase: "end", winner: null }, { mode: "ai", phase: "gameover", winner: null }, "play"),
    ["draw"],
  );
});

test("synthesized cues are short clicks, a rising win, a lower loss, and a neutral draw", () => {
  assert.ok(synthEvents("place").some((event) => event.kind === "noise"));
  assert.ok(cueSpan("place") < 0.12);
  const win = frequencies("win");
  const lose = frequencies("lose");
  const draw = frequencies("draw");
  assert.ok(Math.max(...win) > Math.max(...lose));
  assert.ok(Math.min(...lose) < Math.min(...win));
  assert.ok(win.at(-1)! > win[0]);
  assert.ok(lose.at(-1)! < lose[0]);
  assert.equal(draw[0], draw.at(-1));
  assert.ok(cueSpan("draw") < cueSpan("lose"));
  assert.ok(Math.max(...draw) < Math.max(...win));
  assert.ok(Math.min(...draw) > Math.min(...lose));
});

test("real moves trigger cues and illegal, undo, or reset actions stay quiet", () => {
  gameTest.resetShell();
  gameTest.setSfxEnabled(true);
  gameTest.useGame("gomoku");
  gameTest.playCell(7, 7);
  assert.equal(gameTest.drainSfx().flat().includes("place"), true);
  gameTest.playCell(7, 7);
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.playAction("undo");
  gameTest.playAction("reset");
  assert.deepEqual(gameTest.drainSfx(), []);

  gameTest.useGame("gomoku");
  gameTest.patch("gomoku", (state) => {
    state.mode = "ai";
    state.turn = "black";
    for (let col = 0; col < 4; col += 1) {
      state.board[col] = "black";
      state.moves += 1;
      state.history.push({ row: 0, col, player: "black" });
    }
  });
  gameTest.drainSfx();
  gameTest.playCell(0, 4);
  assert.deepEqual(gameTest.drainSfx().flat(), ["place", "win"]);

  gameTest.useGame("gomoku");
  gameTest.patch("gomoku", (state) => {
    state.mode = "local";
    state.turn = "white";
    for (let col = 0; col < 4; col += 1) {
      state.board[5 * 15 + col] = "white";
      state.moves += 1;
      state.history.push({ row: 5, col, player: "white" });
    }
  });
  gameTest.drainSfx();
  gameTest.playCell(5, 4);
  assert.deepEqual(gameTest.drainSfx().flat(), ["place", "win"]);

  gameTest.useGame("gomoku");
  gameTest.patch("gomoku", (state) => {
    state.mode = "ai";
    state.turn = "black";
    for (let col = 0; col < 4; col += 1) {
      state.board[5 * 15 + col] = "white";
      state.board[col] = "black";
      state.moves += 2;
      state.history.push({ row: 5, col, player: "white" }, { row: 0, col, player: "black" });
    }
  });
  gameTest.drainSfx();
  gameTest.playCell(8, 8);
  const loss = gameTest.drainSfx().flat();
  assert.equal(loss.filter((cue) => cue === "place").length, 2);
  assert.equal(loss.includes("lose"), true);
  assert.equal(loss.includes("win"), false);

  gameTest.useGame("go");
  gameTest.drainSfx();
  gameTest.playAction("goMode:local");
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.playCell(4, 4);
  assert.deepEqual(gameTest.drainSfx().flat(), ["place"]);
  gameTest.playCell(4, 4);
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.useGame("go");
  gameTest.playAction("goMode:local");
  gameTest.drainSfx();
  gameTest.playAction("pass");
  gameTest.playAction("pass");
  assert.deepEqual(gameTest.drainSfx().flat(), ["draw"]);

  gameTest.useGame("xiangqi");
  gameTest.patch("xiangqi", (state) => {
    state.mode = "ai";
    state.turn = "white";
    state.winner = null;
    state.selected = null;
    state.pieces = [
      { id: "wg", side: "white", kind: "G", row: 8, col: 4 },
      { id: "bg", side: "black", kind: "G", row: 0, col: 3 },
      { id: "wr", side: "white", kind: "R", row: 0, col: 0 },
    ];
  });
  gameTest.drainSfx();
  gameTest.playCell(0, 0);
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.playCell(1, 1);
  assert.deepEqual(gameTest.drainSfx(), []);
  gameTest.playCell(0, 3);
  assert.deepEqual(gameTest.drainSfx().flat(), ["place", "win"]);

  gameTest.useGame("xiangqi");
  gameTest.patch("xiangqi", (state) => {
    state.mode = "ai";
    state.turn = "black";
    state.winner = null;
    state.selected = null;
    state.pieces = [
      { id: "wg", side: "white", kind: "G", row: 8, col: 4 },
      { id: "bg", side: "black", kind: "G", row: 0, col: 3 },
      { id: "br", side: "black", kind: "R", row: 8, col: 0 },
    ];
  });
  gameTest.drainSfx();
  gameTest.playScript((state) => {
    const rook = state.pieces.find((piece: { id: string }) => piece.id === "br");
    assert.equal(gameTest.xiangqiApplyMove(state, rook, 8, 4), true);
  });
  assert.deepEqual(gameTest.drainSfx().flat(), ["place", "lose"]);
});
