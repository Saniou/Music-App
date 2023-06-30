import React from "react"
import Sidebar from "@/components/sidebar"
import Center from "@/components/center"
import { getSession } from "next-auth/react"

export default function Home() {
  return (
    <div className='h-screen overflow-hidden'>
     <main className="flex">

      <Sidebar/>
      <Center/>

     </main>
     
     <div>
      {/* Player */}
      </div>
     
    </div>
  )
}

export async function getServerSideProps(context) {
  const session = await getSession(context)
  return{
    props: {
      session
    }
  }
}