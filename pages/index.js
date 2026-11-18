import Experience from "@/components/experience";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { canonicalRedirect } from "@/lib/auth";

export default function Home() {
  return <Experience />;
}

export async function getServerSideProps(context) {
  const elsewhere = canonicalRedirect(context);
  if (elsewhere) return elsewhere;

  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: { destination: "/login", permanent: false },
    };
  }

  return { props: { session } };
}
