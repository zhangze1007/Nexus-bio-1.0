// Workbench and IDE types

export interface ConsoleEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  module: string;
  message: string;
}
