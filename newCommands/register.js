import { existsSync } from "fs";
import os from "os";
import { API_URL, FINGERPRINT, HTTP_HOST, SSH_USER } from "../config.js";
import { addExitMessage } from "../exitMessages.js";
import { choice, NORMAL_COLOR, output, shortText, YELLOW, } from "../prompt.js";
import { execPromise, getFiles, Path, urlReq } from "../utils.js";
import { orgAction } from "./org.js";
import { wait } from "./wait.js";
import { appendFile, mkdir, readFile, writeFile } from "fs/promises";
async function saveSSHConfig(path) {
    try {
        let lines = [];
        let changed = false;
        let foundHost = false;
        if (existsSync(`${os.homedir()}/.ssh/config`)) {
            lines = (await readFile(`${os.homedir()}/.ssh/config`, "utf-8")).split("\n");
            let inHost = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if ((line.startsWith("\t") || line.startsWith(" ")) && inHost) {
                    if (line.includes("User ") && !line.includes(`User ${SSH_USER}`)) {
                        lines[i] =
                            line.substring(0, line.indexOf("User ")) + `User ${SSH_USER}`;
                        changed = true;
                    }
                    else if (line.includes("IdentityFile ") &&
                        !line.includes(`IdentityFile ~/.ssh/${path}`)) {
                        lines[i] =
                            line.substring(0, line.indexOf("IdentityFile ")) +
                                `IdentityFile ~/.ssh/${path}`;
                        changed = true;
                    }
                }
                else if (line.startsWith("\t") || line.startsWith(" ")) {
                }
                else if (line.startsWith(`Host ${API_URL}`)) {
                    inHost = true;
                    foundHost = true;
                }
                else {
                    inHost = false;
                }
            }
        }
        if (!foundHost) {
            lines.unshift(`Host ${API_URL}`, `\tUser ${SSH_USER}`, `\tHostName ${API_URL}`, `\tPreferredAuthentications publickey`, `\tIdentityFile ~/.ssh/${path}\n`);
            changed = true;
        }
        if (changed) {
            output(`Saving key preference...\n`);
            if (!existsSync(os.homedir() + "/.ssh"))
                await mkdir(os.homedir() + "/.ssh");
            await writeFile(`${os.homedir()}/.ssh/config`, lines.join("\n"));
        }
    }
    catch (e) {
        throw e;
    }
}
export async function useExistingKey(path) {
    try {
        saveSSHConfig(path);
        output(`Reading ${path}.pub...\n`);
        return {
            key: await readFile(os.homedir() + `/.ssh/${path}.pub`, "utf-8"),
            keyFile: path,
        };
    }
    catch (e) {
        throw e;
    }
}
export async function generateNewKey() {
    try {
        output(`Generating new ssh key...\n`);
        if (!existsSync(os.homedir() + "/.ssh"))
            await mkdir(os.homedir() + "/.ssh");
        await execPromise(`ssh-keygen -t rsa -b 4096 -f "${os.homedir()}/.ssh/merrymake" -N ""`);
        saveSSHConfig("merrymake");
        return {
            key: await readFile(os.homedir() + "/.ssh/merrymake.pub", "utf-8"),
            keyFile: "merrymake",
        };
    }
    catch (e) {
        throw e;
    }
}
export async function addKnownHost() {
    try {
        let isKnownHost = false;
        if (existsSync(`${os.homedir()}/.ssh/known_hosts`)) {
            const lines = (await readFile(`${os.homedir()}/.ssh/known_hosts`, "utf-8")).split("\n");
            isKnownHost = lines.some((x) => x.includes(`${API_URL} ssh-ed25519 ${FINGERPRINT}`));
        }
        if (!isKnownHost) {
            output("Adding fingerprint...\n");
            if (!existsSync(os.homedir() + "/.ssh"))
                await mkdir(os.homedir() + "/.ssh");
            await appendFile(`${os.homedir()}/.ssh/known_hosts`, `\n${API_URL} ssh-ed25519 ${FINGERPRINT}\n`);
        }
    }
    catch (e) {
        throw e;
    }
}
export async function do_register(keyAction, email) {
    try {
        const { key, keyFile } = await keyAction();
        addKnownHost();
        if (email === "") {
            addExitMessage(`Notice: Anonymous accounts are automatically deleted permanently after ~2 weeks, without warning. To add an email and avoid automatic deletion, run the command:
        ${YELLOW}${process.env["COMMAND"]} register ${keyFile}${NORMAL_COLOR}`);
        }
        output(`Registering ${email === "" ? "anonymous account" : email}...\n`);
        const result = await urlReq(`${HTTP_HOST}/admin/user`, "POST", JSON.stringify({
            email,
            key,
        }));
        if (result.code !== 200)
            throw result.body;
        const needsVerify = result.body === "true";
        return needsVerify
            ? wait("Click the button in the email before continuing", orgAction)
            : orgAction();
    }
    catch (e) {
        throw e;
    }
}
async function register_key(keyAction) {
    try {
        const email = await shortText("Email", "By attaching an email you'll be notified in case of changes for your organizations.", "").then();
        return do_register(keyAction, email);
    }
    catch (e) {
        throw e;
    }
}
async function register_manual() {
    try {
        const key = await shortText("Public key", "", "ssh-rsa ...").then();
        return register_key(() => Promise.resolve({
            key,
            keyFile: `add "${key}"`,
        }));
    }
    catch (e) {
        throw e;
    }
}
export async function register() {
    try {
        return await choice([
            {
                long: "add",
                short: "a",
                text: "manually add a key",
                action: () => register_manual(),
            },
        ], async () => {
            const keyfiles = (await getFiles(new Path(`${os.homedir()}/.ssh`))).filter((x) => x.endsWith(".pub"));
            const keys = keyfiles.map((x) => {
                const f = x.substring(0, x.length - ".pub".length);
                return {
                    long: f,
                    text: `use the key ${f}`,
                    action: () => register_key(() => useExistingKey(f)),
                };
            });
            let def = keyfiles.indexOf("merrymake.pub");
            if (def < 0) {
                keys.push({
                    long: "new",
                    short: "n",
                    text: "setup a new key specifically for Merrymake",
                    action: () => register_key(generateNewKey),
                });
                def = keys.length - 1;
            }
            return {
                options: keys,
                header: "Which SSH key would you like to use?",
                def,
            };
        }, {
            invertedQuiet: { cmd: false },
        }).then();
    }
    catch (e) {
        throw e;
    }
}
