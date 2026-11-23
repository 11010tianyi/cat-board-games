export type Side = "black" | "white";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type ChessPiece = { type: PieceType; side: Side };

export type ChessState = {
  /** 64 squares, index 0 = a8, index 63 = h1. */
  board: Array<ChessPiece | null>;
  turn: Side;
  castling: { black: { k: boolean; q: boolean }; white: { k: boolean; q: boolean } };
  /** En-passant target square (where the capturing pawn lands), or null. */
  ep: number | null;
  halfmove: number;
  fullmove: number;
};

export type ChessMove = {
  from: number;
  to: number;
  promotion?: PieceType;
  castle?: "k" | "q";
  double?: boolean;
  enPassant?: boolean;
  captured?: PieceType;
};

export const CHESS_SIZE = 8;
export const CHESS_START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const CHESS_GLYPH: Record<PieceType, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

export const CHESS_NAME: Record<PieceType, string> = {
  k: "王",
  q: "后",
  r: "车",
  b: "象",
  n: "马",
  p: "兵",
};

const KNIGHT_DELTAS: Array<[number, number]> = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const BISHOP_DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const ROOK_DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const KING_DIRS: Array<[number, number]> = [...BISHOP_DIRS, ...ROOK_DIRS];

export function otherSide(side: Side): Side {
  return side === "black" ? "white" : "black";
}

export function chessSquareName(index: number): string {
  const file = "abcdefgh"[index & 7];
  const rank = 8 - (index >> 3);
  return `${file}${rank}`;
}

export function chessSquareFromName(name: string): number {
  const file = "abcdefgh".indexOf(name[0]);
  const rank = Number(name[1]);
  if (file < 0 || !rank) return -1;
  return (8 - rank) * 8 + file;
}

export function createChessState(): ChessState {
  return chessFromFen(CHESS_START);
}

export function chessFromFen(fen: string): ChessState {
  const [placement, turn, castle, ep, halfmove, fullmove] = fen.trim().split(/\s+/);
  const board: Array<ChessPiece | null> = Array(64).fill(null);
  let index = 0;
  for (const char of placement) {
    if (char === "/") continue;
    if (/\d/.test(char)) {
      index += Number(char);
      continue;
    }
    const side: Side = char === char.toUpperCase() ? "white" : "black";
    board[index] = { type: char.toLowerCase() as PieceType, side };
    index += 1;
  }
  return {
    board,
    turn: (turn === "b" ? "black" : "white") as Side,
    castling: {
      white: { k: castle.includes("K"), q: castle.includes("Q") },
      black: { k: castle.includes("k"), q: castle.includes("q") },
    },
    ep: ep === "-" ? null : chessSquareFromName(ep),
    halfmove: Number(halfmove ?? 0),
    fullmove: Number(fullmove ?? 1),
  };
}

function pieceAt(state: ChessState, index: number): ChessPiece | null {
  return state.board[index] ?? null;
}

function onBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isAttackedByPawn(board: Array<ChessPiece | null>, target: number, bySide: Side): boolean {
  const row = target >> 3;
  const col = target & 7;
  // A white pawn attacks upward, so it must sit one row below the target.
  const sourceRow = bySide === "white" ? row + 1 : row - 1;
  for (const dc of [-1, 1]) {
    const sourceCol = col + dc;
    if (!onBoard(sourceRow, sourceCol)) continue;
    const piece = board[sourceRow * 8 + sourceCol];
    if (piece && piece.side === bySide && piece.type === "p") return true;
  }
  return false;
}

