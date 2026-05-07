import "./styles.css";

type Player = "black" | "white";
type CatStyle = "drawn" | "photo" | "family";
type GameId = "gomoku" | "go" | "xiangqi" | "jump" | "tycoon";
type PlayMode = "ai" | "local";
type Point = { row: number; col: number };

type Game<S> = {
  id: GameId;
  name: string;
  badge: string;
  create: () => S;
  render: (state: S) => string;
  controls: (state: S) => string;
  handleCell: (state: S, row: number, col: number) => void;
  handleAction: (state: S, action: string) => void;
  handleKey: (state: S, event: KeyboardEvent) => boolean;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root #app not found");
}

const appRoot = app;

const playerMeta: Record<Player, { name: string; title: string; eye: string }> = {
  black: {
    name: "黑猫",
    title: "黑色黄眼睛短毛田园猫",
    eye: "#ffd84d",
  },
  white: {
    name: "白猫",
    title: "白色淡黄眼睛长毛田园猫",
    eye: "#f4df86",
  },
};

const photoCatAssets: Record<Exclude<CatStyle, "drawn">, Record<Player, string>> = {
  photo: {
    black: `${import.meta.env.BASE_URL}assets/cats/black-photo-token.png`,
    white: `${import.meta.env.BASE_URL}assets/cats/white-photo-token.png`,
  },
  family: {
    black: `${import.meta.env.BASE_URL}assets/cats/black-cartoonwithfamily-photo-token.png`,
    white: `${import.meta.env.BASE_URL}assets/cats/white-cartoonwithfamily-photo-token.png`,
  },
};

