import { register } from "node:module";

register("./css-hooks.mjs", import.meta.url);

class FakeElement {
  constructor() {
    this.innerHTML = "";
  }

  addEventListener() {}

  querySelector() {
    return null;
  }

  focus() {}
}

const app = new FakeElement();

globalThis.document = {
  querySelector(selector) {
    return selector === "#app" ? app : null;
  },
  addEventListener() {},
};

globalThis.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};

globalThis.Element = class Element {};
