import { Promise_all } from "@merrymake/utils";
import { exit, output } from "./prompt.js";
import { waitForConfigWrite } from "./persistance.js";
let printOnExit = [];
export function addExitMessage(str) {
    printOnExit.push(str);
}
function printExitMessages() {
    printOnExit.forEach((x) => output(x + "\n"));
}
export async function finish(code = 0) {
    exit();
    console.log();
    printExitMessages();
    await Promise_all(waitForConfigWrite());
    process.exit(code);
}
export function TODO() {
    console.log("TODO");
    return finish(1);
}
