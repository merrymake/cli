import { stdin } from "node:process";
import { initializeArgs } from "./args";
import { CTRL_C, exit } from "./prompt";
import { abort, checkVersion, setDryrun } from "./utils";
import { addKnownHost } from "./newCommands/register";
import { index } from "./newCommands";

// if (!stdin.isTTY || stdin.setRawMode === undefined) {
//   console.log(
//     "This console does not support TTY, please use 'winpty mm' or the 'mmk'-command instead."
//   );
//   process.exit(1);
// }

// TODO make type for command

// if (
//   process.argv[0]
//     .substring(process.argv[0].lastIndexOf(path.sep) + 1)
//     .startsWith("node")
// )
process.argv.splice(0, 1);
process.argv.splice(0, 1);
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
  stdin.setEncoding("utf8");
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
  checkVersion();
  const token: never = await index();
})().catch((e) => {
  exit();
  if (("" + e).includes("Permission denied")) {
    addKnownHost();
    console.log(
      "\x1b[31mAn error occurred, please try again. If the problem persists reach out on http://discord.merrymake.eu \x1b[0m",
      e
    );
  }
  console.log(`\x1b[31mERROR ${e.toString().trimEnd()}\x1b[0m`);
  process.exit(0);
});
