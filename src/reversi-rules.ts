export type Side = "black" | "white";
export type ReversiCell = Side | null;

export const REVERSI_SIZE = 8;

/** The eight flip directions, clockwise from the top-left corner. */
export const REVERSI_DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function otherSide(side: Side): Side {
  return side === "black" ? "white" : "black";
}

/** Opening position: white sits on d4/e5, black on e4/d5. Black moves first. */
export function createReversiBoard(): ReversiCell[] {
  const board: ReversiCell[] = Array(REVERSI_SIZE * REVERSI_SIZE).fill(null);
  board[3 * 8 + 3] = "white";
  board[3 * 8 + 4] = "black";
  board[4 * 8 + 3] = "black";
  board[4 * 8 + 4] = "white";
  return board;
}

/** Every disc that flips if `side` drops on `index`; empty means the move is illegal. */
export function reversiFlips(board: ReversiCell[], index: number, side: Side): number[] {
  if (index < 0 || index >= board.length || board[index]) return [];
  const row = Math.floor(index / REVERSI_SIZE);
  const col = index % REVERSI_SIZE;
  const enemy = otherSide(side);
  const flips: number[] = [];
  for (const [dr, dc] of REVERSI_DIRS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 &&
      r < REVERSI_SIZE &&
      c >= 0 &&
      c < REVERSI_SIZE &&
      board[r * REVERSI_SIZE + c] === enemy
    ) {
      line.push(r * REVERSI_SIZE + c);
      r += dr;
      c += dc;
    }
    if (
      line.length > 0 &&
      r >= 0 &&
      r < REVERSI_SIZE &&
      c >= 0 &&
      c < REVERSI_SIZE &&
      board[r * REVERSI_SIZE + c] === side
    ) {
      flips.push(...line);
    }
  }
  return flips;
}

export function reversiLegalMoves(board: ReversiCell[], side: Side): number[] {
  const moves: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (!board[index] && reversiFlips(board, index, side).length > 0) moves.push(index);
  }
  return moves;
}

/** Returns the board after the move, or null when the move is illegal. */
export function reversiApply(
  board: ReversiCell[],
  index: number,
  side: Side,
): { board: ReversiCell[]; flips: number[] } | null {
  const flips = reversiFlips(board, index, side);
  if (flips.length === 0) return null;
  const next = board.slice();
  next[index] = side;
  for (const flipped of flips) next[flipped] = side;
  return { board: next, flips };
}

export function reversiScore(board: ReversiCell[]): Record<Side, number> {
  const score: Record<Side, number> = { black: 0, white: 0 };
  for (const cell of board) if (cell) score[cell] += 1;
  return score;
}

export function reversiFinished(board: ReversiCell[]): boolean {
  return (
    reversiLegalMoves(board, "black").length === 0 &&
    reversiLegalMoves(board, "white").length === 0
  );
}

const CORNERS = [0, 7, 56, 63] as const;

function cornerCount(board: ReversiCell[], side: Side): number {
  let count = 0;
  for (const corner of CORNERS) if (board[corner] === side) count += 1;
  return count;
}

function reversiEvaluate(board: ReversiCell[], side: Side): number {
  const enemy = otherSide(side);
  const discs = reversiScore(board);
  const mine = discs[side] - discs[enemy];
  const corners = cornerCount(board, side) - cornerCount(board, enemy);
  const mobility =
    reversiLegalMoves(board, side).length - reversiLegalMoves(board, enemy).length;
  return mine * 2 + corners * 26 + mobility * 9;
}

function negamax(
  board: ReversiCell[],
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = reversiLegalMoves(board, side);
  if (moves.length === 0) {
    const enemyMoves = reversiLegalMoves(board, otherSide(side));
    if (enemyMoves.length === 0) {
      // Terminal: a wipe-out is worth far more than a normal disc lead.
      const score = reversiScore(board);
      const diff = score[side] - score[otherSide(side)];
      return diff > 0 ? 100000 + diff : diff < 0 ? -100000 + diff : 0;
    }
    // No legal move: pass the turn without spending depth.
    return -negamax(board, otherSide(side), depth, -beta, -alpha);
  }
  if (depth === 0) return reversiEvaluate(board, side);

  let best = -Infinity;
  // Corners first and only minimal re-ordering work: 64 squares keep the tree small.
  moves.sort((a, b) => {
    const aCorner = CORNERS.includes(a as (typeof CORNERS)[number]) ? 1 : 0;
    const bCorner = CORNERS.includes(b as (typeof CORNERS)[number]) ? 1 : 0;
    return bCorner - aCorner;
  });
  for (const move of moves) {
    const applied = reversiApply(board, move, side);
    if (!applied) continue;
    const score = -negamax(applied.board, otherSide(side), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Best square for `side`, or null when the side must pass. */
export function reversiChooseMove(
  board: ReversiCell[],
  side: Side,
  depth = 4,
): number | null {
  const moves = reversiLegalMoves(board, side);
  if (moves.length === 0) return null;
  let best: number | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const applied = reversiApply(board, move, side);
    if (!applied) continue;
    const score = -negamax(applied.board, otherSide(side), depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
