import type { Metadata } from "next";
import { RewardsHub } from "@/components/RewardsHub";

export const metadata: Metadata = { title: "Recompensas — Jogaço" };

export default function RewardsPage() {
  return <RewardsHub />;
}
