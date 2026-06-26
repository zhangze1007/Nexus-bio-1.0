import type { Metadata } from "next";
import PrimersClient from "./PrimersClient";

export const metadata: Metadata = {
  title: "Primer Inventory | Nexus-Bio",
};

export default function Page() {
  return <PrimersClient />;
}
