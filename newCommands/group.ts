import fs from "fs";
import { shortText } from "../prompt";
import { Path, sshReq, toFolderName } from "../utils";
import { repo_create } from "./repo";
import {
  OrganizationId,
  PathToOrganization,
  PathToServiceGroup,
  ServiceGroupId,
} from "../types";

export async function do_createServiceGroup(
  path: PathToServiceGroup,
  organizationId: OrganizationId,
  displayName: string
) {
  try {
    console.log("Creating service group...");
    fs.mkdirSync(path.toString(), { recursive: true });
    const reply = await sshReq(
      `group-create`,
      displayName,
      `--organizationId`,
      organizationId.toString()
    );
    if (reply.length !== 8) throw reply;
    const serviceGroupId = new ServiceGroupId(reply);
    fs.writeFileSync(
      path.with(".group-id").toString(),
      serviceGroupId.toString()
    );
    return serviceGroupId;
  } catch (e) {
    throw e;
  }
}

export async function group(
  path: PathToOrganization,
  organizationId: OrganizationId
) {
  try {
    let num = 1;
    while (fs.existsSync(path.with("service-group-" + num).toString())) num++;
    let displayName = await shortText(
      "Service group name",
      "Used to share envvars.",
      "service-group-" + num
    ).then();
    const folderName = toFolderName(displayName);
    const serviceGroupId = await do_createServiceGroup(
      path.with(folderName),
      organizationId,
      displayName
    );
    return repo_create(path.with(folderName), organizationId, serviceGroupId);
  } catch (e) {
    throw e;
  }
}
