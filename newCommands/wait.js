import { choice } from "../prompt.js";
export async function wait(text, action) {
    try {
        return choice([{ long: "continue", text: "continue", action }], async () => {
            return { options: [], header: text };
        }, {
            disableAutoPick: true,
        });
    }
    catch (e) {
        throw e;
    }
}
