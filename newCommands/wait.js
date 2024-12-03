import { choice } from "../prompt.js";
export async function wait(text, action) {
    try {
        return choice(text, [{ long: "continue", text: "continue", action }], {
            disableAutoPick: true,
        });
    }
    catch (e) {
        throw e;
    }
}
