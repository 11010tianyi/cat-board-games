import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gameTest } from "../src/main.ts";

const gomokuSize = 15;
const goSize = 9;

function boardSnapshot(board: Array<string | null>) {
  return board.slice();
}

function putGomoku(state: ReturnType<typeof gameTest.createGomoku>, row: number, col: number, player: "black" | "white") {
  state.board[row * gomokuSize + col] = player;
  state.history.push({ row, col, player });
  state.moves += 1;
}

test("xiangqi AI develops pieces and does not step into check or flying generals", () => {
  const state = gameTest.createXiangqi();
  const kinds: string[] = [];
  for (let step = 0; step < 10; step += 1) {
    const whiteMoves = gameTest.xiangqiLegalMoves(state, "white").sort((a, b) => b.score - a.score);
    assert.ok(whiteMoves.length > 0, `white has no move before ply ${step}`);
    const whiteMove = whiteMoves[0];
    assert.equal(gameTest.xiangqiApplyMove(state, whiteMove.piece, whiteMove.row, whiteMove.col), true);
    assert.equal(gameTest.xiangqiGeneralsFace(state), false);
    assert.equal(gameTest.xiangqiInCheck(state, "white"), false);
    assert.equal(state.winner, null, `game ended on white ply ${step}: ${state.message}`);

    const before = state.pieces.map((piece) => ({ id: piece.id, kind: piece.kind, row: piece.row, col: piece.col }));
    gameTest.xiangqiAiTurn(state);
    const moved = state.pieces.find((piece) => {
      const previous = before.find((item) => item.id === piece.id);
      return previous && (previous.row !== piece.row || previous.col !== piece.col);
    });
    assert.ok(moved, `black made no move on ply ${step}: ${state.message}`);
    kinds.push(moved.kind);
    assert.equal(gameTest.xiangqiGeneralsFace(state), false);
    assert.equal(gameTest.xiangqiInCheck(state, "black"), false);
    assert.equal(state.winner, null, `game ended on black ply ${step}: ${state.message}`);
    assert.notEqual(moved.kind, "G", `black moved the general on ply ${step + 1}: ${kinds.join(",")}`);
  }
  assert.ok(
    kinds.some((kind) => kind === "R" || kind === "H" || kind === "C" || kind === "S"),
    `black only moved ${kinds.join(",")}`,
  );
  assert.ok(new Set(kinds.filter((kind) => kind === "R" || kind === "H" || kind === "C" || kind === "S")).size >= 2, kinds.join(","));
});

test("xiangqi rejects flying generals and moving into check", () => {
  const state = gameTest.createXiangqi();
  state.mode = "local";
  state.turn = "black";
  state.pieces = [
    { id: "bg", side: "black", kind: "G", row: 0, col: 4 },
    { id: "wg", side: "white", kind: "G", row: 9, col: 4 },
    { id: "br", side: "black", kind: "R", row: 1, col: 4 },
    { id: "ba", side: "black", kind: "A", row: 0, col: 3 },
  ];
  const rook = state.pieces[2];
  state.selected = rook.id;
  gameTest.xiangqiCell(state, 1, 0);
  assert.match(state.message, /照面/);
  assert.equal(rook.row, 1);
  assert.equal(rook.col, 4);
  assert.equal(gameTest.xiangqiLegal(state, rook, 2, 4), true);
  assert.equal(gameTest.xiangqiLegal(state, rook, 9, 4), true);

  const checked = gameTest.createXiangqi();
  checked.mode = "local";
  checked.turn = "black";
  checked.pieces = [
    { id: "bg", side: "black", kind: "G", row: 0, col: 4 },
    { id: "wg", side: "white", kind: "G", row: 9, col: 3 },
    { id: "wr", side: "white", kind: "R", row: 1, col: 8 },
    { id: "ba", side: "black", kind: "A", row: 2, col: 4 },
  ];
  const general = checked.pieces[0];
  assert.equal(gameTest.xiangqiInCheck(checked, "black"), false);
  assert.equal(gameTest.xiangqiLegal(checked, general, 1, 4), false);
  checked.selected = general.id;
  gameTest.xiangqiCell(checked, 1, 4);
  assert.match(checked.message, /送将/);
  assert.equal(general.row, 0);
  assert.equal(general.col, 4);

  checked.pieces = [
    { id: "bg", side: "black", kind: "G", row: 0, col: 4 },
    { id: "wg", side: "white", kind: "G", row: 9, col: 3 },
    { id: "wr", side: "white", kind: "R", row: 0, col: 8 },
    { id: "ba", side: "black", kind: "A", row: 1, col: 3 },
  ];
  const checkedGeneral = checked.pieces[0];
  const checkedAdvisor = checked.pieces[3];
  assert.equal(gameTest.xiangqiInCheck(checked, "black"), true);
  assert.equal(gameTest.xiangqiLegal(checked, checkedAdvisor, 0, 4), false);
  assert.equal(gameTest.xiangqiLegal(checked, checkedAdvisor, 2, 4), false);
  assert.equal(gameTest.xiangqiLegal(checked, checkedGeneral, 1, 4), true);
  assert.equal(gameTest.xiangqiApplyMove(checked, checkedGeneral, 1, 4), true);
  assert.equal(gameTest.xiangqiInCheck(checked, "black"), false);
});

