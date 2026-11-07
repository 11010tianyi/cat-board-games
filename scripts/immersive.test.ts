import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyImmersiveFullscreen, immersiveAfterGameChange, immersiveEscape, shellClassName } from "../src/immersive.ts";
import { gameTest } from "../src/main.ts";

test("immersive mode is entered from the shell and left with the exit control or Escape", () => {
  gameTest.resetShell();
  assert.equal(gameTest.isImmersive(), false);
  assert.equal(shellClassName(false), "app-shell");
  assert.equal(immersiveEscape(false, "Escape"), false);
  const closed = gameTest.shellHtml();
  assert.match(closed, /data-immersive-toggle/);
  assert.match(closed, />沉浸</);
  assert.doesNotMatch(closed, /is-immersive/);
  assert.doesNotMatch(closed, /data-immersive-exit/);

  gameTest.setImmersive(true);
  assert.equal(gameTest.isImmersive(), true);
  assert.equal(immersiveAfterGameChange(true), true);
  const open = gameTest.shellHtml();
  assert.match(open, /class="app-shell is-immersive"/);
  assert.match(open, /data-immersive-exit/);
  assert.match(open, /退出 · Esc/);
  assert.match(open, /data-action="undo"/);
  assert.match(open, /data-music-slot/);

  for (const id of ["go", "xiangqi", "gomoku"] as const) {
    gameTest.selectGame(id);
    assert.equal(gameTest.isImmersive(), true);
    assert.match(gameTest.shellHtml(), new RegExp(`data-game="${id}" aria-pressed="true"`));
    assert.match(gameTest.shellHtml(), /class="app-shell is-immersive"/);
  }

  assert.equal(gameTest.pressEscape(), true);
  assert.equal(gameTest.isImmersive(), false);
  assert.doesNotMatch(gameTest.shellHtml(), /is-immersive/);
  assert.equal(immersiveEscape(true, "Enter"), false);

  gameTest.setImmersive(true);
  gameTest.setImmersive(false);
  assert.equal(gameTest.isImmersive(), false);
});

test("fullscreen is optional and the stylesheet still hides chrome", () => {
  let requested = 0;
  let exited = 0;
  applyImmersiveFullscreen(true, {
    request() {
      requested += 1;
    },
    exit() {
      throw new Error("exit should wait");
    },
  });
  applyImmersiveFullscreen(false, {
    request() {
      throw new Error("request should wait");
    },
    exit() {
      exited += 1;
    },
  });
  assert.equal(requested, 1);
  assert.equal(exited, 1);
  assert.doesNotThrow(() => {
    applyImmersiveFullscreen(true, {
      request() {
        throw new Error("fullscreen unavailable");
      },
      exit() {},
    });
    applyImmersiveFullscreen(true, null);
  });

  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /viewport-fit=cover/);
  for (const selector of [".app-header", ".game-tabs", ".music-slot", ".matchup", ".cat-legend", ".option-group"]) {
    assert.match(css, new RegExp(`\\.app-shell\\.is-immersive ${selector.replace(".", "\\.")}`));
  }
  assert.match(css, /100dvh/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(css, /data-immersive-exit|immersive-exit/);
});
