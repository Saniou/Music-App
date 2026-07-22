import React from "react"
import Sidebar from "@/components/sidebar"
import Center from "@/components/center"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import Player from "@/components/player"


export default function Home() {
  return (
    <div className='h-screen overflow-hidden'>
     <main className="flex">

      <Sidebar/>
      <Center/>

     </main>
     
     <div className="sticky bottom-0">
      <Player/>
      </div>
     
    </div>
  )
}

export async function getServerSideProps(context) {
  // getServerSession reads the cookie directly (no internal fetch), which is
  // reliable on serverless — unlike getSession from next-auth/react.
  const session = await getServerSession(context.req, context.res, authOptions)

  // Gate the app: send unauthenticated visitors to the login page.
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    }
  }

  return {
    props: {
      session,
    },
  }
}