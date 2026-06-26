import type { Metadata } from "next";
import PlasmidsClient from "./PlasmidsClient";

export const metadata: Metadata = {
  title: "Plasmid Inventory | Nexus-Bio",
};

export default function Page() {
  return <PlasmidsClient />;
}
