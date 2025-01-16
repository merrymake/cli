let command = "mm";
export function setCommand(mm: string) {
  command = mm;
}
export function getCommand() {
  return "$ " + command;
}
export function getShortCommand() {
  return command;
}
