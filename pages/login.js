import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { getServerSession } from "next-auth/next";
import { FaSpotify } from "react-icons/fa";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { canonicalRedirect } from "@/lib/auth";

// NextAuth sends failed sign-ins here with ?error=<code>.
const ERRORS = {
  AccessDenied:
    "Spotify didn’t grant access. While this app is in Development Mode, your account must be added under User Management in the Spotify dashboard.",
  OAuthCallback: "Spotify sign-in didn’t complete. Please try again.",
  OAuthSignin: "Couldn’t start Spotify sign-in. Please try again.",
};

const Login = () => {
  const { error } = useRouter().query;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-[#1e1e1e] to-black px-4 text-white">
      <FaSpotify className="mb-6 h-24 w-24 text-[#1DB954]" />
      <h1 className="mb-8 text-2xl font-bold">Musify</h1>
      <button
        className="flex h-[50px] w-[220px] items-center justify-center gap-2 rounded-full bg-[#1DB954] font-semibold text-black transition hover:scale-105 hover:bg-[#1ed760]"
        onClick={() => signIn("spotify", { callbackUrl: "/" })}
      >
        <FaSpotify className="h-5 w-5" />
        Login with Spotify
      </button>
      {error && (
        <p role="alert" className="mt-6 max-w-sm text-center text-sm text-gray-400">
          {ERRORS[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}
    </div>
  );
};

export async function getServerSideProps(context) {
  const elsewhere = canonicalRedirect(context);
  if (elsewhere) return elsewhere;
  // Already signed in: nothing to do here.
  const session = await getServerSession(context.req, context.res, authOptions);
  if (session) return { redirect: { destination: "/", permanent: false } };
  return { props: {} };
}

export default Login;
