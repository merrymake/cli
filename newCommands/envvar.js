import { MerrymakeCrypto } from "@merrymake/secret-lib";
import fs from "fs";
import { GIT_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { Visibility, choice, shortText } from "../prompt.js";
import { execPromise, sshReq } from "../utils.js";
import { outputGit } from "../printUtils.js";
async function do_envvar(pathToOrganization, organizationId, serviceGroupId, key, value, access, encrypted) {
    const keyFolder = pathToOrganization.with(".merrymake").with(".key");
    try {
        let val;
        if (encrypted === true) {
            const repoBase = `${GIT_HOST}/o${organizationId.toString()}/g${serviceGroupId.toString()}/.key`;
            fs.rmSync(keyFolder.toString(), { force: true, recursive: true });
            await execPromise(`git clone -q "${repoBase}"`, pathToOrganization.with(".merrymake").toString());
            const key = fs.readFileSync(keyFolder.with("merrymake.key").toString());
            val = new MerrymakeCrypto()
                .encrypt(Buffer.from(value), key)
                .toString("base64");
        }
        else {
            val = value;
        }
        outputGit(await sshReq(`envvar-set`, key, ...access, `--serviceGroupId`, serviceGroupId.toString(), `--value`, val, ...(encrypted ? ["--encrypted"] : [])));
    }
    catch (e) {
        throw e;
    }
    finally {
        fs.rmSync(keyFolder.toString(), {
            force: true,
            recursive: true,
        });
    }
}
function envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, access, secret) {
    addToExecuteQueue(() => do_envvar(pathToOrganization, organizationId, serviceGroupId, key, value, access, secret));
    return finish();
}
function envvar_key_visible_value(pathToOrganization, organizationId, serviceGroupId, key, value, secret, init, prod) {
    return choice("Where would you like the variable to be visible?", [
        {
            long: "both",
            short: "b",
            text: "accessible in both prod and init run",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction", "--inInitRun"], secret),
        },
        {
            long: "prod",
            short: "p",
            text: "accessible in prod",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction"], secret),
        },
        {
            long: "init",
            short: "i",
            text: "accessible in the init run",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inInitRun"], secret),
        },
    ], { def: init ? (prod ? 0 : 2) : 1 });
}
async function envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, secret, init, prod) {
    try {
        const value = await shortText("Value", "The value...", "", secret === true ? { hide: Visibility.Secret } : undefined).then();
        if (value !== "")
            return envvar_key_visible_value(pathToOrganization, organizationId, serviceGroupId, key, value, secret, init, prod);
        else
            return envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, value, ["--inProduction", "--inInitRun"], false);
    }
    catch (e) {
        throw e;
    }
}
function envvar_key(pathToOrganization, organizationId, serviceGroupId, key, secret, init, prod) {
    return choice("What is the visibility of the variable?", [
        {
            long: "secret",
            short: "s",
            text: "the value is secret",
            action: () => envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, true, init, prod),
        },
        {
            long: "public",
            short: "p",
            text: "the value is public",
            action: () => envvar_key_visible(pathToOrganization, organizationId, serviceGroupId, key, false, init, prod),
        },
        {
            long: "delete",
            short: "d",
            text: "delete the environment variable",
            action: () => envvar_key_value_access_visible(pathToOrganization, organizationId, serviceGroupId, key, "", ["--inProduction", "--inInitRun"], false),
        },
    ], { def: secret ? 0 : 1 });
}
async function envvar_new(pathToOrganization, organizationId, serviceGroupId) {
    try {
        const key = await shortText("Key", "Key for the key-value pair", "key").then();
        return envvar_key(pathToOrganization, organizationId, serviceGroupId, key, true, true, true);
    }
    catch (e) {
        throw e;
    }
}
export async function envvar(pathToOrganization, organizationId, serviceGroupId) {
    try {
        const resp = await sshReq(`envvar-list`, serviceGroupId.toString());
        const orgs = JSON.parse(resp);
        const options = orgs.map((x) => ({
            long: x.k,
            text: `[${x.i ? "I" : " "}${x.p ? "P" : " "}] ${x.k}: ${x.v}`,
            action: () => envvar_key(pathToOrganization, organizationId, serviceGroupId, x.k, x.s, x.i, x.p),
        }));
        options.push({
            long: `new`,
            short: `n`,
            text: `add a new environment variable`,
            action: () => envvar_new(pathToOrganization, organizationId, serviceGroupId),
        });
        return await choice("Which environment variable would you like to edit?", options).then();
    }
    catch (e) {
        throw e;
    }
}
