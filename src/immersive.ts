export type FullscreenControls = {
  request: () => void;
  exit: () => void;
};

export function shellClassName(on: boolean) {
  return on ? "app-shell is-immersive" : "app-shell";
}

export function immersiveEscape(on: boolean, key: string) {
  return on && (key === "Escape" || key === "Esc");
}

export function immersiveAfterGameChange(on: boolean) {
  return on;
}

export function applyImmersiveFullscreen(on: boolean, controls: FullscreenControls | null) {
  if (!controls) return;
  try {
    if (on) controls.request();
    else controls.exit();
  } catch {
    // Fullscreen is optional. The is-immersive class is what hides the chrome.
  }
}
