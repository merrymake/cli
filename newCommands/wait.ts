import { choice } from "../prompt";

export async function wait(text: string, action: () => Promise<never>) {
  try {
    return choice(text, [{ long: "continue", text: "continue", action }], {
      disableAutoPick: true,
    });
  } catch (e) {
    throw e;
  }
}
