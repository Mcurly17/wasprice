// State of a write button. Pure: tested with node:test. The button is enabled only when
// the wallet is connected, the inputs are valid and the contract's preview said "".

export interface ButtonInput {
  connected: boolean;
  busy: boolean;
  /** Local validation error (window, price format, URL), "" when none. */
  localError: string;
  /** undefined while the preview is loading; "" when the contract would accept the call. */
  preview: string | undefined;
  /** The preview could not be read. */
  previewFailed?: boolean;
}

export interface ButtonState {
  enabled: boolean;
  reason: string;
}

export function buttonState(input: ButtonInput): ButtonState {
  if (input.busy) return { enabled: false, reason: "A transaction is in progress." };
  if (!input.connected) return { enabled: false, reason: "Connect a wallet to sign." };
  if (input.localError !== "") return { enabled: false, reason: input.localError };
  if (input.previewFailed) return { enabled: false, reason: "The contract could not be asked. Nothing will be sent." };
  if (input.preview === undefined) return { enabled: false, reason: "Asking the contract…" };
  if (input.preview !== "") return { enabled: false, reason: `The contract would refuse this call: ${input.preview}` };
  return { enabled: true, reason: "" };
}

/** The capture field accepts a Wayback link or a bare 14-digit timestamp. */
export function captureTs(input: string, parse: (link: string) => { ts: string; url: string } | null): string {
  const link = parse(input);
  return link ? link.ts : input.trim();
}

/** Same page, ignoring a trailing slash and the host case. */
export function samePage(a: string, b: string): boolean {
  const norm = (u: string) => u.trim().replace(/^(https?:\/\/)([^/]+)/i, (_, s: string, h: string) => s.toLowerCase() + h.toLowerCase()).replace(/\/$/, "");
  return norm(a) === norm(b);
}