test("gomoku AI takes its own five before blocking and restores the board", () => {
  const state = gameTest.createGomoku();
  for (let col = 0; col < 4; col += 1) putGomoku(state, 0, col, "black");
  for (let col = 0; col < 4; col += 1) putGomoku(state, 5, col, "white");
  const before = boardSnapshot(state.board);
  const move = gameTest.gomokuChooseAiMove(state);
  assert.deepEqual(move, { row: 5, col: 4 });
  assert.deepEqual(state.board, before);

  const crowded = gameTest.createGomoku();
  for (let index = 0; index < gomokuSize * gomokuSize; index += 1) {
    if (index === 14 * gomokuSize + 14) continue;
    crowded.board[index] = index % 2 === 0 ? "black" : "white";
  }
  crowded.history.push({ row: 0, col: 0, player: "black" });
  const center = crowded.board[7 * gomokuSize + 7];
  assert.ok(center);
  const crowdedBefore = boardSnapshot(crowded.board);
  const fallback = gameTest.gomokuChooseAiMove(crowded);
  assert.deepEqual(fallback, { row: 14, col: 14 });
  assert.equal(crowded.board[7 * gomokuSize + 7], center);
  assert.deepEqual(crowded.board, crowdedBefore);
});

test("go simple ko blocks an immediate recapture, and a draw is terminal", () => {
  const state = gameTest.createGo();
  state.mode = "local";
  const place = (row: number, col: number, player: "black" | "white") => {
    state.board[row * goSize + col] = player;
  };
  place(3, 3, "white");
  place(3, 4, "black");
  place(3, 5, "white");
  place(4, 3, "black");
  place(4, 4, "white");
  place(4, 6, "white");
  place(5, 3, "white");
  place(5, 4, "black");
  place(5, 5, "white");

  assert.equal(gameTest.goApplyMove(state, 4, 5, "black"), true);
  assert.deepEqual(state.ko, { row: 4, col: 4 });
  assert.equal(state.captures.black, 1);
  assert.equal(gameTest.goTryMove(state, 4, 4, "white"), null);
  const withoutKo = { ...state, ko: null, board: state.board.slice() };
  assert.ok(gameTest.goTryMove(withoutKo, 4, 4, "white"));

  state.turn = "white";
  gameTest.goPlace(state, 4, 4);
  assert.match(state.message, /劫/);
  assert.equal(state.board[4 * goSize + 4], null);

  assert.equal(gameTest.goApplyMove(state, 0, 0, "white"), true);
  assert.equal(state.ko, null);
  assert.equal(gameTest.goApplyMove(state, 8, 8, "black"), true);
  assert.equal(gameTest.goApplyMove(state, 4, 4, "white"), true);
  assert.equal(state.board[4 * goSize + 5], null);
  assert.equal(state.captures.white, 1);

  const draw = gameTest.createGo();
  draw.mode = "ai";
  draw.turn = "white";
  draw.passCount = 1;
  for (let index = 0; index < goSize * goSize; index += 1) draw.board[index] = index < 41 ? "black" : "white";
  draw.captures.white = 1;
  gameTest.goAiTurn(draw);
  assert.equal(draw.over, true);
  assert.equal(draw.winner, null);
  assert.match(draw.message, /平局/);
  assert.doesNotMatch(draw.message, /正在应手/);
  draw.board[0] = null;
  gameTest.goPlace(draw, 0, 0);
  assert.equal(draw.board[0], null);
  assert.match(draw.message, /平局/);
  assert.doesNotMatch(draw.message, /正在应手/);

  const localDraw = gameTest.createGo();
  localDraw.mode = "local";
  gameTest.goPass(localDraw);
  gameTest.goPass(localDraw);
  assert.equal(localDraw.over, true);
  assert.equal(localDraw.winner, null);
  assert.match(localDraw.message, /平局/);
  gameTest.goPlace(localDraw, 4, 4);
  assert.equal(localDraw.board[4 * goSize + 4], null);
  assert.match(localDraw.message, /平局/);
});

test("jump still moves a cat and gives the turn back", () => {
  const state = gameTest.createJump();
  const count = Object.keys(state.pieces).length;
  gameTest.jumpCell(state, 2, 2);
  gameTest.jumpCell(state, 3, 2);
  assert.equal(Object.keys(state.pieces).length, count);
  assert.equal(state.winner, null);
  assert.equal(state.turn, "black");
  assert.match(state.message, /黑猫/);
});

test("tycoon pays the start square once and scores property as assets", () => {
  const landed = gameTest.createTycoon();
  landed.players[0].position = 22;
  const random = Math.random;
  Math.random = () => 0;
  try {
    gameTest.tycoonRoll(landed);
  } finally {
    Math.random = random;
  }
  assert.equal(landed.players[0].position, 0);
  assert.equal(landed.players[0].money, 680);
  assert.match(landed.message, /80/);

  const passed = gameTest.createTycoon();
  passed.players[0].position = 23;
  Math.random = () => 0;
  try {
    gameTest.tycoonRoll(passed);
  } finally {
    Math.random = random;
  }
  assert.equal(passed.players[0].position, 1);
  assert.equal(passed.players[0].money, 680);

  const finish = gameTest.createTycoon();
  finish.turnNo = 50;
  finish.players[0].money = 50;
  finish.players[1].money = 100;
  finish.owners[1] = "black";
  assert.equal(gameTest.tycoonNetWorth(finish, "black"), 130);
  assert.equal(gameTest.tycoonNetWorth(finish, "white"), 100);
  gameTest.tycoonCheckWinner(finish);
  assert.equal(finish.winner, "black");
  assert.match(finish.message, /资产/);

  const broke = gameTest.createTycoon();
  broke.players[0].money = -1;
  gameTest.tycoonCheckWinner(broke);
  assert.equal(broke.winner, "white");
  assert.match(broke.message, /破产/);
});

test("pages base stays /cat-board-games/", () => {
  const vite = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(vite, /base:\s*"\/cat-board-games\/"/);
});
