"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templates = exports.languages = void 0;
exports.languages = {
    python: { long: "python", short: "p", projectType: "python" },
    typescript: { long: "typescript", short: "t", projectType: "typescript" },
    javascript: { long: "javascript", short: "¤", projectType: "nodejs" },
    rust: { long: "rust", short: "r", projectType: "rust" },
    java: { long: "java", short: "j", projectType: "gradle" },
    csharp: { long: "c#", short: "#", projectType: "csharp" },
    go: { long: "go", short: "g", projectType: "go" },
};
exports.templates = {
    basic: {
        long: "basic",
        short: "b",
        text: "initialize with a basic template",
        languages: ["typescript", "csharp", "javascript"],
    },
    // web: {
    //   long: "web",
    //   short: "w",
    //   text: "initialize with a webapp/website template",
    //   languages: ["typescript"],
    // },
    // service: {
    //   long: "service",
    //   short: "s",
    //   text: "initialize with a backend service template",
    //   languages: ["typescript"],
    // },
};
