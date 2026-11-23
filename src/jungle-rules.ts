export type Side = "black" | "white";

export type JungleAnimal =
  | "elephant"
  | "lion"
  | "tiger"
  | "leopard"
  | "wolf"
  | "dog"
  | "cat"
  | "rat";

export type JunglePiece = {
  id: string;
  side: Side;
  animal: JungleAnimal;
  row: number;
  col: number;
};

export type JungleMove = { id: string; row: number; col: number };

export const JUNGLE_ROWS = 9;
export const JUNGLE_COLS = 7;

export const JUNGLE_RANK: Record<JungleAnimal, number> = {
  elephant: 8,
  lion: 7,
  tiger: 6,
  leopard: 5,
  wolf: 4,
  dog: 3,
  cat: 2,
  rat: 1,
};

export const JUNGLE_LABEL: Record<JungleAnimal, string> = {
  elephant: "象",
  lion: "狮",
  tiger: "虎",
  leopard: "豹",
  wolf: "狼",
  dog: "狗",
  cat: "猫",
  rat: "鼠",
};

/** Rows 3-5 between the two banks, split into a left and a right river. */
export function jungleIsRiver(row: number, col: number): boolean {
  return row >= 3 && row <= 5 && (col === 1 || col === 2 || col === 4 || col === 5);
}

export function jungleDen(side: Side): { row: number; col: number } {
  return side === "black" ? { row: 0, col: 3 } : { row: 8, col: 3 };
}

/** The three traps that guard a den belong to the side that owns the den. */
const JUNGLE_TRAPS: Array<{ side: Side; row: number; col: number }> = [
  { side: "black", row: 0, col: 2 },
  { side: "black", row: 0, col: 4 },
  { side: "black", row: 1, col: 3 },
  { side: "white", row: 8, col: 2 },
  { side: "white", row: 8, col: 4 },
  { side: "white", row: 7, col: 3 },
];

export function jungleTrapOwner(row: number, col: number): Side | null {
  const trap = JUNGLE_TRAPS.find((item) => item.row === row && item.col === col);
  return trap ? trap.side : null;
}

export function createJunglePieces(): JunglePiece[] {
  const layout: Array<[JungleAnimal, number, number]> = [
    ["lion", 0, 0],
    ["tiger", 0, 6],
    ["dog", 1, 1],
    ["cat", 1, 5],
    ["rat", 2, 0],
    ["leopard", 2, 2],
    ["wolf", 2, 4],
    ["elephant", 2, 6],
  ];
  const pieces: JunglePiece[] = [];
  for (const [animal, row, col] of layout) {
    pieces.push({ id: `black-${animal}`, side: "black", animal, row, col });
    // White mirrors black through the centre, exactly like the printed board.
    pieces.push({ id: `white-${animal}`, side: "white", animal, row: JUNGLE_ROWS - 1 - row, col: JUNGLE_COLS - 1 - col });
  }
  return pieces;
}

export function junglePieceAt(
  pieces: JunglePiece[],
  row: number,
  col: number,
): JunglePiece | null {
  return pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
}

function jungleRankOnSquare(piece: JunglePiece, row: number, col: number): number {
  const owner = jungleTrapOwner(row, col);
  if (owner && owner !== piece.side) return 0;
  return JUNGLE_RANK[piece.animal];
}

export function jungleCanCapture(
  attacker: JunglePiece,
  defender: JunglePiece,
  row: number,
  col: number,
): boolean {
  const defenderInWater = jungleIsRiver(row, col);
  const attackerInWater = jungleIsRiver(attacker.row, attacker.col);
  // A rat in the water is safe from the bank and cannot attack the bank.
  if (defender.animal === "rat" && defenderInWater && !attackerInWater) return false;
  if (attacker.animal === "rat" && attackerInWater && !defenderInWater) return false;

  const attackRank = jungleRankOnSquare(attacker, attacker.row, attacker.col);
  const defendRank = jungleRankOnSquare(defender, row, col);
  if (defendRank === 0) return true;
  if (attacker.animal === "elephant" && defender.animal === "rat") return false;
  if (attacker.animal === "rat" && defender.animal === "elephant") return true;
  if (attackRank === 0) return false;
  return attackRank >= defendRank;
}

function canStandOn(piece: JunglePiece, row: number, col: number, pieces: JunglePiece[]): boolean {
  const den = jungleDen(piece.side);
  if (den.row === row && den.col === col) return false; // never walk into your own den
  if (jungleIsRiver(row, col) && piece.animal !== "rat") return false;
  const target = junglePieceAt(pieces, row, col);
  if (!target) return true;
  if (target.side === piece.side) return false;
  return jungleCanCapture(piece, target, row, col);
}

