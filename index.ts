import { stdin } from "node:process";
import { initializeArgs } from "./args.js";
import { abort, setDryrun } from "./exitMessages.js";
import { index } from "./newCommands/index.js";
import { addKnownHost } from "./newCommands/register.js";
import { CTRL_C, moveToBottom, NORMAL_COLOR, RED } from "./prompt.js";
import {
  checkVersionIfOutdated,
  outputGit,
  package_json,
} from "./printUtils.js";

process.argv.splice(0, 1); // Remove node
process.argv.splice(0, 1); // Remove index
if (process.argv.length > 0 && process.argv[0].endsWith("version")) {
  console.log(package_json.version);
  process.exit(0);
}
if (process.argv[0] === "dryrun") {
  setDryrun();
  process.argv.splice(0, 1);
}
initializeArgs(
  process.argv.flatMap((x) =>
    x.startsWith("-")
      ? x
          .substring(1)
          .split("")
          .map((x) => `-${x}`)
      : [x]
  )
);

if (stdin.isTTY) {
  // without this, we would only get streams once enter is pressed
  stdin.setRawMode(true);

  // resume stdin in the parent process (node app won't quit all by itself
  // unless an error or process.exit() happens)
  stdin.resume();
  // i don't want binary, do you?
  // stdin.setEncoding("utf8");
  // You can always exit with crtl-c
  stdin.on("data", (key) => {
    const k = key.toString();
    if (k === CTRL_C) {
      abort();
    }
  });
}

// TODO Change join to invite
// TODO roles

(async () => {
  checkVersionIfOutdated();
  const token: never = await index();
})().catch((e) => {
  moveToBottom();
  const eStr = "" + e;
  if (eStr.includes("Permission denied (publickey)")) {
    addKnownHost();
    outputGit(
      `A permission error occurred. Please try these solutions:
1. Make sure you have registered the device with the correct email using 'mm start'
2. Run 'mm help'
3. Run this command again.
4. If the problem persists reach out on http://discord.merrymake.eu` +
        NORMAL_COLOR
    );
  } else {
    console.error(`\x1b[31mERROR ${eStr.trimEnd()}\x1b[0m`);
  }
  abort();
});
