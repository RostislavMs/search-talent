import type { ReactNode } from "react";
import InteractiveBackground from "@/components/interactive-background";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <InteractiveBackground />
      {children}
    </>
  );
}
