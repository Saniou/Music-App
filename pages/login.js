import { signIn } from "next-auth/react";
import { FaSpotify } from "react-icons/fa";

const Login = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1e1e1e] to-black text-white">
      <FaSpotify className="mb-6 h-24 w-24 text-[#1DB954]" />
      <h1 className="mb-8 text-2xl font-bold">Musify</h1>
      <button
        className="flex h-[50px] w-[220px] items-center justify-center gap-2 rounded-full bg-[#1DB954] font-semibold text-black transition hover:scale-105 hover:bg-[#1ed760]"
        onClick={() => signIn("spotify", { callbackUrl: "/" })}
      >
        <FaSpotify className="h-5 w-5" />
        Login with Spotify
      </button>
    </div>
  );
};

export default Login;
