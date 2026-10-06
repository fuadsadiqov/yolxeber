import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { FeedScreen } from "./FeedScreen";

export const metadata: Metadata = { title: "Lent" };

export default function FeedPage() {
  return (
    <>
      <AppHeader />
      <FeedScreen />
    </>
  );
}
