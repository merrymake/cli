import path from "path";

export class OrganizationId {
  constructor(private readonly organizationId: string) {}
  toString() {
    return this.organizationId;
  }
}
export class ServiceGroupId {
  constructor(private readonly serviceGroupId: string) {}
  toString() {
    return this.serviceGroupId;
  }
}
export class RepositoryId {
  constructor(private readonly repositoryId: string) {}
  toString() {
    return this.repositoryId;
  }
}
export class AccessId {
  constructor(private readonly accessId: string) {}
  toString() {
    return this.accessId;
  }
}
export interface PathTo {
  with(folder: string): PathTo;
  toString(): string;
}
export class PathToOrganization implements PathTo {
  constructor(private readonly pathToOrganization: string) {}
  with(folder: string) {
    return new PathToServiceGroup(this, folder);
  }
  toString() {
    return this.pathToOrganization;
  }
}
export class PathToServiceGroup implements PathTo {
  constructor(
    private pathToParent: PathToOrganization,
    private readonly folder: string
  ) {}
  parent() {
    return this.pathToParent;
  }
  with(folder: string) {
    return new PathToRepository(this, folder);
  }
  toString() {
    return path.join(this.pathToParent.toString(), this.folder);
  }
}
export class PathToRepository implements PathTo {
  constructor(
    private pathToParent: PathToServiceGroup,
    private readonly folder: string
  ) {}
  parent() {
    return this.pathToParent;
  }
  with(folder: string) {
    return new Path(path.join(this.toString(), folder));
  }
  toString() {
    return path.join(this.pathToParent.toString(), this.folder);
  }
}
export class Path implements PathTo {
  constructor(private readonly path: string) {}
  with(folder: string) {
    return new Path(path.join(this.path, folder));
  }
  toString() {
    return this.path;
  }
}
export interface Organization {
  id: OrganizationId;
  pathTo: PathToOrganization;
}
export interface ServiceGroup {
  id: ServiceGroupId;
  pathTo: PathToServiceGroup;
}
export interface Repository {
  pathTo: PathToRepository;
}
export interface RepositoryWithId extends Repository {
  id: RepositoryId;
}
