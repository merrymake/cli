let command = "$ mm";
export function setCommand(mm) {
    command = "$ " + mm;
}
export function getCommand() {
    return command;
}