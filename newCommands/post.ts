import { optimisticMimeTypeOf } from "@merrymake/ext2mime";
import { RAPIDS_HOST } from "../config.js";
import { addToExecuteQueue, finish } from "../exitMessages.js";
import { Option, choice, output, resetCommand, shortText } from "../prompt.js";
import { OrganizationId } from "../types.js";
import { sshReq, urlReq } from "../utils.js";
import { key_create } from "./apikey.js";
import { outputGit } from "../printUtils.js";
import { readdir, readFile } from "fs/promises";
import { Str, UnitType } from "@merrymake/utils";
import { isDryrun } from "../dryrun.js";

export async function do_post(
  eventType: string,
  key: string,
  contentType: string,
  payload: string
) {
  if (isDryrun()) {
    output("DRYRUN: Would send POST request");
    return;
  }
  try {
    outputGit(`Sending POST request to ${RAPIDS_HOST}/${key}/${eventType}`);
    const { body, time } = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      payload,
      contentType
    );
    outputGit(`Response after ${Str.withUnit(time, UnitType.Duration)}:`);
    outputGit(body, Str.NORMAL_COLOR);
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
    const content = await readFile(filename, "utf-8");
    const type = optimisticMimeTypeOf(
      filename.substring(filename.lastIndexOf(".") + 1)
    );
    if (type === null) throw "Could not determine content type";
    outputGit(`Sending POST request to ${RAPIDS_HOST}/${key}/${eventType}`);
    const { body, time } = await urlReq(
      `${RAPIDS_HOST}/${key}/${eventType}`,
      "POST",
      content,
      type.toString()
    );
    outputGit(body, Str.NORMAL_COLOR);
    outputGit(`Response time: ${Str.withUnit(time, UnitType.Duration)}`);
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
    return await choice(
      [
        {
          long: `new`,
          short: `n`,
          text: `add a new apikey`,
          action: () =>
            key_create(organizationId, (key: string) =>
              post_event_payload_key(() => foo(key))
            ),
        },
      ],
      async () => {
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
        return { options, header: "Which key to post through?" };
      }
    ).then();
  } catch (e) {
    throw e;
  }
}

export async function post_event_payload_type(
  organizationId: OrganizationId,
  eventType: string,
  contentType: string,
  suggestion = ""
) {
  try {
    resetCommand(`rapids post ${eventType} text`);
    const payload = await shortText(
      "Payload",
      "The data to be attached to the request",
      suggestion
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
    return await choice(
      [],
      async () => {
        const files = (await readdir(".", { withFileTypes: true })).flatMap(
          (x) => (x.isDirectory() ? [] : [x.name])
        );
        const options = files.map<Option>((x) => {
          return {
            long: x,
            text: x,
            action: () =>
              post_key(organizationId, (key) =>
                do_post_file(eventType, key, x)
              ),
          };
        });
        return { options, header: "Which file would you like to send?" };
      },
      {}
    ).then((x) => x);
  } catch (e) {
    throw e;
  }
}

function post_event(organizationId: OrganizationId, eventType: string) {
  return choice(
    [
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
          post_event_payload_type(
            organizationId,
            eventType,
            `application/json`
          ),
      },
    ],
    async () => ({
      options: [],
      header: "What type of payload should the event use?",
    })
  );
}

export async function post(organizationId: OrganizationId) {
  try {
    resetCommand("rapids post");
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
