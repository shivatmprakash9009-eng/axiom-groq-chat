"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { Analytics } from "@/components/analytics";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 }, mutations: { retry: 0 } },
  }));
  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>
        {children}
        <Toaster position="bottom-right" richColors closeButton theme="system" />
        <Analytics />
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
