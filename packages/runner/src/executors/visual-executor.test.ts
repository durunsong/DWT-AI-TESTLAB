import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "playwright";
import { VisualExecutor } from "./visual-executor";

interface FakeElement {
  id: string;
  style: Record<string, string>;
  className: string;
  children: FakeElement[];
  textContent: string;
  innerHTMLAssigned: boolean;
  innerHTML: string;
  appendChild: (child: FakeElement) => void;
  replaceChildren: (...children: FakeElement[]) => void;
  remove: () => undefined;
}

test("renders visual step panel text without assigning html", async () => {
  const panel = createFakeElement("ai-e2e-step-panel");
  const fakeDocument = createFakeDocument(panel);
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    value: fakeDocument,
    configurable: true
  });

  const page = {
    addStyleTag: async () => undefined,
    evaluate: async (fn: (input: unknown) => void, input?: unknown) => fn(input)
  } as unknown as Page;

  try {
    await new VisualExecutor(true).updateStep(page, {
      step_id: "xss_step",
      name: "<img src=x onerror=alert(1)>",
      type: "web_click",
      session: "user"
    } as never, "running");

    assert.equal(panel.innerHTMLAssigned, false);
    assert.equal(panel.textContent, "<img src=x onerror=alert(1)>web_click · user · running");
  } finally {
    Object.defineProperty(globalThis, "document", {
      value: previousDocument,
      configurable: true
    });
  }
});

function createFakeElement(id: string): FakeElement {
  return {
    id,
    style: {} as Record<string, string>,
    className: "",
    children: [],
    textContent: "",
    innerHTMLAssigned: false,
    set innerHTML(_value: string) {
      this.innerHTMLAssigned = true;
    },
    appendChild(child: FakeElement) {
      this.children.push(child);
      this.textContent += child.textContent;
    },
    replaceChildren(...children: FakeElement[]) {
      this.children = children;
      this.textContent = children.map((child) => child.textContent).join("");
    },
    remove() {
      return undefined;
    }
  };
}

function createFakeDocument(panel: FakeElement) {
  const elements = new Map<string, FakeElement>([
    [panel.id, panel]
  ]);
  const body = {
    appendChild(element: FakeElement) {
      elements.set(element.id, element);
    }
  };

  return {
    body,
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
    createElement(tagName: string) {
      return createFakeElement(tagName);
    }
  } as unknown as Document;
}
