import "@/styles/globals.css";
import Head from "next/head";
import { SessionProvider } from "next-auth/react";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  return (
    // Spotify tokens live 60 min; refetching every 50 keeps the Web API client's token fresh
    // even when the tab never regains focus.
    <SessionProvider session={session} refetchInterval={50 * 60}>
      <Head>
        {/* viewport-fit=cover: draw under the iPhone notch and home bar; the layout pads itself with
            env(safe-area-inset-*) so nothing important ends up there. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
