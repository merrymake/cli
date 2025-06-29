import { BLUE, exit, NORMAL_COLOR, output } from "./prompt.js";

const toExecute: (() => Promise<unknown>)[] = [];
let dryrun = false;

export function setDryrun() {
  output(`${BLUE}Dryrun mode, changes will not be performed.${NORMAL_COLOR}`);
  dryrun = true;
}
export function addToExecuteQueue(f: () => Promise<unknown>) {
  if (!dryrun) toExecute.push(f);
}

let printOnExit: string[] = [];
export function addExitMessage(str: string) {
  printOnExit.push(str);
}
function printExitMessages() {
  printOnExit.forEach((x) => output(x + "\n"));
}
export function abort(): never {
  exit();
  printExitMessages();
  process.exit(1);
}
export async function finish(): Promise<never> {
  try {
    exit();
    for (let i = 0; i < toExecute.length; i++) {
      await toExecute[i]();
    }
    printExitMessages();
    process.exit(0);
  } catch (e) {
    throw e;
  }
}
export function TODO(): never {
  console.log("TODO");
  exit();
  process.exit(0);
}
