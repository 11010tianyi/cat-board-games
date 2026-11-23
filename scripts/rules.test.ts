import assert from "node:assert/strict";
import test from "node:test";
import {
  chessApply,
  chessChooseMove,
  chessFromFen,
  chessLegalMoves,
  chessPerft,
  chessSquareFromName,
  chessStatus,
  createChessState,
} from "../src/chess-rules.ts";
import {
  createReversiBoard,
  reversiApply,
  reversiChooseMove,
  reversiFinished,
  reversiFlips,
  reversiLegalMoves,
  reversiScore,
} from "../src/reversi-rules.ts";
import {
  createJunglePieces,
  jungleApply,
  jungleCanCapture,
  jungleChooseMove,
  jungleLegalMoves,
  junglePieceAt,
  jungleStatus,
  type JungleAnimal,
  type JunglePiece,
} from "../src/jungle-rules.ts";

test("chess move generation matches the published perft counts", () => {
  const start = createChessState();
  assert.equal(chessPerft(start, 1), 20);
  assert.equal(chessPerft(start, 2), 400);
  assert.equal(chessPerft(start, 3), 8902);
  // Kiwipete exercises castling, en passant, pins and promotions.
  const kiwipete = chessFromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  assert.equal(chessPerft(kiwipete, 1), 48);
  assert.equal(chessPerft(kiwipete, 2), 2039);
});

test("chess castles, captures en passant and promotes", () => {
  // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O
  const moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "e1g1"];
  let state = createChessState();
  for (const notation of moves) {
    const from = chessSquareFromName(notation.slice(0, 2));
    const to = chessSquareFromName(notation.slice(2, 4));
    // Always apply the full generated move: castling carries the rook along.
    const legal = chessLegalMoves(state).find((move) => move.from === from && move.to === to);
    assert.ok(legal, `missing legal move ${notation}`);
    state = chessApply(state, legal);
  }
  assert.equal(state.board[chessSquareFromName("g1")]?.type, "k");
  assert.equal(state.board[chessSquareFromName("f1")]?.type, "r");
  assert.equal(state.castling.white.k, false);

  // En passant: 1.e4 a6 2.e5 d5 3.exd6
  state = createChessState();
  for (const notation of ["e2e4", "a7a6", "e4e5", "d7d5"]) {
    state = chessApply(state, {
      from: chessSquareFromName(notation.slice(0, 2)),
      to: chessSquareFromName(notation.slice(2, 4)),
    });
  }
  const epMove = chessLegalMoves(state).find(
    (move) => move.from === chessSquareFromName("e5") && move.to === chessSquareFromName("d6"),
  );
  assert.ok(epMove, "en passant capture must be generated");
  assert.equal(epMove.enPassant, true);
  state = chessApply(state, epMove);
  assert.equal(state.board[chessSquareFromName("d6")]?.type, "p");
  assert.equal(state.board[chessSquareFromName("d5")], null);

  // Promotion: white pawn on b7 promotes into a queen.
  const promo = chessFromFen("8/1P6/8/8/8/8/8/K6k w - - 0 1");
  const promote = chessLegalMoves(promo).filter((move) => move.promotion);
  assert.equal(promote.length, 4);
  const queened = chessApply(promo, promote.find((move) => move.promotion === "q")!);
  assert.equal(queened.board[chessSquareFromName("b8")]?.type, "q");
});

