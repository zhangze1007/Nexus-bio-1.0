import type { Metadata } from "next";
import ChemicalsClient from "./ChemicalsClient";

export const metadata: Metadata = {
  title: "Chemical Inventory | Nexus-Bio",
};

export default function Page() {
  return <ChemicalsClient />;
}
