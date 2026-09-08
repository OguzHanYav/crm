"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const FIVE_MINUTES = 5 * 60 * 1000;

// Ein QueryClient pro Browser-Session (useState statt Modul-Scope) — verhindert,
// dass mehrere Requests sich serverseitig einen Client teilen, und dass der
// Client bei jedem Re-Render der Provider-Komponente neu erzeugt wird.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIVE_MINUTES,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
