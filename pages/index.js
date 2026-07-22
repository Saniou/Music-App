import React from "react"
import Sidebar from "@/components/sidebar"
import Center from "@/components/center"
import { getSession } from "next-auth/react"
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
  const session = await getSession(context)

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