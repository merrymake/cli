import { optimisticMimeTypeOf } from "@merrymake/ext2mime";
import { RAPIDS_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { choice, shortText } from "../prompt.js";
import { sshReq, urlReq } from "../utils.js";
import { key_create } from "./apikey.js";
import { outputGit } from "../printUtils.js";
import { readdir, readFile } from "fs/promises";
export async function do_post(eventType, key, contentType, payload) {
    try {
        outputGit(`Sending POST request to ${RAPIDS_HOST}/${key}/${eventType}`);
        const resp = await urlReq(`${RAPIDS_HOST}/${key}/${eventType}`, "POST", payload, contentType);
        outputGit(resp.body);
    }
    catch (e) {
        throw e;
    }
}
export async function do_post_file(eventType, key, filename) {
    try {
        const content = await readFile(filename, "utf-8");
        const type = optimisticMimeTypeOf(filename.substring(filename.lastIndexOf(".") + 1));
        if (type === null)
            throw "Could not determine content type";
        outputGit(`Sending POST request to ${RAPIDS_HOST}/${key}/${eventType}`);
        const resp = await urlReq(`${RAPIDS_HOST}/${key}/${eventType}`, "POST", content, type.toString());
        outputGit(resp.body);
    }
    catch (e) {
        throw e;
    }
}
function post_event_payload_key(foo) {
    addToExecuteQueue(foo);
    return finish();
}
async function post_key(organizationId, foo) {
    try {
        const resp = await sshReq(`apikey-list`, organizationId.toString());
        const keys = JSON.parse(resp);
        const options = keys.map((x) => {
            const n = x.name ? ` (${x.name})` : "";
            return {
                long: x.id,
                text: `${x.id}${n}`,
                action: () => post_event_payload_key(() => foo(x.id)),
            };
        });
        options.push({
            long: `new`,
            short: `n`,
            text: `add a new apikey`,
            action: () => key_create(organizationId, (key) => post_event_payload_key(() => foo(key))),
        });
        return await choice("Which key to post through?", options).then();
    }
    catch (e) {
        throw e;
    }
}
async function post_event_payload_type(organizationId, eventType, contentType) {
    try {
        const payload = await shortText("Payload", "The data to be attached to the request", "").then();
        return post_key(organizationId, (key) => do_post(eventType, key, contentType, payload));
    }
    catch (e) {
        throw e;
    }
}
async function post_event_payload_file(organizationId, eventType) {
    try {
        const files = (await readdir(".", { withFileTypes: true })).flatMap((x) => x.isDirectory() ? [] : [x.name]);
        const options = files.map((x) => {
            return {
                long: x,
                text: x,
                action: () => post_key(organizationId, (key) => do_post_file(eventType, key, x)),
            };
        });
        return await choice("Which file would you like to send?", options, {}).then((x) => x);
    }
    catch (e) {
        throw e;
    }
}
function post_event(organizationId, eventType) {
    return choice("What type of payload should the event use?", [
        {
            long: "empty",
            short: "e",
            text: "empty message, ie. no payload",
            action: () => post_key(organizationId, (key) => do_post(eventType, key, `text/plain`, ``)),
        },
        {
            long: "file",
            short: "f",
            text: "attach file content payload",
            action: () => post_event_payload_file(organizationId, eventType),
        },
        {
            long: "text",
            short: "t",
            text: "attach plain text payload",
            action: () => post_event_payload_type(organizationId, eventType, `text/plain`),
        },
        {
            long: "json",
            short: "j",
            text: "attach json payload",
            action: () => post_event_payload_type(organizationId, eventType, `application/json`),
        },
    ]);
}
export async function post(organizationId) {
    try {
        const eventType = await shortText("Event type", "The type of event to post", "hello").then();
        return post_event(organizationId, eventType);
    }
    catch (e) {
        throw e;
    }
}
