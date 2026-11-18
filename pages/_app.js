import "@/styles/globals.css";
import { SessionProvider } from "next-auth/react";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  return (
    // Spotify tokens live 60 min; refetching every 50 keeps the Web API client's token fresh
    // even when the tab never regains focus.
    <SessionProvider session={session} refetchInterval={50 * 60}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
