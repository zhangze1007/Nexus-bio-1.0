import type { Metadata } from "next";
import StrainsClient from "./StrainsClient";

export const metadata: Metadata = {
  title: "Strain Inventory | Nexus-Bio",
};

export default function Page() {
  return <StrainsClient />;
}
