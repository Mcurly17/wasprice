"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Shell } from "@/components/ui";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false } } }));
  return (
    <QueryClientProvider client={client}>
      <WalletProvider>
        <Shell>{children}</Shell>
      </WalletProvider>
    </QueryClientProvider>
  );
}
