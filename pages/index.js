import React from "react"
import Sidebar from "@/components/sidebar"
import Center from "@/components/center"

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
