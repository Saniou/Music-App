import Sidebar from "@/components/sidebar";
import Center from "@/components/center";
import Player from "@/components/player";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-base text-white">
      <main className="flex flex-1 gap-2 overflow-hidden p-2">
        <Sidebar />
        <Center />
      </main>
      <Player />
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: { destination: "/login", permanent: false },
    };
  }

  return { props: { session } };
}
