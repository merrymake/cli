import { optimisticMimeTypeOf } from "@merrymake/ext2mime";
import fs, { readdirSync } from "fs";
import { RAPIDS_HOST } from "../config";
import { Option, choice, shortText } from "../prompt";
import { OrganizationId } from "../types";
import { addToExecuteQueue, finish, output2, sshReq, urlReq } from "../utils";
import { key_create } from "./apikey";

export async function do_post(
  eventType: string,
  key: string,
  contentType: string,
  payload: string
) {
  try {
    const resp = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      payload,
      contentType
    );
    output2(resp.body);
  } catch (e) {
    throw e;
  }
}

export async function do_post_file(
  eventType: string,
  key: string,
  filename: string
) {
  try {
    const content = fs.readFileSync(filename).toString();
    const type = optimisticMimeTypeOf(
      filename.substring(filename.lastIndexOf(".") + 1)
    );
    if (type === null) throw "Could not determine content type";
    const resp = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      content,
      type.toString()
    );
    output2(resp.body);
  } catch (e) {
    throw e;
  }
}

function post_event_payload_key(foo: () => Promise<void>) {
  addToExecuteQueue(foo);
  return finish();
}

async function post_key(
  organizationId: OrganizationId,
  foo: (key: string) => Promise<void>
) {
  try {
    const resp = await sshReq(`apikey-list`, organizationId.toString());
    const keys: { name: string; id: string }[] = JSON.parse(resp);
    const options: Option[] = keys.map((x) => {
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
      action: () =>
        key_create(organizationId, (key: string) =>
          post_event_payload_key(() => foo(key))
        ),
    });
    return await choice("Which key to post through?", options).then();
  } catch (e) {
    throw e;
  }
}

async function post_event_payload_type(
  organizationId: OrganizationId,
  eventType: string,
  contentType: string
) {
  try {
    const payload = await shortText(
      "Payload",
      "The data to be attached to the request",
      ""
    ).then();
    return post_key(organizationId, (key) =>
      do_post(eventType, key, contentType, payload)
    );
  } catch (e) {
    throw e;
  }
}

async function post_event_payload_file(
  organizationId: OrganizationId,
  eventType: string
) {
  try {
    const files = readdirSync(".", { withFileTypes: true }).flatMap((x) =>
      x.isDirectory() ? [] : [x.name]
    );
    const options = files.map<Option>((x) => {
      return {
        long: x,
        text: x,
        action: () =>
          post_key(organizationId, (key) => do_post_file(eventType, key, x)),
      };
    });
    return await choice("Which file would you like to send?", options, {}).then(
      (x) => x
    );
  } catch (e) {
    throw e;
  }
}

function post_event(organizationId: OrganizationId, eventType: string) {
  return choice("What type of payload should the event use?", [
    {
      long: "empty",
      short: "e",
      text: "empty message, ie. no payload",
      action: () =>
        post_key(organizationId, (key) =>
          do_post(eventType, key, `text/plain`, ``)
        ),
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
      action: () =>
        post_event_payload_type(organizationId, eventType, `text/plain`),
    },
    {
      long: "json",
      short: "j",
      text: "attach json payload",
      action: () =>
        post_event_payload_type(organizationId, eventType, `application/json`),
    },
  ]);
}

export async function post(organizationId: OrganizationId) {
  try {
    const eventType = await shortText(
      "Event type",
      "The type of event to post",
      "hello"
    ).then();
    return post_event(organizationId, eventType);
  } catch (e) {
    throw e;
  }
}
