import { Str } from "@merrymake/utils";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";

const EOL_COMMENT_CHAR = "//";
const configFolder = homedir() + "/.merrymake/";
const configFile = configFolder + "config";
const configLine: { [key: string]: number } = {};
const config: { [key: string]: string } = {};
const fileContent: [string, string, string][] = [];
const configReady: Promise<void> = (async () => {
  if (!existsSync(configFolder)) await mkdir(configFolder);
  if (existsSync(configFile))
    (await readFile(configFile, "utf-8")).split("\n").forEach((line, index) => {
      const [assignment, comment] = Str.partitionLeft(line, EOL_COMMENT_CHAR);
      const [key, value] = Str.partitionLeft(assignment, "=");
      fileContent.push([key, value, comment]);
      if (key.length > 0) {
        config[key] = value;
        configLine[key] = index;
      }
    });
})();
let configWriteFinished: Promise<void> = Promise.resolve();
export function waitForConfigWrite() {
  return configWriteFinished;
}
export async function getConfig(key: string) {
  if (config[key] !== undefined) return config[key];
  await configReady;
  return config[key];
}

export function setConfig(entries: { [key: string]: string }) {
  Object.entries(entries).forEach(([k, v]) => (entries[k] = v));
  configWriteFinished = configWriteFinished.then(async () => {
    await configReady;
    Object.entries(entries).forEach(([k, v]) => {
      if (configLine[k] === undefined) fileContent.push([k, v, ""]);
      else fileContent[configLine[k]][1] = v;
    });
    await writeFile(
      configFile,
      fileContent
        .map(
          (line) =>
            `${line[0].length > 0 ? line[0] + "=" : ""}${line[1]}${
              line[2].length > 0 ? "//" + line[2] : ""
            }`
        )
        .join("\n")
    );
  });
}
