import type { Metadata } from "next";
import CopilotPageClient from "./CopilotPageClient";

export const metadata: Metadata = {
  title: "Copilot — AI Conversation | Nexus-Bio",
};

export default function Page() {
  return <CopilotPageClient />;
}