export function chessAttacked(state: ChessState, target: number, bySide: Side): boolean {
  if (isAttackedByPawn(state.board, target, bySide)) return true;
  const row = target >> 3;
  const col = target & 7;
  for (const [dr, dc] of KNIGHT_DELTAS) {
    if (!onBoard(row + dr, col + dc)) continue;
    const piece = state.board[(row + dr) * 8 + col + dc];
    if (piece && piece.side === bySide && piece.type === "n") return true;
  }
  for (const [dr, dc] of KING_DIRS) {
    if (!onBoard(row + dr, col + dc)) continue;
    const piece = state.board[(row + dr) * 8 + col + dc];
    if (piece && piece.side === bySide && piece.type === "k") return true;
  }
  for (const [dr, dc] of BISHOP_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (onBoard(r, c)) {
      const piece = state.board[r * 8 + c];
      if (piece) {
        if (piece.side === bySide && (piece.type === "b" || piece.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (const [dr, dc] of ROOK_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (onBoard(r, c)) {
      const piece = state.board[r * 8 + c];
      if (piece) {
        if (piece.side === bySide && (piece.type === "r" || piece.type === "q")) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

export function chessInCheck(state: ChessState, side: Side): boolean {
  const king = state.board.findIndex((piece) => piece?.type === "k" && piece.side === side);
  if (king < 0) return false;
  return chessAttacked(state, king, otherSide(side));
}

function pushPawnMoves(state: ChessState, from: number, side: Side, moves: ChessMove[]) {
  const row = from >> 3;
  const col = from & 7;
  const dir = side === "white" ? -1 : 1;
  const startRow = side === "white" ? 6 : 1;
  const promotionRow = side === "white" ? 0 : 7;
  const oneRow = row + dir;
  if (!onBoard(oneRow, col)) return;
  const one = oneRow * 8 + col;
  if (!pieceAt(state, one)) {
    if (oneRow === promotionRow) {
      for (const promotion of ["q", "r", "b", "n"] as PieceType[]) {
        moves.push({ from, to: one, promotion });
      }
    } else {
      moves.push({ from, to: one });
      const twoRow = row + dir * 2;
      if (row === startRow && !pieceAt(state, twoRow * 8 + col)) {
        moves.push({ from, to: twoRow * 8 + col, double: true });
      }
    }
  }
  for (const dc of [-1, 1]) {
    const targetCol = col + dc;
    if (!onBoard(oneRow, targetCol)) continue;
    const to = oneRow * 8 + targetCol;
    const target = pieceAt(state, to);
    if (target && target.side !== side) {
      if (oneRow === promotionRow) {
        for (const promotion of ["q", "r", "b", "n"] as PieceType[]) {
          moves.push({ from, to, promotion, captured: target.type });
        }
      } else {
        moves.push({ from, to, captured: target.type });
      }
    } else if (!target && state.ep === to) {
      moves.push({ from, to, enPassant: true, captured: "p" });
    }
  }
}

function pushSliding(
  state: ChessState,
  from: number,
  side: Side,
  dirs: Array<[number, number]>,
  moves: ChessMove[],
) {
  const row = from >> 3;
  const col = from & 7;
  for (const [dr, dc] of dirs) {
    let r = row + dr;
    let c = col + dc;
    while (onBoard(r, c)) {
      const to = r * 8 + c;
      const target = state.board[to];
      if (!target) {
        moves.push({ from, to });
      } else {
        if (target.side !== side) {
          moves.push({ from, to, captured: target.type });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

function pushCastles(state: ChessState, side: Side, moves: ChessMove[]) {
  const enemy = otherSide(side);
  const row = side === "white" ? 7 : 0;
  const king = row * 8 + 4;
  const rights = state.castling[side];
  if (pieceAt(state, king)?.type !== "k" || pieceAt(state, king)?.side !== side) return;
  if (chessAttacked(state, king, enemy)) return;
  if (rights.k) {
    const f = row * 8 + 5;
    const g = row * 8 + 6;
    const rook = row * 8 + 7;
    if (
      !pieceAt(state, f) &&
      !pieceAt(state, g) &&
      pieceAt(state, rook)?.type === "r" &&
      pieceAt(state, rook)?.side === side &&
      !chessAttacked(state, f, enemy) &&
      !chessAttacked(state, g, enemy)
    ) {
      moves.push({ from: king, to: g, castle: "k" });
    }
  }
  if (rights.q) {
    const d = row * 8 + 3;
    const c = row * 8 + 2;
    const b = row * 8 + 1;
    const rook = row * 8;
    if (
      !pieceAt(state, d) &&
      !pieceAt(state, c) &&
      !pieceAt(state, b) &&
      pieceAt(state, rook)?.type === "r" &&
      pieceAt(state, rook)?.side === side &&
      !chessAttacked(state, d, enemy) &&
      !chessAttacked(state, c, enemy)
    ) {
      moves.push({ from: king, to: c, castle: "q" });
    }
  }
}

export function chessPseudoMoves(state: ChessState): ChessMove[] {
  const side = state.turn;
  const moves: ChessMove[] = [];
  for (let from = 0; from < 64; from += 1) {
    const piece = state.board[from];
    if (!piece || piece.side !== side) continue;
    const row = from >> 3;
    const col = from & 7;
    switch (piece.type) {
      case "p":
        pushPawnMoves(state, from, side, moves);
        break;
      case "n":
        for (const [dr, dc] of KNIGHT_DELTAS) {
          const r = row + dr;
          const c = col + dc;
          if (!onBoard(r, c)) continue;
          const to = r * 8 + c;
          const target = state.board[to];
          if (target?.side === side) continue;
          moves.push({ from, to, captured: target?.type });
        }
        break;
      case "b":
        pushSliding(state, from, side, BISHOP_DIRS, moves);
        break;
      case "r":
        pushSliding(state, from, side, ROOK_DIRS, moves);
        break;
      case "q":
        pushSliding(state, from, side, KING_DIRS, moves);
        break;
      case "k":
        for (const [dr, dc] of KING_DIRS) {
          const r = row + dr;
          const c = col + dc;
          if (!onBoard(r, c)) continue;
          const to = r * 8 + c;
          const target = state.board[to];
          if (target?.side === side) continue;
          moves.push({ from, to, captured: target?.type });
        }
        pushCastles(state, side, moves);
        break;
      default:
        break;
    }
  }
  return moves;
}

function sameRights(a: ChessState["castling"], b: ChessState["castling"]): boolean {
  return (
    a.white.k === b.white.k &&
    a.white.q === b.white.q &&
    a.black.k === b.black.k &&
    a.black.q === b.black.q
  );
}

export function chessApply(state: ChessState, move: ChessMove): ChessState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state;
  const castling = {
    white: { ...state.castling.white },
    black: { ...state.castling.black },
  };
  const side = piece.side;
  // Derive the special cases from the board instead of trusting caller flags, so a
  // bare {from,to} from the UI still castles, captures en passant and promotes.
  const isDouble = piece.type === "p" && Math.abs(move.to - move.from) === 16;
  const isEnPassant = piece.type === "p" && (move.to & 7) !== (move.from & 7) && !board[move.to];
  const fileDelta = (move.to & 7) - (move.from & 7);
  const isCastle = piece.type === "k" && Math.abs(fileDelta) === 2;
  const captured: PieceType | undefined = isEnPassant ? "p" : board[move.to]?.type;
  board[move.from] = null;
  board[move.to] = move.promotion ? { type: move.promotion, side } : piece;

  if (isEnPassant) {
    const capturedSquare = move.to + (side === "white" ? 8 : -8);
    board[capturedSquare] = null;
  }
  if (isCastle) {
    const row = side === "white" ? 7 : 0;
    if (fileDelta > 0) {
      board[row * 8 + 5] = board[row * 8 + 7];
      board[row * 8 + 7] = null;
    } else {
      board[row * 8 + 3] = board[row * 8];
      board[row * 8] = null;
    }
  }
  if (piece.type === "k") {
    castling[side].k = false;
    castling[side].q = false;
  }
  if (piece.type === "r") {
    const row = side === "white" ? 7 : 0;
    if (move.from === row * 8) castling[side].q = false;
    if (move.from === row * 8 + 7) castling[side].k = false;
  }
  // A rook captured on its home square also loses the right.
  if (captured === "r") {
    const enemy = otherSide(side);
    const row = enemy === "white" ? 7 : 0;
    if (move.to === row * 8) castling[enemy].q = false;
    if (move.to === row * 8 + 7) castling[enemy].k = false;
  }

  const ep = isDouble ? (move.from + move.to) / 2 : null;
  const resetsClock = piece.type === "p" || Boolean(captured);
  const next: ChessState = {
    board,
    turn: otherSide(side),
    castling: sameRights(castling, state.castling) ? state.castling : castling,
    ep,
    halfmove: resetsClock ? 0 : state.halfmove + 1,
    fullmove: side === "black" ? state.fullmove + 1 : state.fullmove,
  };
  return next;
}

export function chessLegalMoves(state: ChessState): ChessMove[] {
  const side = state.turn;
  const legal: ChessMove[] = [];
  for (const move of chessPseudoMoves(state)) {
    const next = chessApply(state, move);
    const king = next.board.findIndex((piece) => piece?.type === "k" && piece.side === side);
    if (king < 0) continue;
    if (chessAttacked(next, king, otherSide(side))) continue;
    legal.push(move);
  }
  return legal;
}

export type ChessStatus = {
  over: boolean;
  winner: Side | null;
  reason: string;
};

export function chessStatus(state: ChessState): ChessStatus {
  const moves = chessLegalMoves(state);
  if (moves.length === 0) {
    if (chessInCheck(state, state.turn)) {
      return { over: true, winner: otherSide(state.turn), reason: "将杀" };
    }
    return { over: true, winner: null, reason: "困毙，和棋" };
  }
  if (state.halfmove >= 100) return { over: true, winner: null, reason: "五十回合和棋" };
  const material =
    state.board.filter((piece) => piece && piece.type !== "k").length;
  if (material === 0) return { over: true, winner: null, reason: "无子可杀，和棋" };
  return { over: false, winner: null, reason: "" };
}

/** Node count for the standard perft checks; used by the test suite. */
export function chessPerft(state: ChessState, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of chessLegalMoves(state)) {
    nodes += chessPerft(chessApply(state, move), depth - 1);
  }
  return nodes;
}

const PIECE_VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Simplified evaluation tables, listed from a8 to h1 for white.
const PST: Record<PieceType, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25,
    10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0,
    0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20,
    0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5,
    5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0,
    0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5,
    5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20,
    -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50,
    -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20,
    -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

function chessEvaluate(state: ChessState, side: Side): number {
  let score = 0;
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece) continue;
    const table = PST[piece.type];
    const value = PIECE_VALUE[piece.type] + table[piece.side === "white" ? index : index ^ 56];
    score += piece.side === side ? value : -value;
  }
  return score;
}

function moveOrderScore(move: ChessMove): number {
  let score = 0;
  if (move.captured) score += 1000 + PIECE_VALUE[move.captured] * 10 - PIECE_VALUE.p;
  if (move.promotion) score += 900;
  if (move.castle) score += 120;
  return score;
}

function alphaBeta(
  state: ChessState,
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const status = chessStatus(state);
  if (status.over) {
    if (status.winner === side) return 100000 + depth;
    if (status.winner === otherSide(side)) return -100000 - depth;
    return 0;
  }
  if (depth === 0) return chessEvaluate(state, side);
  const moves = chessLegalMoves(state).sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
  let best = -Infinity;
  for (const move of moves) {
    const score = -alphaBeta(chessApply(state, move), otherSide(side), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best move for the side to move; depth 3 is a good speed/strength trade-off on phones. */
export function chessChooseMove(state: ChessState, depth = 3): ChessMove | null {
  const side = state.turn;
  const moves = chessLegalMoves(state).sort((a, b) => moveOrderScore(b) - moveOrderScore(a));
  if (moves.length === 0) return null;
  let best: ChessMove | null = null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const move of moves) {
    const score = -alphaBeta(chessApply(state, move), otherSide(side), depth - 1, -Infinity, -alpha);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }
  return best;
}