/** Vertical jumps cross three water rows, horizontal jumps cross two water files. */
function jungleJumpTargets(piece: JunglePiece, pieces: JunglePiece[]): Array<{ row: number; col: number }> {
  if (piece.animal !== "lion" && piece.animal !== "tiger") return [];
  const targets: Array<{ row: number; col: number }> = [];
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: 0 },
    { dr: -1, dc: 0 },
  ];
  for (const { dr, dc } of directions) {
    let row = piece.row + dr;
    let col = piece.col + dc;
    let water = 0;
    let blocked = false;
    while (row >= 0 && row < JUNGLE_ROWS && col >= 0 && col < JUNGLE_COLS && jungleIsRiver(row, col)) {
      const occupant = junglePieceAt(pieces, row, col);
      if (occupant) {
        // Only a rat can sit in water; any rat in the path cancels the jump.
        blocked = true;
        break;
      }
      water += 1;
      row += dr;
      col += dc;
    }
    if (blocked || water === 0) continue;
    if (row < 0 || row >= JUNGLE_ROWS || col < 0 || col >= JUNGLE_COLS) continue;
    const landing = junglePieceAt(pieces, row, col);
    if (landing && landing.side === piece.side) continue;
    if (landing && !jungleCanCapture(piece, landing, row, col)) continue;
    targets.push({ row, col });
  }
  return targets;
}

export function jungleLegalMoves(pieces: JunglePiece[], side: Side): JungleMove[] {
  const moves: JungleMove[] = [];
  for (const piece of pieces) {
    if (piece.side !== side) continue;
    const steps = [
      { row: piece.row - 1, col: piece.col },
      { row: piece.row + 1, col: piece.col },
      { row: piece.row, col: piece.col - 1 },
      { row: piece.row, col: piece.col + 1 },
    ];
    for (const step of steps) {
      if (step.row < 0 || step.row >= JUNGLE_ROWS || step.col < 0 || step.col >= JUNGLE_COLS) continue;
      if (!canStandOn(piece, step.row, step.col, pieces)) continue;
      moves.push({ id: piece.id, row: step.row, col: step.col });
    }
    for (const jump of jungleJumpTargets(piece, pieces)) {
      moves.push({ id: piece.id, row: jump.row, col: jump.col });
    }
  }
  return moves;
}

export type JungleResult = {
  pieces: JunglePiece[];
  captured: JunglePiece | null;
  winner: Side | null;
  reason: string;
};

export function jungleApply(pieces: JunglePiece[], move: JungleMove): JungleResult {
  const moving = pieces.find((piece) => piece.id === move.id);
  if (!moving) return { pieces, captured: null, winner: null, reason: "" };
  const target = junglePieceAt(pieces, move.row, move.col);
  const next = pieces
    .filter((piece) => piece.id !== moving.id && piece.id !== target?.id)
    .concat({ ...moving, row: move.row, col: move.col });
  const opponent: Side = moving.side === "black" ? "white" : "black";
  const enemyDen = jungleDen(opponent);
  if (move.row === enemyDen.row && move.col === enemyDen.col) {
    return { pieces: next, captured: target ?? null, winner: moving.side, reason: "入穴" };
  }
  if (!next.some((piece) => piece.side === opponent)) {
    return { pieces: next, captured: target ?? null, winner: moving.side, reason: "吃光" };
  }
  return { pieces: next, captured: target ?? null, winner: null, reason: "" };
}

export function jungleStatus(pieces: JunglePiece[], sideToMove: Side): {
  over: boolean;
  winner: Side | null;
  reason: string;
} {
  const opponent: Side = sideToMove === "black" ? "white" : "black";
  if (!pieces.some((piece) => piece.side === sideToMove)) {
    return { over: true, winner: opponent, reason: "吃光" };
  }
  if (jungleLegalMoves(pieces, sideToMove).length === 0) {
    return { over: true, winner: opponent, reason: "无路可走" };
  }
  return { over: false, winner: null, reason: "" };
}

function jungleScore(pieces: JunglePiece[], side: Side): number {
  const opponent: Side = side === "black" ? "white" : "black";
  const enemyDen = jungleDen(opponent);
  let score = 0;
  for (const piece of pieces) {
    const value = JUNGLE_RANK[piece.animal] ** 1.6;
    const distance = Math.abs(piece.row - enemyDen.row) + Math.abs(piece.col - enemyDen.col);
    const push = (8 - distance) * (piece.animal === "rat" ? 1.6 : 1);
    if (piece.side === side) score += value + push;
    else score -= value + push;
  }
  return score;
}

function jungleNegamax(
  pieces: JunglePiece[],
  side: Side,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const status = jungleStatus(pieces, side);
  if (status.over) return status.winner === side ? 90000 : -90000;
  if (depth === 0) return jungleScore(pieces, side);
  const moves = jungleLegalMoves(pieces, side);
  let best = -Infinity;
  for (const move of moves) {
    const result = jungleApply(pieces, move);
    const nextSide: Side = side === "black" ? "white" : "black";
    const score = result.winner === side ? 90000 : -jungleNegamax(result.pieces, nextSide, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function jungleChooseMove(pieces: JunglePiece[], side: Side, depth = 3): JungleMove | null {
  const moves = jungleLegalMoves(pieces, side);
  if (moves.length === 0) return null;
  let best: JungleMove | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const result = jungleApply(pieces, move);
    const nextSide: Side = side === "black" ? "white" : "black";
    const score =
      result.winner === side ? 90000 : -jungleNegamax(result.pieces, nextSide, depth - 1, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