test("chess reports checkmate and stalemate", () => {
  const mate = chessFromFen("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
  const mateStatus = chessStatus(mate);
  assert.equal(mateStatus.over, true);
  assert.equal(mateStatus.winner, "black");
  assert.equal(mateStatus.reason, "将杀");

  const stale = chessFromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  const staleStatus = chessStatus(stale);
  assert.equal(staleStatus.over, true);
  assert.equal(staleStatus.winner, null);
  assert.match(staleStatus.reason, /和棋/);
});

test("chess AI answers immediately and only returns legal moves", () => {
  const state = createChessState();
  const move = chessChooseMove(state, 2);
  assert.ok(move);
  assert.ok(
    chessLegalMoves(state).some(
      (legal) => legal.from === move.from && legal.to === move.to && legal.promotion === move.promotion,
    ),
  );
});

test("reversi opens with four flips and never allows an illegal drop", () => {
  const board = createReversiBoard();
  assert.deepEqual(reversiLegalMoves(board, "black"), [19, 26, 37, 44]);
  assert.deepEqual(reversiFlips(board, 19, "black"), [27]);
  assert.deepEqual(reversiFlips(board, 19, "white"), []);
  assert.equal(reversiApply(board, 0, "black"), null);

  const applied = reversiApply(board, 19, "black");
  assert.ok(applied);
  assert.equal(applied.board[19], "black");
  assert.equal(applied.board[27], "black");
  assert.deepEqual(reversiScore(applied.board), { black: 4, white: 1 });
});

test("reversi passes when a side has no moves and finishes on a full board", () => {
  // Black has no legal move here: white owns the only two open lines.
  const board = createReversiBoard();
  const black = reversiLegalMoves(board, "black");
  assert.ok(black.length > 0);
  const full = Array(64).fill("black");
  assert.equal(reversiFinished(full), true);
  assert.equal(reversiLegalMoves(full, "white").length, 0);
});

test("reversi AI returns a legal move or null, and a random side can play out", () => {
  let board = createReversiBoard();
  let side: "black" | "white" = "black";
  for (let ply = 0; ply < 12; ply += 1) {
    const move = reversiChooseMove(board, side, 3);
    if (move === null) {
      side = side === "black" ? "white" : "black";
      continue;
    }
    assert.ok(reversiFlips(board, move, side).length > 0);
    board = reversiApply(board, move, side)!.board;
    side = side === "black" ? "white" : "black";
  }
  const score = reversiScore(board);
  assert.equal(score.black + score.white, 4 + 12);
});

function junglePiece(side: "black" | "white", animal: JungleAnimal, row: number, col: number): JunglePiece {
  return { id: `${side}-${animal}-${row}-${col}`, side, animal, row, col };
}

test("jungle starts mirrored with 24 moves a side", () => {
  const pieces = createJunglePieces();
  assert.equal(pieces.length, 16);
  assert.equal(jungleLegalMoves(pieces, "black").length, 24);
  assert.equal(jungleLegalMoves(pieces, "white").length, 24);
  assert.equal(junglePieceAt(pieces, 0, 0)?.animal, "lion");
  assert.equal(junglePieceAt(pieces, 8, 6)?.animal, "lion");
});

test("jungle water rules: only the rat swims, and land pieces cannot touch it", () => {
  const rat = junglePiece("black", "rat", 2, 4);
  const elephant = junglePiece("black", "elephant", 2, 1);
  const pieces = [rat, elephant];
  const ratMoves = jungleLegalMoves(pieces, "black").filter((move) => move.id === rat.id);
  assert.ok(ratMoves.some((move) => move.row === 3 && move.col === 4), "rat must enter the water");
  const elephantMoves = jungleLegalMoves(pieces, "black").filter((move) => move.id === elephant.id);
  assert.ok(!elephantMoves.some((move) => move.row === 3 && move.col === 1), "elephant must stay on land");

  // A rat in the water cannot be captured from the bank, and cannot capture the bank.
  const swimmer = junglePiece("black", "rat", 4, 1);
  const banker = junglePiece("white", "leopard", 4, 0);
  assert.equal(jungleCanCapture(banker, swimmer, 4, 1), false);
  assert.equal(jungleCanCapture(swimmer, banker, 4, 0), false);
});

test("jungle rank rules: rat beats elephant, elephant cannot eat rat", () => {
  const rat = junglePiece("black", "rat", 2, 1);
  const elephant = junglePiece("white", "elephant", 2, 2);
  assert.equal(jungleCanCapture(rat, elephant, 2, 2), true);
  assert.equal(jungleCanCapture(elephant, rat, 2, 1), false);
});

test("jungle lion and tiger jump the river unless a rat blocks the path", () => {
  const lion = junglePiece("black", "lion", 2, 1);
  const clear = [lion];
  const jumps = jungleLegalMoves(clear, "black").filter((move) => move.id === lion.id);
  assert.ok(jumps.some((move) => move.row === 6 && move.col === 1), "lion should jump the river");

  const blocker = junglePiece("white", "rat", 4, 1);
  const blocked = jungleLegalMoves([lion, blocker], "black").filter((move) => move.id === lion.id);
  assert.ok(!blocked.some((move) => move.row === 6 && move.col === 1), "a rat in the water blocks the jump");
});

test("jungle traps drop the defender to rank zero", () => {
  // (0,2) is part of black's trap ring, so a white piece there is defenceless.
  const trappedElephant = junglePiece("white", "elephant", 0, 2);
  const cat = junglePiece("black", "cat", 0, 1);
  assert.equal(jungleCanCapture(cat, trappedElephant, 0, 2), true);

  const safeElephant = junglePiece("black", "elephant", 0, 2);
  assert.equal(jungleCanCapture(cat, safeElephant, 0, 2), false);
});

test("jungle ends when a piece enters the enemy den or the enemy is wiped out", () => {
  const runner = junglePiece("black", "cat", 7, 3);
  const guard = junglePiece("white", "dog", 6, 0);
  const result = jungleApply([runner, guard], { id: runner.id, row: 8, col: 3 });
  assert.equal(result.winner, "black");
  assert.equal(result.reason, "入穴");

  const lone = junglePiece("white", "rat", 4, 4);
  const hunter = junglePiece("black", "lion", 4, 3);
  const wipe = jungleApply([hunter, lone], { id: hunter.id, row: 4, col: 4 });
  assert.equal(wipe.winner, "black");
  assert.equal(wipe.reason, "吃光");

  const status = jungleStatus(createJunglePieces(), "black");
  assert.equal(status.over, false);
});

test("jungle AI always returns a legal move", () => {
  const pieces = createJunglePieces();
  const move = jungleChooseMove(pieces, "black", 2);
  assert.ok(move);
  assert.ok(jungleLegalMoves(pieces, "black").some((legal) => legal.id === move.id && legal.row === move.row && legal.col === move.col));
});
