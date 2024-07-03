"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Path = exports.PathToRepository = exports.PathToServiceGroup = exports.PathToOrganization = exports.AccessId = exports.RepositoryId = exports.ServiceGroupId = exports.OrganizationId = void 0;
const path_1 = __importDefault(require("path"));
class OrganizationId {
    constructor(organizationId) {
        this.organizationId = organizationId;
    }
    toString() {
        return this.organizationId;
    }
}
exports.OrganizationId = OrganizationId;
class ServiceGroupId {
    constructor(serviceGroupId) {
        this.serviceGroupId = serviceGroupId;
    }
    toString() {
        return this.serviceGroupId;
    }
}
exports.ServiceGroupId = ServiceGroupId;
class RepositoryId {
    constructor(repositoryId) {
        this.repositoryId = repositoryId;
    }
    toString() {
        return this.repositoryId;
    }
}
exports.RepositoryId = RepositoryId;
class AccessId {
    constructor(accessId) {
        this.accessId = accessId;
    }
    toString() {
        return this.accessId;
    }
}
exports.AccessId = AccessId;
class PathToOrganization {
    constructor(pathToOrganization) {
        this.pathToOrganization = pathToOrganization;
    }
    with(folder) {
        return new PathToServiceGroup(path_1.default.join(this.pathToOrganization, folder));
    }
    toString() {
        return this.pathToOrganization;
    }
}
exports.PathToOrganization = PathToOrganization;
class PathToServiceGroup {
    constructor(pathToServiceGroup) {
        this.pathToServiceGroup = pathToServiceGroup;
    }
    with(folder) {
        return new PathToRepository(path_1.default.join(this.pathToServiceGroup, folder));
    }
    last() {
        return this.pathToServiceGroup.substring(this.pathToServiceGroup.lastIndexOf("/"));
    }
    toString() {
        return this.pathToServiceGroup;
    }
}
exports.PathToServiceGroup = PathToServiceGroup;
class PathToRepository {
    constructor(pathToRepository) {
        this.pathToRepository = pathToRepository;
    }
    with(folder) {
        return new Path(path_1.default.join(this.pathToRepository, folder));
    }
    toString() {
        return this.pathToRepository;
    }
}
exports.PathToRepository = PathToRepository;
class Path {
    constructor(path) {
        this.path = path;
    }
    with(folder) {
        return new Path(path_1.default.join(this.path, folder));
    }
    toString() {
        return this.path;
    }
}
exports.Path = Path;