const other = (player: Player): Player => (player === "black" ? "white" : "black");
const cellKey = (row: number, col: number) => `${row},${col}`;
const parseCell = (value: string): Point => {
  const [row, col] = value.split(",").map(Number);
  return { row, col };
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const boardIndex = (row: number, col: number, size: number) => row * size + col;
const inBoard = (row: number, col: number, rows: number, cols = rows) =>
  row >= 0 && row < rows && col >= 0 && col < cols;

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

function svgBoard(className: string, label: string, width: number, height: number, body: string) {
  return `
    <svg
      class="game-svg ${className}"
      data-board
      tabindex="0"
      role="application"
      aria-label="${escapeHtml(label)}"
      viewBox="0 0 ${width} ${height}"
    >
      ${body}
    </svg>
  `;
}

function iconButton(action: string, icon: string, label: string, disabled = false) {
  return `
    <button class="control-button" data-action="${action}" ${disabled ? "disabled" : ""} aria-label="${escapeHtml(label)}">
      <span class="button-icon" aria-hidden="true">${icon}</span>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function optionButton(action: string, label: string, active: boolean) {
  return `
    <button class="option-button ${active ? "is-active" : ""}" data-action="${action}" aria-pressed="${active}">
      ${escapeHtml(label)}
    </button>
  `;
}

function catStylePicker() {
  return `
    <div class="option-group">
      <p class="option-title">猫咪形象</p>
      <div class="segmented-control cat-style-control">
        ${optionButton("catStyle:drawn", "手绘猫", appState.catStyle === "drawn")}
        ${optionButton("catStyle:photo", "扣图猫", appState.catStyle === "photo")}
        ${optionButton("catStyle:family", "全家福猫", appState.catStyle === "family")}
      </div>
    </div>
  `;
}

function modePicker(title: string, actionPrefix: string, mode: PlayMode) {
  return `
    <div class="option-group controls-wide">
      <p class="option-title">${escapeHtml(title)}</p>
      <div class="segmented-control">
        ${optionButton(`${actionPrefix}:ai`, "和 AI 下", mode === "ai")}
        ${optionButton(`${actionPrefix}:local`, "真人对弈", mode === "local")}
      </div>
    </div>
  `;
}

function catToken(side: Player, x: number, y: number, radius: number, label = "", selected = false) {
  const isWhite = side === "white";
  const fur = isWhite ? "#fffaf0" : "#12110f";
  const bodyFur = isWhite ? "#fff5e4" : "#171613";
  const inner = isWhite ? "#ffc7b5" : "#5b3328";
  const stroke = isWhite ? "#c08a52" : "#f4c63e";
  const softStroke = isWhite ? "#ead8bf" : "#3c352a";
  const muzzle = isWhite ? "#fffdf7" : "#201f1c";
  const nose = isWhite ? "#e58f8f" : "#28201d";
  const eye = playerMeta[side].eye;
  const earY = -radius * 0.78;
  const earX = radius * 0.55;
  const faceShape = isWhite
    ? `M 0 ${-radius} C ${radius * 0.64} ${-radius}, ${radius * 1.1} ${-radius * 0.5}, ${radius * 1.06} ${radius * 0.1} C ${radius * 1.17} ${radius * 0.52}, ${radius * 0.77} ${radius * 0.95}, ${radius * 0.28} ${radius * 1.06} C ${radius * 0.06} ${radius * 1.18}, ${-radius * 0.06} ${radius * 1.18}, ${-radius * 0.28} ${radius * 1.06} C ${-radius * 0.77} ${radius * 0.95}, ${-radius * 1.17} ${radius * 0.52}, ${-radius * 1.06} ${radius * 0.1} C ${-radius * 1.1} ${-radius * 0.5}, ${-radius * 0.64} ${-radius}, 0 ${-radius} Z`
    : `M 0 ${-radius * 0.98} C ${radius * 0.62} ${-radius * 0.98}, ${radius * 0.98} ${-radius * 0.45}, ${radius * 0.92} ${radius * 0.16} C ${radius * 0.86} ${radius * 0.78}, ${radius * 0.38} ${radius * 1.02}, 0 ${radius * 1.05} C ${-radius * 0.38} ${radius * 1.02}, ${-radius * 0.86} ${radius * 0.78}, ${-radius * 0.92} ${radius * 0.16} C ${-radius * 0.98} ${-radius * 0.45}, ${-radius * 0.62} ${-radius * 0.98}, 0 ${-radius * 0.98} Z`;
  const tail = isWhite
    ? `<path class="cat-tail cat-tail-white" d="M ${-radius * 0.72} ${radius * 0.3} C ${-radius * 1.38} ${-radius * 0.58}, ${-radius * 0.56} ${-radius * 1.7}, ${radius * 0.34} ${-radius * 1.25} C ${radius * 1.02} ${-radius * 0.9}, ${radius * 0.7} ${-radius * 0.18}, ${radius * 0.2} ${radius * 0.05}" stroke="${bodyFur}" />`
    : `<path class="cat-tail cat-tail-black" d="M ${-radius * 0.66} ${radius * 0.35} C ${-radius * 1.38} ${-radius * 0.1}, ${-radius * 1.12} ${-radius * 1.02}, ${-radius * 0.36} ${-radius * 1.04}" stroke="${bodyFur}" />`;
  const furDetail = isWhite
    ? `
      <path class="cat-fluff" d="M ${-radius * 0.92} ${-radius * 0.2} L ${-radius * 1.2} ${-radius * 0.02} L ${-radius * 0.98} ${radius * 0.18} L ${-radius * 1.2} ${radius * 0.38} L ${-radius * 0.9} ${radius * 0.48} M ${radius * 0.92} ${-radius * 0.2} L ${radius * 1.2} ${-radius * 0.02} L ${radius * 0.98} ${radius * 0.18} L ${radius * 1.2} ${radius * 0.38} L ${radius * 0.9} ${radius * 0.48}" />
      <path class="cat-fur-streak" d="M ${-radius * 0.22} ${-radius * 0.88} C ${-radius * 0.06} ${-radius * 0.68}, ${-radius * 0.02} ${-radius * 0.52}, 0 ${-radius * 0.36} M ${radius * 0.16} ${-radius * 0.9} C ${radius * 0.05} ${-radius * 0.64}, ${radius * 0.12} ${-radius * 0.48}, ${radius * 0.28} ${-radius * 0.34}" />
    `
    : `
      <path class="cat-short-fur" d="M ${-radius * 0.34} ${-radius * 0.9} L ${-radius * 0.15} ${-radius * 1.1} L ${radius * 0.02} ${-radius * 0.9} L ${radius * 0.2} ${-radius * 1.08} L ${radius * 0.38} ${-radius * 0.84}" />
      <path class="cat-fur-streak cat-black-streak" d="M ${-radius * 0.56} ${-radius * 0.42} C ${-radius * 0.28} ${-radius * 0.52}, ${-radius * 0.06} ${-radius * 0.55}, ${radius * 0.18} ${-radius * 0.5} M ${-radius * 0.62} ${radius * 0.18} C ${-radius * 0.34} ${radius * 0.05}, ${-radius * 0.08} ${radius * 0.02}, ${radius * 0.18} ${radius * 0.1}" />
    `;

  return `
    <g class="cat-token cat-${side} ${selected ? "is-selected" : ""}" transform="translate(${x} ${y})">
      <ellipse class="cat-shadow" cx="0" cy="${radius * 0.54}" rx="${radius * 1.2}" ry="${radius * 0.58}" />
      ${tail}
      <ellipse class="cat-body" cx="${-radius * 0.16}" cy="${radius * 0.42}" rx="${radius * 0.82}" ry="${radius * 0.48}" fill="${bodyFur}" stroke="${softStroke}" transform="rotate(${isWhite ? -7 : -12})" />
      <ellipse class="cat-paw" cx="${-radius * 0.48}" cy="${radius * 0.8}" rx="${radius * 0.23}" ry="${radius * 0.13}" fill="${fur}" stroke="${softStroke}" />
      <ellipse class="cat-paw" cx="${radius * 0.42}" cy="${radius * 0.82}" rx="${radius * 0.23}" ry="${radius * 0.13}" fill="${fur}" stroke="${softStroke}" />
      <path class="cat-ear" d="M ${-earX} ${earY} L ${-radius * 0.96} ${-radius * 1.42} L ${-radius * 0.25} ${-radius * 0.95} Z" fill="${fur}" stroke="${stroke}" />
      <path class="cat-ear" d="M ${earX} ${earY} L ${radius * 0.96} ${-radius * 1.42} L ${radius * 0.25} ${-radius * 0.95} Z" fill="${fur}" stroke="${stroke}" />
      <path class="cat-ear-inner" d="M ${-earX} ${earY - radius * 0.06} L ${-radius * 0.78} ${-radius * 1.18} L ${-radius * 0.38} ${-radius * 0.9} Z" fill="${inner}" />
      <path class="cat-ear-inner" d="M ${earX} ${earY - radius * 0.06} L ${radius * 0.78} ${-radius * 1.18} L ${radius * 0.38} ${-radius * 0.9} Z" fill="${inner}" />
      <path class="cat-face" d="${faceShape}" fill="${fur}" stroke="${stroke}" />
      ${furDetail}
      <ellipse class="cat-muzzle" cx="${-radius * 0.18}" cy="${radius * 0.25}" rx="${radius * 0.24}" ry="${radius * 0.18}" fill="${muzzle}" />
      <ellipse class="cat-muzzle" cx="${radius * 0.18}" cy="${radius * 0.25}" rx="${radius * 0.24}" ry="${radius * 0.18}" fill="${muzzle}" />
      <ellipse class="cat-eye" cx="${-radius * 0.34}" cy="${-radius * 0.16}" rx="${radius * 0.18}" ry="${radius * 0.24}" fill="${eye}" />
      <ellipse class="cat-eye" cx="${radius * 0.34}" cy="${-radius * 0.16}" rx="${radius * 0.18}" ry="${radius * 0.24}" fill="${eye}" />
      <ellipse class="cat-pupil" cx="${-radius * 0.34}" cy="${-radius * 0.15}" rx="${radius * 0.045}" ry="${radius * 0.17}" />
      <ellipse class="cat-pupil" cx="${radius * 0.34}" cy="${-radius * 0.15}" rx="${radius * 0.045}" ry="${radius * 0.17}" />
      <circle class="cat-eye-shine" cx="${-radius * 0.39}" cy="${-radius * 0.25}" r="${radius * 0.055}" />
      <circle class="cat-eye-shine" cx="${radius * 0.29}" cy="${-radius * 0.25}" r="${radius * 0.055}" />
      <path class="cat-nose" d="M ${-radius * 0.1} ${radius * 0.14} Q 0 ${radius * 0.24} ${radius * 0.1} ${radius * 0.14} Q 0 ${radius * 0.08} ${-radius * 0.1} ${radius * 0.14}" fill="${nose}" />
      <path class="cat-mouth" d="M 0 ${radius * 0.24} Q ${-radius * 0.12} ${radius * 0.4} ${-radius * 0.3} ${radius * 0.34} M 0 ${radius * 0.24} Q ${radius * 0.12} ${radius * 0.4} ${radius * 0.3} ${radius * 0.34}" />
      <ellipse class="cat-open-mouth" cx="0" cy="${radius * 0.46}" rx="${radius * 0.11}" ry="${radius * 0.14}" />
      <path class="cat-whisker" d="M ${-radius * 0.18} ${radius * 0.15} L ${-radius * 0.9} ${radius * 0.02} M ${-radius * 0.16} ${radius * 0.3} L ${-radius * 0.86} ${radius * 0.48} M ${radius * 0.18} ${radius * 0.15} L ${radius * 0.9} ${radius * 0.02} M ${radius * 0.16} ${radius * 0.3} L ${radius * 0.86} ${radius * 0.48}" />
      ${label ? `<text class="piece-label" y="${radius * 1.72}">${escapeHtml(label)}</text>` : ""}
    </g>
  `;
}

function photoCatToken(side: Player, x: number, y: number, radius: number, label = "", selected = false, style: Exclude<CatStyle, "drawn"> = "photo") {
  const size = radius * 3.05;
  const photoX = x - size / 2;
  const photoY = y - size / 2 - radius * 0.05;
  const stroke = side === "black" ? "#ffd84d" : "#fff1c1";
  const fill = side === "black" ? "#141414" : "#fff8ea";
  return `
    <g class="cat-token cat-photo-token cat-${side} ${selected ? "is-selected" : ""}" transform="translate(0 0)">
      <ellipse class="cat-shadow" cx="${x}" cy="${y + radius * 0.42}" rx="${radius * 1.18}" ry="${radius * 0.48}" />
      <circle class="cat-photo-bg" cx="${x}" cy="${y}" r="${radius * 1.06}" fill="${fill}" stroke="${stroke}" />
      <image class="cat-photo-image" href="${photoCatAssets[style][side]}" x="${photoX}" y="${photoY}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />
      ${selected ? `<circle class="cat-photo-selected" cx="${x}" cy="${y}" r="${radius * 1.2}" />` : ""}
      ${label ? `<text class="piece-label" y="${y + radius * 1.72}" x="${x}">${escapeHtml(label)}</text>` : ""}
    </g>
  `;
}

function catPiece(side: Player, x: number, y: number, radius: number, label = "", selected = false) {
  return appState.catStyle === "drawn" ? catToken(side, x, y, radius, label, selected) : photoCatToken(side, x, y, radius, label, selected, appState.catStyle);
}

function catIcon(side: Player) {
  return `
    <svg class="cat-icon" viewBox="0 0 40 44" aria-hidden="true">
      ${catPiece(side, 20, 22, 12)}
    </svg>
  `;
}

function duoCatIcon() {
  return `
    <svg class="brand-cats" viewBox="0 0 82 60" aria-hidden="true">
      ${catPiece("black", 28, 34, 15)}
      ${catPiece("white", 56, 34, 15)}
    </svg>
  `;
}

function turnChip(player: Player) {
  return `
    <div class="turn-chip turn-${player}" title="${playerMeta[player].title}">
      ${catIcon(player)}
      <span>${playerMeta[player].name}</span>
    </div>
  `;
}

function renderCursor(x: number, y: number, r: number) {
  return `<circle class="cursor-ring" cx="${x}" cy="${y}" r="${r}" />`;
}

function moveCursor(cursor: Point, event: KeyboardEvent, rows: number, cols: number, valid?: (row: number, col: number) => boolean) {
  const delta: Record<string, Point> = {
    ArrowUp: { row: -1, col: 0 },
    ArrowDown: { row: 1, col: 0 },
    ArrowLeft: { row: 0, col: -1 },
    ArrowRight: { row: 0, col: 1 },
  };
  const step = delta[event.key];
  if (!step) return false;
  let row = clamp(cursor.row + step.row, 0, rows - 1);
  let col = clamp(cursor.col + step.col, 0, cols - 1);
  if (valid && !valid(row, col)) {
    for (let i = 0; i < Math.max(rows, cols); i += 1) {
      const nextRow = clamp(row + step.row * i, 0, rows - 1);
      const nextCol = clamp(col + step.col * i, 0, cols - 1);
      if (valid(nextRow, nextCol)) {
        row = nextRow;
        col = nextCol;
        break;
      }
    }
  }
  cursor.row = row;
  cursor.col = col;
  event.preventDefault();
  return true;
}

// Gomoku
type GomokuState = {
  board: Array<Player | null>;
  cursor: Point;
  turn: Player;
  mode: PlayMode;
  history: Array<Point & { player: Player }>;
  lastMove: Point | null;
  winningLine: Point[];
  winner: Player | null;
  message: string;
  moves: number;
};

const gomokuSize = 15;

function createGomoku(): GomokuState {
  return {
    board: Array<Player | null>(gomokuSize * gomokuSize).fill(null),
    cursor: { row: 7, col: 7 },
    turn: "black",
    mode: "ai",
    history: [],
    lastMove: null,
    winningLine: [],
    winner: null,
    message: "人机模式，黑猫先手。",
    moves: 0,
  };
}

const gomokuDirs = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function gomokuWinningLine(state: GomokuState, row: number, col: number, player: Player) {
  for (const [dr, dc] of gomokuDirs) {
    const line = [{ row, col }];
    let nr = row + dr;
    let nc = col + dc;
    while (inBoard(nr, nc, gomokuSize) && state.board[boardIndex(nr, nc, gomokuSize)] === player) {
      line.push({ row: nr, col: nc });
      nr += dr;
      nc += dc;
    }
    nr = row - dr;
    nc = col - dc;
    while (inBoard(nr, nc, gomokuSize) && state.board[boardIndex(nr, nc, gomokuSize)] === player) {
      line.unshift({ row: nr, col: nc });
      nr -= dr;
      nc -= dc;
    }
    if (line.length >= 5) return line;
  }
  return [];
}

function gomokuWon(state: GomokuState, row: number, col: number, player: Player) {
  return gomokuWinningLine(state, row, col, player).length >= 5;
}

function gomokuCountLine(state: GomokuState, row: number, col: number, dr: number, dc: number, player: Player) {
  let count = 0;
  let nr = row + dr;
  let nc = col + dc;
  while (inBoard(nr, nc, gomokuSize) && state.board[boardIndex(nr, nc, gomokuSize)] === player) {
    count += 1;
    nr += dr;
    nc += dc;
  }
  return {
    count,
    open: inBoard(nr, nc, gomokuSize) && state.board[boardIndex(nr, nc, gomokuSize)] === null,
  };
}

function gomokuScorePoint(state: GomokuState, row: number, col: number, player: Player) {
  let total = 0;
  for (const [dr, dc] of gomokuDirs) {
    const forward = gomokuCountLine(state, row, col, dr, dc, player);
    const backward = gomokuCountLine(state, row, col, -dr, -dc, player);
    const length = 1 + forward.count + backward.count;
    const openEnds = Number(forward.open) + Number(backward.open);
    if (length >= 5) total += 100000;
    else if (length === 4 && openEnds === 2) total += 18000;
    else if (length === 4 && openEnds === 1) total += 4800;
    else if (length === 3 && openEnds === 2) total += 2300;
    else if (length === 3 && openEnds === 1) total += 620;
    else if (length === 2 && openEnds === 2) total += 260;
    else if (length === 2 && openEnds === 1) total += 80;
    else if (openEnds === 2) total += 24;
  }
  return total;
}

function gomokuCandidates(state: GomokuState) {
  if (!state.history.length) return [{ row: 7, col: 7 }];
  const seen = new Set<string>();
  const candidates: Point[] = [];
  for (const move of state.history) {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const row = move.row + dr;
        const col = move.col + dc;
        const key = cellKey(row, col);
        if (!inBoard(row, col, gomokuSize) || state.board[boardIndex(row, col, gomokuSize)] || seen.has(key)) continue;
        seen.add(key);
        candidates.push({ row, col });
      }
    }
  }
  return candidates.length ? candidates : [{ row: 7, col: 7 }];
}

function gomokuChooseAiMove(state: GomokuState) {
  // Ported from the standalone gomoku.html AI: win, block, then score nearby candidates.
  const candidates = gomokuCandidates(state);
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (const point of candidates) {
    const index = boardIndex(point.row, point.col, gomokuSize);
    state.board[index] = "white";
    if (gomokuWon(state, point.row, point.col, "white")) {
      state.board[index] = null;
      return point;
    }
    state.board[index] = null;

    state.board[index] = "black";
    if (gomokuWon(state, point.row, point.col, "black")) {
      state.board[index] = null;
      return point;
    }
    state.board[index] = null;

    const attack = gomokuScorePoint(state, point.row, point.col, "white");
    const defense = gomokuScorePoint(state, point.row, point.col, "black");
    const center = 18 - Math.hypot(point.row - 7, point.col - 7);
    const score = attack + defense * 0.92 + center;
    if (score > bestScore) {
      bestScore = score;
      best = point;
    }
  }
  return best;
}

function gomokuApplyMove(state: GomokuState, row: number, col: number, player: Player) {
  const index = boardIndex(row, col, gomokuSize);
  if (state.board[index] || state.winner) return false;
  state.board[index] = player;
  state.history.push({ row, col, player });
  state.lastMove = { row, col };
  state.moves += 1;
  const line = gomokuWinningLine(state, row, col, player);
  if (line.length >= 5) {
    state.winner = player;
    state.winningLine = line;
    state.message = `${playerMeta[player].name}五子连线。`;
  } else if (state.moves === gomokuSize * gomokuSize) {
    state.message = "棋盘已满，平局。";
  }
  return true;
}

function gomokuSetMode(state: GomokuState, mode: PlayMode) {
  if (state.mode === mode) return;
  const fresh = createGomoku();
  Object.assign(state, fresh, {
    mode,
    message: mode === "ai" ? "人机模式，黑猫先手。" : "双人模式，黑猫先手。",
  });
  clearUndo("gomoku");
}

function gomokuTurnLabel(state: GomokuState) {
  if (state.winner) return `${playerMeta[state.winner].name}已经连五。`;
  if (state.mode === "ai") return "你执黑，白猫 AI 应手。";
  return `${playerMeta[state.turn].name}落子。`;
}

function gomokuPlace(state: GomokuState, row: number, col: number) {
  if (state.winner) {
    state.message = `${playerMeta[state.winner].name}已经连五。`;
    return;
  }
  const index = boardIndex(row, col, gomokuSize);
  if (state.board[index]) {
    state.message = "这个交叉点已经有猫了。";
    return;
  }
  if (state.mode === "ai") {
    if (state.turn !== "black") return;
    if (!gomokuApplyMove(state, row, col, "black")) return;
    if (state.winner || state.moves === gomokuSize * gomokuSize) return;
    state.turn = "white";
    const aiMove = gomokuChooseAiMove(state);
    if (aiMove) {
      gomokuApplyMove(state, aiMove.row, aiMove.col, "white");
      if (!state.winner && state.moves < gomokuSize * gomokuSize) state.message = `白猫 AI 落在 ${String.fromCharCode(65 + aiMove.col)}${aiMove.row + 1}，轮到黑猫。`;
    }
    if (!state.winner) state.turn = "black";
    return;
  }

  const player = state.turn;
  if (!gomokuApplyMove(state, row, col, player)) return;
  if (!state.winner && state.moves < gomokuSize * gomokuSize) {
    state.turn = other(player);
    state.message = gomokuTurnLabel(state);
  }
}

function renderGomoku(state: GomokuState) {
  const pad = 36;
  const step = 34;
  const size = pad * 2 + step * (gomokuSize - 1);
  const lines: string[] = [];
  for (let i = 0; i < gomokuSize; i += 1) {
    const p = pad + i * step;
    lines.push(`<line class="board-line" x1="${pad}" y1="${p}" x2="${size - pad}" y2="${p}" />`);
    lines.push(`<line class="board-line" x1="${p}" y1="${pad}" x2="${p}" y2="${size - pad}" />`);
  }
  const stars = [3, 7, 11]
    .flatMap((row) => [3, 7, 11].map((col) => ({ row, col })))
    .map(({ row, col }) => `<circle class="star-point" cx="${pad + col * step}" cy="${pad + row * step}" r="3.5" />`)
    .join("");
  const cells: string[] = [];
  const pieces: string[] = [];
  for (let row = 0; row < gomokuSize; row += 1) {
    for (let col = 0; col < gomokuSize; col += 1) {
      const x = pad + col * step;
      const y = pad + row * step;
      cells.push(`<circle class="svg-hotspot" data-cell="${row},${col}" cx="${x}" cy="${y}" r="${step * 0.48}" />`);
      const piece = state.board[boardIndex(row, col, gomokuSize)];
      const isLast = state.lastMove?.row === row && state.lastMove.col === col;
      const isWin = state.winningLine.some((point) => point.row === row && point.col === col);
      if (isLast) pieces.push(`<circle class="last-move-ring" cx="${x}" cy="${y}" r="18" />`);
      if (isWin) pieces.push(`<circle class="winning-ring" cx="${x}" cy="${y}" r="20" />`);
      if (piece) pieces.push(catPiece(piece, x, y, 12.5));
    }
  }
  const cursor = renderCursor(pad + state.cursor.col * step, pad + state.cursor.row * step, 17);
  return svgBoard("gomoku-svg", "五子棋", size, size, `
    <rect class="board-bg paper-bg" x="8" y="8" width="${size - 16}" height="${size - 16}" rx="18" />
    ${lines.join("")}
    ${stars}
    ${cells.join("")}
    ${pieces.join("")}
    ${cursor}
  `);
}

const gomokuGame: Game<GomokuState> = {
  id: "gomoku",
  name: "五子棋",
  badge: "15路",
  create: createGomoku,
  render: renderGomoku,
  controls: (state) => `
    ${modePicker("五子棋模式", "gomokuMode", state.mode)}
    ${iconButton("reset", "↻", "重开")}
  `,
  handleCell: gomokuPlace,
  handleAction: (state, action) => {
    if (action === "gomokuMode:ai") gomokuSetMode(state, "ai");
    if (action === "gomokuMode:local") gomokuSetMode(state, "local");
  },
  handleKey: (state, event) => {
    if (moveCursor(state.cursor, event, gomokuSize, gomokuSize)) return true;
    if (event.key === "Enter" || event.key === " ") {
      gomokuPlace(state, state.cursor.row, state.cursor.col);
      event.preventDefault();
      return true;
    }
    return false;
  },
};

// Go
type GoState = {
  board: Array<Player | null>;
  captures: Record<Player, number>;
  cursor: Point;
  turn: Player;
  mode: PlayMode;
  passCount: number;
  winner: Player | null;
  message: string;
};

const goSize = 9;

function createGo(): GoState {
  return {
    board: Array<Player | null>(goSize * goSize).fill(null),
    captures: { black: 0, white: 0 },
    cursor: { row: 4, col: 4 },
    turn: "black",
    mode: "ai",
    passCount: 0,
    winner: null,
    message: "人机模式，黑猫先手，你执黑。",
  };
}

function goNeighbors(row: number, col: number) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((point) => inBoard(point.row, point.col, goSize));
}

function goCollectGroup(board: Array<Player | null>, startRow: number, startCol: number) {
  const player = board[boardIndex(startRow, startCol, goSize)];
  if (!player) return [];
  const seen = new Set<string>();
  const stack = [{ row: startRow, col: startCol }];
  while (stack.length) {
    const point = stack.pop();
    if (!point) continue;
    const key = cellKey(point.row, point.col);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const next of goNeighbors(point.row, point.col)) {
      if (board[boardIndex(next.row, next.col, goSize)] === player) stack.push(next);
    }
  }
  return [...seen].map(parseCell);
}

function goLiberties(board: Array<Player | null>, group: Point[]) {
  const liberties = new Set<string>();
  for (const point of group) {
    for (const next of goNeighbors(point.row, point.col)) {
      if (!board[boardIndex(next.row, next.col, goSize)]) liberties.add(cellKey(next.row, next.col));
    }
  }
  return liberties.size;
}

function goScore(state: GoState) {
  const stones = { black: 0, white: 0 };
  for (const piece of state.board) {
    if (piece) stones[piece] += 1;
  }
  const black = stones.black + state.captures.black;
  const white = stones.white + state.captures.white;
  return { black, white };
}

function goTryMove(state: GoState, row: number, col: number, player: Player) {
  const index = boardIndex(row, col, goSize);
  if (state.board[index]) return null;
  const nextBoard = [...state.board];
  nextBoard[index] = player;
  let captured = 0;
  for (const next of goNeighbors(row, col)) {
    if (nextBoard[boardIndex(next.row, next.col, goSize)] !== other(player)) continue;
    const group = goCollectGroup(nextBoard, next.row, next.col);
    if (goLiberties(nextBoard, group) === 0) {
      captured += group.length;
      for (const point of group) nextBoard[boardIndex(point.row, point.col, goSize)] = null;
    }
  }
  const ownGroup = goCollectGroup(nextBoard, row, col);
  const liberties = goLiberties(nextBoard, ownGroup);
  if (liberties === 0) return null;
  return { board: nextBoard, captured, liberties };
}

function goApplyMove(state: GoState, row: number, col: number, player: Player) {
  const result = goTryMove(state, row, col, player);
  if (!result) return false;
  state.board = result.board;
  state.captures[player] += result.captured;
  state.passCount = 0;
  state.turn = other(player);
  state.message = result.captured ? `${playerMeta[player].name}提走 ${result.captured} 子。` : `${playerMeta[state.turn].name}落子。`;
  return true;
}

function goChooseAiMove(state: GoState, player: Player) {
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (let row = 0; row < goSize; row += 1) {
    for (let col = 0; col < goSize; col += 1) {
      const result = goTryMove(state, row, col, player);
      if (!result) continue;
      const center = 10 - Math.hypot(row - 4, col - 4);
      const pressure = goNeighbors(row, col).filter((next) => state.board[boardIndex(next.row, next.col, goSize)] === other(player)).length;
      const friendly = goNeighbors(row, col).filter((next) => state.board[boardIndex(next.row, next.col, goSize)] === player).length;
      const score = result.captured * 120 + result.liberties * 10 + pressure * 7 + friendly * 5 + center;
      if (score > bestScore) {
        bestScore = score;
        best = { row, col };
      }
    }
  }
  return best;
}

function goPassFor(state: GoState, player: Player) {
  if (state.winner) return;
  state.passCount += 1;
  if (state.passCount >= 2) {
    const score = goScore(state);
    const winner: Player | null = score.black === score.white ? null : score.black > score.white ? "black" : "white";
    state.winner = winner;
    state.message =
      winner === null
        ? `双方 ${score.black}:${score.white}，平局。`
        : `${playerMeta[winner].name} ${score.black}:${score.white} 获胜。`;
    return;
  }
  state.turn = other(player);
  state.message = `${playerMeta[player].name}停着，${playerMeta[state.turn].name}落子。`;
}

function goAiTurn(state: GoState) {
  if (state.mode !== "ai" || state.winner || state.turn !== "white") return;
  const move = goChooseAiMove(state, "white");
  if (!move) {
    goPassFor(state, "white");
    if (!state.winner) state.message = "白猫 AI 停着，轮到黑猫。";
    return;
  }
  const applied = goApplyMove(state, move.row, move.col, "white");
  if (applied && !state.winner) {
    state.message = `白猫 AI 落在 ${String.fromCharCode(65 + move.col)}${move.row + 1}，轮到黑猫。`;
  }
}

function goSetMode(state: GoState, mode: PlayMode) {
  if (state.mode === mode) return;
  const fresh = createGo();
  Object.assign(state, fresh, {
    mode,
    message: mode === "ai" ? "人机模式，黑猫先手，你执黑。" : "真人对弈，黑猫先手。",
  });
  clearUndo("go");
}

function goPlace(state: GoState, row: number, col: number) {
  if (state.winner) return;
  const index = boardIndex(row, col, goSize);
  if (state.board[index]) {
    state.message = "这里已经有猫子。";
    return;
  }
  if (state.mode === "ai" && state.turn !== "black") {
    state.message = "白猫 AI 正在应手。";
    return;
  }
  const player = state.turn;
  if (!goApplyMove(state, row, col, player)) {
    state.message = "这里没有气，不能自杀。";
    return;
  }
  if (state.mode === "ai") goAiTurn(state);
}

function goPass(state: GoState) {
  if (state.winner) return;
  if (state.mode === "ai" && state.turn !== "black") {
    state.message = "白猫 AI 正在应手。";
    return;
  }
  const player = state.turn;
  goPassFor(state, player);
  if (state.mode === "ai") goAiTurn(state);
}

function renderGo(state: GoState) {
  const pad = 48;
  const step = 52;
  const size = pad * 2 + step * (goSize - 1);
  const lines: string[] = [];
  for (let i = 0; i < goSize; i += 1) {
    const p = pad + i * step;
    lines.push(`<line class="board-line go-line" x1="${pad}" y1="${p}" x2="${size - pad}" y2="${p}" />`);
    lines.push(`<line class="board-line go-line" x1="${p}" y1="${pad}" x2="${p}" y2="${size - pad}" />`);
  }
  const stars = [
    [2, 2],
    [2, 6],
    [4, 4],
    [6, 2],
    [6, 6],
  ]
    .map(([row, col]) => `<circle class="star-point" cx="${pad + col * step}" cy="${pad + row * step}" r="4" />`)
    .join("");
  const cells: string[] = [];
  const pieces: string[] = [];
  for (let row = 0; row < goSize; row += 1) {
    for (let col = 0; col < goSize; col += 1) {
      const x = pad + col * step;
      const y = pad + row * step;
      cells.push(`<circle class="svg-hotspot" data-cell="${row},${col}" cx="${x}" cy="${y}" r="${step * 0.46}" />`);
      const piece = state.board[boardIndex(row, col, goSize)];
      if (piece) pieces.push(catPiece(piece, x, y, 17));
    }
  }
  const score = goScore(state);
  return svgBoard("go-svg", "围棋", size, size + 42, `
    <rect class="board-bg bamboo-bg" x="8" y="8" width="${size - 16}" height="${size - 16}" rx="18" />
    ${lines.join("")}
    ${stars}
    ${cells.join("")}
    ${pieces.join("")}
    ${renderCursor(pad + state.cursor.col * step, pad + state.cursor.row * step, 23)}
    <text class="score-text" x="${pad}" y="${size + 25}">黑猫 ${score.black}  白猫 ${score.white}</text>
  `);
}

const goGame: Game<GoState> = {
  id: "go",
  name: "围棋",
  badge: "9路",
  create: createGo,
  render: renderGo,
  controls: (state) => `${modePicker("围棋模式", "goMode", state.mode)}${iconButton("pass", "⏭", "停着")}${iconButton("reset", "↻", "重开")}`,
  handleCell: goPlace,
  handleAction: (state, action) => {
    if (action === "goMode:ai") goSetMode(state, "ai");
    if (action === "goMode:local") goSetMode(state, "local");
    if (action === "pass") goPass(state);
  },
  handleKey: (state, event) => {
    if (moveCursor(state.cursor, event, goSize, goSize)) return true;
    if (event.key === "Enter" || event.key === " ") {
      goPlace(state, state.cursor.row, state.cursor.col);
      event.preventDefault();
      return true;
    }
    if (event.key.toLowerCase() === "p") {
      goPass(state);
      event.preventDefault();
      return true;
    }
    return false;
  },
};

// Xiangqi
type XiangqiKind = "G" | "A" | "E" | "H" | "R" | "C" | "S";
type XiangqiPiece = {
  id: string;
  side: Player;
  kind: XiangqiKind;
  row: number;
  col: number;
};
type XiangqiState = {
  pieces: XiangqiPiece[];
  selected: string | null;
  cursor: Point;
  turn: Player;
  mode: PlayMode;
  winner: Player | null;
  message: string;
};

const xiangqiLabels: Record<Player, Record<XiangqiKind, string>> = {
  black: { G: "将", A: "士", E: "象", H: "马", R: "车", C: "炮", S: "卒" },
  white: { G: "帅", A: "仕", E: "相", H: "马", R: "车", C: "炮", S: "兵" },
};

function createXiangqi(): XiangqiState {
  const pieces: XiangqiPiece[] = [];
  const add = (side: Player, kind: XiangqiKind, row: number, col: number) => {
    pieces.push({ id: `${side}-${kind}-${row}-${col}-${pieces.length}`, side, kind, row, col });
  };
  const back: Array<[XiangqiKind, number]> = [
    ["R", 0],
    ["H", 1],
    ["E", 2],
    ["A", 3],
    ["G", 4],
    ["A", 5],
    ["E", 6],
    ["H", 7],
    ["R", 8],
  ];
  for (const [kind, col] of back) {
    add("black", kind, 0, col);
    add("white", kind, 9, col);
  }
  for (const col of [1, 7]) {
    add("black", "C", 2, col);
    add("white", "C", 7, col);
  }
  for (const col of [0, 2, 4, 6, 8]) {
    add("black", "S", 3, col);
    add("white", "S", 6, col);
  }
  return {
    pieces,
    selected: null,
    cursor: { row: 9, col: 4 },
    turn: "white",
    mode: "ai",
    winner: null,
    message: "人机模式，你执白猫先行。",
  };
}

function xiangqiPieceAt(state: XiangqiState, row: number, col: number) {
  return state.pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
}

function xiangqiBetween(state: XiangqiState, from: Point, to: Point) {
  if (from.row !== to.row && from.col !== to.col) return 99;
  let count = 0;
  const dr = Math.sign(to.row - from.row);
  const dc = Math.sign(to.col - from.col);
  let row = from.row + dr;
  let col = from.col + dc;
  while (row !== to.row || col !== to.col) {
    if (xiangqiPieceAt(state, row, col)) count += 1;
    row += dr;
    col += dc;
  }
  return count;
}

function xiangqiInPalace(side: Player, row: number, col: number) {
  const inCol = col >= 3 && col <= 5;
  return side === "white" ? inCol && row >= 7 && row <= 9 : inCol && row >= 0 && row <= 2;
}

function xiangqiLegal(state: XiangqiState, piece: XiangqiPiece, row: number, col: number) {
  if (!inBoard(row, col, 10, 9)) return false;
  const target = xiangqiPieceAt(state, row, col);
  if (target?.side === piece.side) return false;
  const dr = row - piece.row;
  const dc = col - piece.col;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  const from = { row: piece.row, col: piece.col };
  const to = { row, col };

  if (piece.kind === "G") {
    if (target?.kind === "G" && piece.col === col && xiangqiBetween(state, from, to) === 0) return true;
    return xiangqiInPalace(piece.side, row, col) && adr + adc === 1;
  }
  if (piece.kind === "A") {
    return xiangqiInPalace(piece.side, row, col) && adr === 1 && adc === 1;
  }
  if (piece.kind === "E") {
    const eye = xiangqiPieceAt(state, piece.row + dr / 2, piece.col + dc / 2);
    const staysHome = piece.side === "white" ? row >= 5 : row <= 4;
    return adr === 2 && adc === 2 && !eye && staysHome;
  }
  if (piece.kind === "H") {
    if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false;
    const leg = adr === 2 ? { row: piece.row + Math.sign(dr), col: piece.col } : { row: piece.row, col: piece.col + Math.sign(dc) };
    return !xiangqiPieceAt(state, leg.row, leg.col);
  }
  if (piece.kind === "R") {
    return (dr === 0 || dc === 0) && xiangqiBetween(state, from, to) === 0;
  }
  if (piece.kind === "C") {
    const between = xiangqiBetween(state, from, to);
    return target ? between === 1 : between === 0;
  }
  const forward = piece.side === "white" ? -1 : 1;
  const crossed = piece.side === "white" ? piece.row <= 4 : piece.row >= 5;
  if (dr === forward && dc === 0) return true;
  return crossed && dr === 0 && adc === 1;
}

const xiangqiValues: Record<XiangqiKind, number> = {
  G: 10000,
  R: 520,
  C: 460,
  H: 360,
  E: 170,
  A: 150,
  S: 90,
};

function xiangqiTurnMessage(state: XiangqiState) {
  if (state.winner) return `${playerMeta[state.winner].name}已经胜出。`;
  if (state.mode === "ai") return state.turn === "white" ? "你执白猫行棋。" : "黑猫 AI 行棋。";
  return `${playerMeta[state.turn].name}行棋。`;
}

function xiangqiApplyMove(state: XiangqiState, piece: XiangqiPiece, row: number, col: number) {
  const target = xiangqiPieceAt(state, row, col);
  if (!xiangqiLegal(state, piece, row, col)) return false;
  if (target) {
    state.pieces = state.pieces.filter((next) => next.id !== target.id);
    if (target.kind === "G") {
      state.winner = piece.side;
      state.message = `${playerMeta[piece.side].name}将军得手。`;
    }
  }
  piece.row = row;
  piece.col = col;
  state.selected = null;
  if (!state.winner) {
    state.turn = other(piece.side);
    state.message = xiangqiTurnMessage(state);
  }
  return true;
}

function xiangqiMoveScore(state: XiangqiState, piece: XiangqiPiece, row: number, col: number) {
  const target = xiangqiPieceAt(state, row, col);
  const advancement = piece.side === "black" ? row : 9 - row;
  const center = 5 - Math.abs(col - 4);
  const soldierBonus = piece.kind === "S" ? advancement * 8 : 0;
  return (target ? xiangqiValues[target.kind] * 12 : 0) + xiangqiValues[piece.kind] * 0.05 + advancement * 4 + center + soldierBonus;
}

function xiangqiLegalMoves(state: XiangqiState, side: Player) {
  const moves: Array<{ piece: XiangqiPiece; row: number; col: number; score: number }> = [];
  for (const piece of state.pieces) {
    if (piece.side !== side) continue;
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (!xiangqiLegal(state, piece, row, col)) continue;
        moves.push({ piece, row, col, score: xiangqiMoveScore(state, piece, row, col) });
      }
    }
  }
  return moves;
}

function xiangqiAiTurn(state: XiangqiState) {
  if (state.mode !== "ai" || state.winner || state.turn !== "black") return;
  const move = xiangqiLegalMoves(state, "black").sort((a, b) => b.score - a.score)[0];
  if (!move) {
    state.winner = "white";
    state.message = "黑猫 AI 无棋可走，白猫胜。";
    return;
  }
  const label = xiangqiLabels[move.piece.side][move.piece.kind];
  const captured = xiangqiPieceAt(state, move.row, move.col);
  xiangqiApplyMove(state, move.piece, move.row, move.col);
  if (!state.winner) {
    state.message = captured
      ? `黑猫 AI 用${label}吃子，轮到白猫。`
      : `黑猫 AI 走${label}到 ${move.row + 1}-${move.col + 1}，轮到白猫。`;
  }
}

function xiangqiSetMode(state: XiangqiState, mode: PlayMode) {
  if (state.mode === mode) return;
  const fresh = createXiangqi();
  Object.assign(state, fresh, {
    mode,
    message: mode === "ai" ? "人机模式，你执白猫先行。" : "真人对弈，白猫先行。",
  });
  clearUndo("xiangqi");
}

function xiangqiCell(state: XiangqiState, row: number, col: number) {
  if (state.winner) return;
  if (state.mode === "ai" && state.turn !== "white") {
    state.message = "黑猫 AI 正在行棋。";
    return;
  }
  const target = xiangqiPieceAt(state, row, col);
  if (!state.selected) {
    if (target?.side === state.turn) {
      state.selected = target.id;
      state.message = `${playerMeta[state.turn].name}选中 ${xiangqiLabels[target.side][target.kind]}。`;
    }
    return;
  }
  const moving = state.pieces.find((piece) => piece.id === state.selected);
  if (!moving) {
    state.selected = null;
    return;
  }
  if (target?.side === state.turn) {
    state.selected = target.id;
    state.message = `${playerMeta[state.turn].name}改选 ${xiangqiLabels[target.side][target.kind]}。`;
    return;
  }
  if (!xiangqiLegal(state, moving, row, col)) {
    state.message = "这一步走法不成立。";
    return;
  }
  if (xiangqiApplyMove(state, moving, row, col)) xiangqiAiTurn(state);
}

function renderXiangqi(state: XiangqiState) {
  const pad = 56;
  const step = 58;
  const width = pad * 2 + step * 8;
  const height = pad * 2 + step * 9;
  const lines: string[] = [];
  for (let row = 0; row <= 9; row += 1) {
    const y = pad + row * step;
    lines.push(`<line class="board-line xiangqi-line" x1="${pad}" y1="${y}" x2="${width - pad}" y2="${y}" />`);
  }
  for (let col = 0; col <= 8; col += 1) {
    const x = pad + col * step;
    lines.push(`<line class="board-line xiangqi-line" x1="${x}" y1="${pad}" x2="${x}" y2="${pad + 4 * step}" />`);
    lines.push(`<line class="board-line xiangqi-line" x1="${x}" y1="${pad + 5 * step}" x2="${x}" y2="${height - pad}" />`);
  }
  lines.push(`<line class="board-line xiangqi-line" x1="${pad + 3 * step}" y1="${pad}" x2="${pad + 5 * step}" y2="${pad + 2 * step}" />`);
  lines.push(`<line class="board-line xiangqi-line" x1="${pad + 5 * step}" y1="${pad}" x2="${pad + 3 * step}" y2="${pad + 2 * step}" />`);
  lines.push(`<line class="board-line xiangqi-line" x1="${pad + 3 * step}" y1="${pad + 7 * step}" x2="${pad + 5 * step}" y2="${pad + 9 * step}" />`);
  lines.push(`<line class="board-line xiangqi-line" x1="${pad + 5 * step}" y1="${pad + 7 * step}" x2="${pad + 3 * step}" y2="${pad + 9 * step}" />`);

  const cells: string[] = [];
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const x = pad + col * step;
      const y = pad + row * step;
      cells.push(`<circle class="svg-hotspot" data-cell="${row},${col}" cx="${x}" cy="${y}" r="${step * 0.44}" />`);
    }
  }
  const pieces = state.pieces
    .map((piece) => {
      const x = pad + piece.col * step;
      const y = pad + piece.row * step;
      return catPiece(piece.side, x, y, 20, xiangqiLabels[piece.side][piece.kind], state.selected === piece.id);
    })
    .join("");
  return svgBoard("xiangqi-svg", "象棋", width, height, `
    <rect class="board-bg silk-bg" x="8" y="8" width="${width - 16}" height="${height - 16}" rx="18" />
    <text class="river-text" x="${width / 2}" y="${pad + 4.67 * step}">楚河      汉界</text>
    ${lines.join("")}
    ${cells.join("")}
    ${pieces}
    ${renderCursor(pad + state.cursor.col * step, pad + state.cursor.row * step, 25)}
  `);
}

const xiangqiGame: Game<XiangqiState> = {
  id: "xiangqi",
  name: "象棋",
  badge: "九宫",
  create: createXiangqi,
  render: renderXiangqi,
  controls: (state) => `${modePicker("象棋模式", "xiangqiMode", state.mode)}${iconButton("reset", "↻", "重开")}`,
  handleCell: xiangqiCell,
  handleAction: (state, action) => {
    if (action === "xiangqiMode:ai") xiangqiSetMode(state, "ai");
    if (action === "xiangqiMode:local") xiangqiSetMode(state, "local");
  },
  handleKey: (state, event) => {
    if (moveCursor(state.cursor, event, 10, 9)) return true;
    if (event.key === "Enter" || event.key === " ") {
      xiangqiCell(state, state.cursor.row, state.cursor.col);
      event.preventDefault();
      return true;
    }
    if (event.key === "Escape") {
      state.selected = null;
      state.message = xiangqiTurnMessage(state);
      event.preventDefault();
      return true;
    }
    return false;
  },
};

// Jump game
type JumpState = {
  pieces: Record<string, Player>;
  cursor: Point;
  selected: string | null;
  turn: Player;
  mode: PlayMode;
  mustContinue: boolean;
  winner: Player | null;
  message: string;
};

const jumpSize = 9;
const jumpDirs = [-1, 0, 1]
  .flatMap((row) => [-1, 0, 1].map((col) => ({ row, col })))
  .filter((dir) => dir.row !== 0 || dir.col !== 0);

function jumpValid(row: number, col: number) {
  return inBoard(row, col, jumpSize) && Math.abs(row - 4) + Math.abs(col - 4) <= 4;
}

function createJump(): JumpState {
  const pieces: Record<string, Player> = {};
  for (let row = 0; row < jumpSize; row += 1) {
    for (let col = 0; col < jumpSize; col += 1) {
      if (!jumpValid(row, col)) continue;
      if (row <= 2) pieces[cellKey(row, col)] = "black";
      if (row >= 6) pieces[cellKey(row, col)] = "white";
    }
  }
  return {
    pieces,
    cursor: { row: 4, col: 4 },
    selected: null,
    turn: "black",
    mode: "ai",
    mustContinue: false,
    winner: null,
    message: "人机模式，黑猫先跳，你执黑。",
  };
}

function jumpHasJump(state: JumpState, key: string) {
  const { row, col } = parseCell(key);
  return jumpDirs.some((dir) => {
    const mid = cellKey(row + dir.row, col + dir.col);
    const landingRow = row + dir.row * 2;
    const landingCol = col + dir.col * 2;
    const landing = cellKey(landingRow, landingCol);
    return jumpValid(landingRow, landingCol) && state.pieces[mid] && !state.pieces[landing];
  });
}

function jumpCheckWinner(state: JumpState) {
  for (const side of ["black", "white"] as Player[]) {
    const keys = Object.entries(state.pieces)
      .filter(([, owner]) => owner === side)
      .map(([key]) => parseCell(key));
    const done = keys.length > 0 && keys.every((point) => (side === "black" ? point.row >= 6 : point.row <= 2));
    if (done) return side;
  }
  return null;
}

function jumpEndTurn(state: JumpState) {
  state.selected = null;
  state.mustContinue = false;
  state.turn = other(state.turn);
  state.message = `${playerMeta[state.turn].name}跳棋。`;
}

type JumpMove = {
  from: string;
  to: string;
  isJump: boolean;
  score: number;
};

function jumpMoveScore(side: Player, from: Point, to: Point, isJump: boolean) {
  const progress = side === "black" ? to.row - from.row : from.row - to.row;
  const homeBonus = side === "black" ? Math.max(0, to.row - 5) * 10 : Math.max(0, 3 - to.row) * 10;
  const center = 5 - Math.abs(to.col - 4);
  return (isJump ? 52 : 12) + progress * 18 + homeBonus + center;
}

function jumpLegalMovesFor(state: JumpState, side: Player, fromOnly?: string, jumpsOnly = false) {
  const moves: JumpMove[] = [];
  const entries = Object.entries(state.pieces).filter(([key, owner]) => owner === side && (!fromOnly || key === fromOnly));
  for (const [fromKey] of entries) {
    const from = parseCell(fromKey);
    for (const dir of jumpDirs) {
      const adjacentRow = from.row + dir.row;
      const adjacentCol = from.col + dir.col;
      const adjacentKey = cellKey(adjacentRow, adjacentCol);
      if (!jumpsOnly && jumpValid(adjacentRow, adjacentCol) && !state.pieces[adjacentKey]) {
        const to = { row: adjacentRow, col: adjacentCol };
        moves.push({
          from: fromKey,
          to: adjacentKey,
          isJump: false,
          score: jumpMoveScore(side, from, to, false),
        });
      }

      const landingRow = from.row + dir.row * 2;
      const landingCol = from.col + dir.col * 2;
      const landingKey = cellKey(landingRow, landingCol);
      if (jumpValid(landingRow, landingCol) && state.pieces[adjacentKey] && !state.pieces[landingKey]) {
        const to = { row: landingRow, col: landingCol };
        moves.push({
          from: fromKey,
          to: landingKey,
          isJump: true,
          score: jumpMoveScore(side, from, to, true),
        });
      }
    }
  }
  return moves;
}

function jumpApplyMove(state: JumpState, move: JumpMove, side: Player) {
  state.pieces[move.to] = side;
  delete state.pieces[move.from];
  const winner = jumpCheckWinner(state);
  if (winner) {
    state.winner = winner;
    state.message = `${playerMeta[winner].name}抵达对岸。`;
    state.selected = null;
    state.mustContinue = false;
    return true;
  }
  return false;
}

function jumpAiTurn(state: JumpState) {
  if (state.mode !== "ai" || state.winner || state.turn !== "white") return;
  let fromOnly: string | undefined;
  let lastMove: JumpMove | null = null;
  for (let guard = 0; guard < 8; guard += 1) {
    const moves = jumpLegalMovesFor(state, "white", fromOnly, Boolean(fromOnly)).sort((a, b) => b.score - a.score);
    const move = moves[0];
    if (!move) break;
    lastMove = move;
    const won = jumpApplyMove(state, move, "white");
    if (won) return;
    fromOnly = move.isJump && jumpHasJump(state, move.to) ? move.to : undefined;
    if (!fromOnly) break;
  }
  if (!lastMove) {
    state.winner = "black";
    state.message = "白猫 AI 无路可跳，黑猫胜。";
    return;
  }
  state.selected = null;
  state.mustContinue = false;
  state.turn = "black";
  const to = parseCell(lastMove.to);
  state.message = `白猫 AI 跳到 ${to.row + 1}-${to.col + 1}，轮到黑猫。`;
}

function jumpSetMode(state: JumpState, mode: PlayMode) {
  if (state.mode === mode) return;
  const fresh = createJump();
  Object.assign(state, fresh, {
    mode,
    message: mode === "ai" ? "人机模式，黑猫先跳，你执黑。" : "真人对弈，黑猫先跳。",
  });
  clearUndo("jump");
}

function jumpCell(state: JumpState, row: number, col: number) {
  if (state.winner || !jumpValid(row, col)) return;
  if (state.mode === "ai" && state.turn !== "black") {
    state.message = "白猫 AI 正在跳棋。";
    return;
  }
  const key = cellKey(row, col);
  const owner = state.pieces[key];
  if (!state.selected) {
    if (owner === state.turn) {
      state.selected = key;
      state.message = `${playerMeta[state.turn].name}选中。`;
    }
    return;
  }
  if (owner === state.turn && !state.mustContinue) {
    state.selected = key;
    state.message = `${playerMeta[state.turn].name}改选。`;
    return;
  }
  if (owner) {
    state.message = "落点被占住了。";
    return;
  }
  const from = parseCell(state.selected);
  const dr = row - from.row;
  const dc = col - from.col;
  const isAdjacent = Math.max(Math.abs(dr), Math.abs(dc)) === 1;
  const isJump = Math.max(Math.abs(dr), Math.abs(dc)) === 2 && dr % 2 === 0 && dc % 2 === 0 && state.pieces[cellKey(from.row + dr / 2, from.col + dc / 2)];
  if (state.mustContinue && !isJump) {
    state.message = "连跳中只能继续跳或结束回合。";
    return;
  }
  if (!isAdjacent && !isJump) {
    state.message = "只能走一格或隔猫跳。";
    return;
  }
  state.pieces[key] = state.turn;
  delete state.pieces[state.selected];
  const winner = jumpCheckWinner(state);
  if (winner) {
    state.winner = winner;
    state.message = `${playerMeta[winner].name}抵达对岸。`;
    state.selected = null;
    state.mustContinue = false;
    return;
  }
  if (isJump && jumpHasJump(state, key)) {
    state.selected = key;
    state.mustContinue = true;
    state.message = `${playerMeta[state.turn].name}可以继续连跳。`;
    return;
  }
  jumpEndTurn(state);
  jumpAiTurn(state);
}

function jumpPoint(row: number, col: number) {
  const centerX = 300;
  return {
    x: centerX + (col - 4) * 52 + (row - 4) * 14,
    y: 64 + row * 54,
  };
}

function renderJump(state: JumpState) {
  const cells: string[] = [];
  const pieces: string[] = [];
  for (let row = 0; row < jumpSize; row += 1) {
    for (let col = 0; col < jumpSize; col += 1) {
      if (!jumpValid(row, col)) continue;
      const { x, y } = jumpPoint(row, col);
      const zone = row <= 2 ? " top-zone" : row >= 6 ? " bottom-zone" : "";
      cells.push(`<circle class="jump-cell${zone}" data-cell="${row},${col}" cx="${x}" cy="${y}" r="18" />`);
      const owner = state.pieces[cellKey(row, col)];
      if (owner) pieces.push(catPiece(owner, x, y, 16, "", state.selected === cellKey(row, col)));
    }
  }
  const cursorPoint = jumpPoint(state.cursor.row, state.cursor.col);
  return svgBoard("jump-svg", "跳跳棋", 600, 560, `
    <rect class="board-bg night-bg" x="12" y="12" width="576" height="536" rx="18" />
    <path class="jump-lane" d="M 300 64 L 90 280 L 300 496 L 510 280 Z" />
    ${cells.join("")}
    ${pieces.join("")}
    ${renderCursor(cursorPoint.x, cursorPoint.y, 24)}
  `);
}

const jumpGame: Game<JumpState> = {
  id: "jump",
  name: "跳跳棋",
  badge: "连跳",
  create: createJump,
  render: renderJump,
  controls: (state) => `${modePicker("跳跳棋模式", "jumpMode", state.mode)}${iconButton("endJump", "✓", "结束回合", !state.mustContinue)}${iconButton("reset", "↻", "重开")}`,
  handleCell: jumpCell,
  handleAction: (state, action) => {
    if (action === "jumpMode:ai") jumpSetMode(state, "ai");
    if (action === "jumpMode:local") jumpSetMode(state, "local");
    if (action === "endJump" && state.mustContinue) {
      jumpEndTurn(state);
      jumpAiTurn(state);
    }
  },
  handleKey: (state, event) => {
    if (moveCursor(state.cursor, event, jumpSize, jumpSize, jumpValid)) return true;
    if (event.key === "Enter" || event.key === " ") {
      jumpCell(state, state.cursor.row, state.cursor.col);
      event.preventDefault();
      return true;
    }
    if (event.key.toLowerCase() === "n" && state.mustContinue) {
      jumpEndTurn(state);
      jumpAiTurn(state);
      event.preventDefault();
      return true;
    }
    return false;
  },
};

// Tycoon
type TycoonTile = {
  name: string;
  type: "start" | "property" | "chance" | "tax" | "bonus";
  price?: number;
  rent?: number;
  color?: string;
};
type TycoonPlayer = {
  side: Player;
  position: number;
  money: number;
};
type TycoonState = {
  players: [TycoonPlayer, TycoonPlayer];
  active: 0 | 1;
  owners: Record<number, Player>;
  dice: [number, number] | null;
  mode: PlayMode;
  phase: "roll" | "decision" | "end" | "gameover";
  pendingTile: number | null;
  winner: Player | null;
  turnNo: number;
  message: string;
  log: string[];
};

const tycoonTiles: TycoonTile[] = [
  { name: "猫窝", type: "start" },
  { name: "铃铛街", type: "property", price: 80, rent: 14, color: "#d9574f" },
  { name: "鱼干巷", type: "property", price: 90, rent: 16, color: "#e89b3c" },
  { name: "机会", type: "chance" },
  { name: "阳台路", type: "property", price: 110, rent: 20, color: "#5aa36f" },
  { name: "猫砂税", type: "tax" },
  { name: "纸箱港", type: "property", price: 130, rent: 24, color: "#3e91a3" },
  { name: "猫树坊", type: "property", price: 140, rent: 26, color: "#8d65b8" },
  { name: "小鱼干", type: "bonus" },
  { name: "月窗苑", type: "property", price: 150, rent: 28, color: "#d85d87" },
  { name: "机会", type: "chance" },
  { name: "暖垫街", type: "property", price: 160, rent: 30, color: "#c4a33d" },
  { name: "罐头湾", type: "property", price: 180, rent: 34, color: "#4f7bd9" },
  { name: "猫薄荷", type: "bonus" },
  { name: "花园道", type: "property", price: 190, rent: 36, color: "#4f9d7a" },
  { name: "体检费", type: "tax" },
  { name: "星砂路", type: "property", price: 210, rent: 40, color: "#bd6f48" },
  { name: "机会", type: "chance" },
  { name: "云被街", type: "property", price: 220, rent: 42, color: "#6c7ac9" },
  { name: "鱼市", type: "bonus" },
  { name: "尾巴城", type: "property", price: 240, rent: 48, color: "#bf4f6c" },
  { name: "猫砂税", type: "tax" },
  { name: "屋顶站", type: "property", price: 260, rent: 52, color: "#2c8f8f" },
  { name: "机会", type: "chance" },
];

function createTycoon(): TycoonState {
  return {
    players: [
      { side: "black", position: 0, money: 600 },
      { side: "white", position: 0, money: 600 },
    ],
    active: 0,
    owners: {},
    dice: null,
    mode: "ai",
    phase: "roll",
    pendingTile: null,
    winner: null,
    turnNo: 0,
    message: "人机模式，黑猫先投骰，你执黑。",
    log: [],
  };
}

function tycoonActive(state: TycoonState) {
  return state.players[state.active];
}

function tycoonPushLog(state: TycoonState, text: string) {
  state.log = [text, ...state.log].slice(0, 4);
}

function tycoonCheckWinner(state: TycoonState) {
  const broke = state.players.find((player) => player.money < 0);
  if (broke) {
    state.winner = other(broke.side);
    state.phase = "gameover";
    state.message = `${playerMeta[state.winner].name}资产领先。`;
    return;
  }
  if (state.turnNo >= 50) {
    const [a, b] = state.players;
    state.winner = a.money === b.money ? null : a.money > b.money ? a.side : b.side;
    state.phase = "gameover";
    state.message = state.winner ? `${playerMeta[state.winner].name}完成收官。` : "资产相同，平局。";
  }
}

function tycoonApplyTile(state: TycoonState) {
  const player = tycoonActive(state);
  const tile = tycoonTiles[player.position];
  if (tile.type === "start") {
    player.money += 60;
    state.phase = "end";
    state.message = `${playerMeta[player.side].name}回到猫窝，领取 60。`;
    tycoonPushLog(state, `${playerMeta[player.side].name}领取猫窝补给。`);
  } else if (tile.type === "property") {
    const owner = state.owners[player.position];
    if (!owner) {
      state.pendingTile = player.position;
      state.phase = "decision";
      state.message = `${tile.name} 可购买，价格 ${tile.price}。`;
    } else if (owner !== player.side) {
      const rent = tile.rent ?? 0;
      player.money -= rent;
      state.players.find((next) => next.side === owner)!.money += rent;
      state.phase = "end";
      state.message = `${playerMeta[player.side].name}支付 ${rent} 租金。`;
      tycoonPushLog(state, `${tile.name} 收租 ${rent}。`);
    } else {
      state.phase = "end";
      state.message = `${playerMeta[player.side].name}回到自己的 ${tile.name}。`;
    }
  } else if (tile.type === "tax") {
    player.money -= 45;
    state.phase = "end";
    state.message = `${playerMeta[player.side].name}缴纳猫砂税 45。`;
    tycoonPushLog(state, `${playerMeta[player.side].name}缴税。`);
  } else if (tile.type === "bonus") {
    player.money += 50;
    state.phase = "end";
    state.message = `${playerMeta[player.side].name}获得小鱼干 50。`;
    tycoonPushLog(state, `${playerMeta[player.side].name}收获补给。`);
  } else {
    const gain = Math.random() > 0.5 ? 70 : -35;
    player.money += gain;
    state.phase = "end";
    state.message = gain > 0 ? `${playerMeta[player.side].name}机会奖励 ${gain}。` : `${playerMeta[player.side].name}机会支出 ${Math.abs(gain)}。`;
    tycoonPushLog(state, `${tile.name} ${gain > 0 ? "+" : ""}${gain}。`);
  }
  tycoonCheckWinner(state);
}

function tycoonRoll(state: TycoonState) {
  if (state.phase !== "roll") return;
  const player = tycoonActive(state);
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;
  const oldPosition = player.position;
  player.position = (player.position + total) % tycoonTiles.length;
  if (oldPosition + total >= tycoonTiles.length) player.money += 80;
  state.dice = [d1, d2];
  state.turnNo += 1;
  tycoonPushLog(state, `${playerMeta[player.side].name}投出 ${d1}+${d2}。`);
  tycoonApplyTile(state);
}

function tycoonBuy(state: TycoonState) {
  if (state.phase !== "decision" || state.pendingTile === null) return;
  const player = tycoonActive(state);
  const tile = tycoonTiles[state.pendingTile];
  const price = tile.price ?? 0;
  if (player.money < price) {
    state.message = "现金不够，买不了。";
    return;
  }
  player.money -= price;
  state.owners[state.pendingTile] = player.side;
  state.message = `${playerMeta[player.side].name}买下 ${tile.name}。`;
  tycoonPushLog(state, `${playerMeta[player.side].name}购入 ${tile.name}。`);
  state.pendingTile = null;
  state.phase = "end";
  tycoonCheckWinner(state);
}

function tycoonDeclineBuy(state: TycoonState) {
  if (state.phase !== "decision" || state.pendingTile === null) return;
  const player = tycoonActive(state);
  const tile = tycoonTiles[state.pendingTile];
  state.pendingTile = null;
  state.phase = "end";
  state.message = `${playerMeta[player.side].name}暂不购买 ${tile.name}。`;
  tycoonPushLog(state, `${playerMeta[player.side].name}略过 ${tile.name}。`);
}

function tycoonShouldAiBuy(state: TycoonState) {
  if (state.pendingTile === null) return false;
  const player = tycoonActive(state);
  const tile = tycoonTiles[state.pendingTile];
  const price = tile.price ?? 0;
  const rent = tile.rent ?? 0;
  if (!price || player.money < price) return false;
  return player.money - price >= 100 || rent / price >= 0.18;
}

function tycoonIsGameOver(state: TycoonState) {
  return state.phase === "gameover";
}

function tycoonAiTurn(state: TycoonState) {
  if (state.mode !== "ai" || tycoonIsGameOver(state) || tycoonActive(state).side !== "white") return;
  for (let guard = 0; guard < 8 && !tycoonIsGameOver(state) && tycoonActive(state).side === "white"; guard += 1) {
    if (state.phase === "roll") tycoonRoll(state);
    else if (state.phase === "decision") {
      if (tycoonShouldAiBuy(state)) tycoonBuy(state);
      else tycoonDeclineBuy(state);
    } else if (state.phase === "end") tycoonEnd(state);
  }
  if (!tycoonIsGameOver(state) && tycoonActive(state).side === "black") {
    state.message = "白猫 AI 完成回合，轮到黑猫投骰。";
  }
}

function tycoonEnd(state: TycoonState) {
  if (state.phase === "gameover" || state.phase === "roll") return;
  state.pendingTile = null;
  state.active = state.active === 0 ? 1 : 0;
  state.phase = "roll";
  state.message = `${playerMeta[tycoonActive(state).side].name}投骰。`;
  tycoonAiTurn(state);
}

function tycoonSetMode(state: TycoonState, mode: PlayMode) {
  if (state.mode === mode) return;
  const fresh = createTycoon();
  Object.assign(state, fresh, {
    mode,
    message: mode === "ai" ? "人机模式，黑猫先投骰，你执黑。" : "真人对弈，黑猫先投骰。",
  });
  clearUndo("tycoon");
}

function tycoonTilePosition(index: number) {
  const unit = 82;
  const offset = 52;
  if (index <= 6) return { x: offset + index * unit, y: offset, w: unit, h: unit };
  if (index <= 11) return { x: offset + 6 * unit, y: offset + (index - 6) * unit, w: unit, h: unit };
  if (index <= 18) return { x: offset + (18 - index) * unit, y: offset + 6 * unit, w: unit, h: unit };
  return { x: offset, y: offset + (24 - index) * unit, w: unit, h: unit };
}

function renderTycoon(state: TycoonState) {
  const tiles = tycoonTiles
    .map((tile, index) => {
      const pos = tycoonTilePosition(index);
      const owner = state.owners[index];
      const color = tile.color ?? (tile.type === "tax" ? "#333846" : tile.type === "bonus" ? "#568f5d" : tile.type === "chance" ? "#945ca8" : "#d0c18c");
      return `
        <g class="tycoon-tile" data-tile="${index}">
          <rect x="${pos.x}" y="${pos.y}" width="${pos.w}" height="${pos.h}" rx="8" fill="${color}" />
          <rect class="tile-inner" x="${pos.x + 5}" y="${pos.y + 5}" width="${pos.w - 10}" height="${pos.h - 10}" rx="5" />
          ${owner ? `<circle class="owner-dot owner-${owner}" cx="${pos.x + pos.w - 15}" cy="${pos.y + 15}" r="7" />` : ""}
          <text class="tile-name" x="${pos.x + pos.w / 2}" y="${pos.y + 32}">${escapeHtml(tile.name)}</text>
          <text class="tile-price" x="${pos.x + pos.w / 2}" y="${pos.y + 57}">${tile.price ? `$${tile.price}` : tile.type === "start" ? "START" : ""}</text>
        </g>
      `;
    })
    .join("");
  const pieces = state.players
    .map((player, index) => {
      const pos = tycoonTilePosition(player.position);
      const sameSpot = state.players[0].position === state.players[1].position;
      const shift = sameSpot ? (index === 0 ? -16 : 16) : 0;
      return catPiece(player.side, pos.x + pos.w / 2 + shift, pos.y + pos.h / 2 + 14, 16);
    })
    .join("");
  const dice = state.dice ? `${state.dice[0]} + ${state.dice[1]}` : "待投";
  const moneyRows = state.players
    .map((player) => `<text class="money-text" x="205" y="${260 + (player.side === "white" ? 42 : 0)}">${playerMeta[player.side].name} $${player.money}</text>`)
    .join("");
  const logRows = state.log.map((item, index) => `<text class="log-text" x="205" y="${350 + index * 28}">${escapeHtml(item)}</text>`).join("");
  return svgBoard("tycoon-svg", "大富翁", 680, 680, `
    <rect class="board-bg city-bg" x="12" y="12" width="656" height="656" rx="18" />
    ${tiles}
    <rect class="tycoon-center" x="176" y="176" width="328" height="328" rx="18" />
    <text class="tycoon-title" x="340" y="230">猫猫大富翁</text>
    <text class="dice-text" x="340" y="292">骰子 ${dice}</text>
    ${moneyRows}
    ${logRows}
    ${pieces}
  `);
}

const tycoonGame: Game<TycoonState> = {
  id: "tycoon",
  name: "大富翁",
  badge: "掷骰",
  create: createTycoon,
  render: renderTycoon,
  controls: (state) =>
    `${modePicker("大富翁模式", "tycoonMode", state.mode)}${iconButton("roll", "⚂", "投骰", state.phase !== "roll")}${iconButton("buy", "◆", "购买", state.phase !== "decision")}${iconButton("end", "▶", "换猫", state.phase === "roll" || state.phase === "gameover")}${iconButton("reset", "↻", "重开")}`,
  handleCell: () => undefined,
  handleAction: (state, action) => {
    if (action === "tycoonMode:ai") tycoonSetMode(state, "ai");
    if (action === "tycoonMode:local") tycoonSetMode(state, "local");
    if (action === "roll") tycoonRoll(state);
    if (action === "buy") tycoonBuy(state);
    if (action === "end") tycoonEnd(state);
  },
  handleKey: (state, event) => {
    const key = event.key.toLowerCase();
    if (key === "d") {
      tycoonRoll(state);
      event.preventDefault();
      return true;
    }
    if (key === "b") {
      tycoonBuy(state);
      event.preventDefault();
      return true;
    }
    if (key === "n") {
      tycoonEnd(state);
      event.preventDefault();
      return true;
    }
    return false;
  },
};

type GameStateMap = {
  gomoku: GomokuState;
  go: GoState;
  xiangqi: XiangqiState;
  jump: JumpState;
  tycoon: TycoonState;
};
type UndoStacks = { [K in GameId]: string[] };

const gameDefs: { [K in GameId]: Game<GameStateMap[K]> } = {
  gomoku: gomokuGame,
  go: goGame,
  xiangqi: xiangqiGame,
  jump: jumpGame,
  tycoon: tycoonGame,
};

const gameOrder: GameId[] = ["gomoku", "go", "xiangqi", "jump", "tycoon"];

const appState: { active: GameId; catStyle: CatStyle; states: GameStateMap; undoStacks: UndoStacks } = {
  active: "gomoku",
  catStyle: "drawn",
  states: {
    gomoku: gomokuGame.create(),
    go: goGame.create(),
    xiangqi: xiangqiGame.create(),
    jump: jumpGame.create(),
    tycoon: tycoonGame.create(),
  },
  undoStacks: {
    gomoku: [],
    go: [],
    xiangqi: [],
    jump: [],
    tycoon: [],
  },
};

function activeGame(): Game<any> {
  return gameDefs[appState.active] as Game<any>;
}

function activeState(): any {
  return appState.states[appState.active];
}

function getActiveTurn() {
  const state = activeState();
  if (appState.active === "tycoon") return (tycoonActive(state as TycoonState).side ?? "black") as Player;
  return (state.turn ?? "black") as Player;
}

function getMessage() {
  const state = activeState();
  return String(state.message ?? "");
}

function clearUndo(id: GameId) {
  appState.undoStacks[id] = [];
}

function snapshotState(id: GameId) {
  const state = JSON.parse(JSON.stringify(appState.states[id]));
  if (id === "xiangqi") state.selected = null;
  if (id === "jump" && !state.mustContinue) state.selected = null;
  return JSON.stringify(state);
}

function materialSnapshot(id: GameId) {
  const state = JSON.parse(JSON.stringify(appState.states[id]));
  delete state.cursor;
  delete state.message;
  if (id === "xiangqi") delete state.selected;
  if (id === "jump" && !state.mustContinue) delete state.selected;
  return JSON.stringify(state);
}

function pushUndoSnapshot(id: GameId, snapshot: string, beforeMaterial: string) {
  if (beforeMaterial === materialSnapshot(id)) return;
  const stack = appState.undoStacks[id];
  stack.push(snapshot);
  if (stack.length > 80) stack.shift();
}

function mutateActiveWithUndo(mutator: () => void) {
  const id = appState.active;
  const before = snapshotState(id);
  const beforeMaterial = materialSnapshot(id);
  mutator();
  pushUndoSnapshot(id, before, beforeMaterial);
}

function undoActive() {
  const id = appState.active;
  const snapshot = appState.undoStacks[id].pop();
  if (!snapshot) {
    const state = activeState();
    if ("message" in state) state.message = "没有可悔的棋。";
    return;
  }
  appState.states[id] = JSON.parse(snapshot) as never;
  const state = activeState();
  if ("message" in state) state.message = "已悔棋。";
}

function hasActiveUndo() {
  return appState.undoStacks[appState.active].length > 0;
}

function introMessage(id: GameId, mode: PlayMode) {
  if (id === "gomoku") return mode === "ai" ? "人机模式，黑猫先手。" : "双人模式，黑猫先手。";
  if (id === "go") return mode === "ai" ? "人机模式，黑猫先手，你执黑。" : "真人对弈，黑猫先手。";
  if (id === "xiangqi") return mode === "ai" ? "人机模式，你执白猫先行。" : "真人对弈，白猫先行。";
  if (id === "jump") return mode === "ai" ? "人机模式，黑猫先跳，你执黑。" : "真人对弈，黑猫先跳。";
  return mode === "ai" ? "人机模式，黑猫先投骰，你执黑。" : "真人对弈，黑猫先投骰。";
}

function resetActive() {
  const id = appState.active;
  const previous = appState.states[id];
  const next = gameDefs[id].create();
  if ("mode" in previous && "mode" in next) {
    const mode = previous.mode as PlayMode;
    (next as { mode: PlayMode; message: string }).mode = mode;
    (next as { mode: PlayMode; message: string }).message = introMessage(id, mode);
  }
  appState.states[id] = next as never;
}

function renderApp() {
  const game = activeGame();
  const state = activeState();
  const activeTurn = getActiveTurn();
  appRoot.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="brand-mark" aria-hidden="true">
          ${duoCatIcon()}
        </div>
        <div class="brand-copy">
          <p class="eyebrow">SVG BOARD GAMES</p>
          <h1>猫猫棋局</h1>
        </div>
      </header>
      <nav class="game-tabs" aria-label="游戏选择">
        ${gameOrder
          .map((id, index) => {
            const item = gameDefs[id];
            return `
              <button class="game-tab ${id === appState.active ? "is-active" : ""}" data-game="${id}" aria-pressed="${id === appState.active}">
                <span class="tab-number">${index + 1}</span>
                <span class="tab-name">${item.name}</span>
                <span class="tab-badge">${item.badge}</span>
              </button>
            `;
          })
          .join("")}
      </nav>
      <main class="play-layout">
        <section class="board-stage">
          ${game.render(state)}
        </section>
        <aside class="side-panel">
          <div class="matchup">
            ${turnChip(activeTurn)}
            <div class="versus">VS</div>
            ${turnChip(other(activeTurn))}
          </div>
          <div class="status-panel">
            <p class="status-title">${game.name}</p>
            <p class="status-message">${escapeHtml(getMessage())}</p>
          </div>
          <div class="controls">
            ${catStylePicker()}
            ${iconButton("undo", "↶", "悔棋", !hasActiveUndo())}
            ${game.controls(state)}
          </div>
          <div class="cat-legend">
            <div>${catIcon("black")}<span>短毛黑猫 · 黄眼睛</span></div>
            <div>${catIcon("white")}<span>长毛白猫 · 淡黄眼睛</span></div>
          </div>
        </aside>
      </main>
    </div>
  `;
  requestAnimationFrame(() => {
    const board = document.querySelector<SVGElement>("[data-board]");
    board?.focus({ preventScroll: true });
  });
}

function closestElement(target: EventTarget | null, selector: string) {
  return target instanceof Element ? target.closest<HTMLElement>(selector) : null;
}

appRoot.addEventListener("click", (event) => {
  const gameButton = closestElement(event.target, "[data-game]");
  if (gameButton?.dataset.game) {
    appState.active = gameButton.dataset.game as GameId;
    renderApp();
    return;
  }
  const actionButton = closestElement(event.target, "[data-action]") as HTMLButtonElement | null;
  if (actionButton?.dataset.action && !actionButton.disabled) {
    const action = actionButton.dataset.action;
    if (action === "undo") undoActive();
    else if (action === "reset") mutateActiveWithUndo(resetActive);
    else if (action.startsWith("catStyle:")) {
      const style = action.split(":")[1] as CatStyle;
      if (style === "drawn" || style === "photo" || style === "family") appState.catStyle = style;
    } else if (action.includes("Mode:")) activeGame().handleAction(activeState(), action);
    else mutateActiveWithUndo(() => activeGame().handleAction(activeState(), action));
    renderApp();
    return;
  }
  const cell = closestElement(event.target, "[data-cell]");
  if (cell?.dataset.cell) {
    const { row, col } = parseCell(cell.dataset.cell);
    const state = activeState();
    if ("cursor" in state) state.cursor = { row, col };
    mutateActiveWithUndo(() => activeGame().handleCell(state, row, col));
    renderApp();
  }
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z") {
    undoActive();
    event.preventDefault();
    renderApp();
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const number = Number(key);
  if (number >= 1 && number <= gameOrder.length) {
    appState.active = gameOrder[number - 1];
    event.preventDefault();
    renderApp();
    return;
  }
  if (key === "r") {
    mutateActiveWithUndo(resetActive);
    event.preventDefault();
    renderApp();
    return;
  }
  if (key === "u" || key === "z") {
    undoActive();
    event.preventDefault();
    renderApp();
    return;
  }
  if (event.key.startsWith("Arrow")) {
    if (activeGame().handleKey(activeState(), event)) renderApp();
    return;
  }
  if (mutateKeyWithUndo(event)) renderApp();
});

function mutateKeyWithUndo(event: KeyboardEvent) {
  const id = appState.active;
  const before = snapshotState(id);
  const beforeMaterial = materialSnapshot(id);
  const handled = activeGame().handleKey(activeState(), event);
  if (handled) pushUndoSnapshot(id, before, beforeMaterial);
  return handled;
}

renderApp();
