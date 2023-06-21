import { useSession } from "next-auth/react";
import { MdOutlineKeyboardArrowDown } from 'react-icons/md'
import Image from "next/image";
import { useEffect, useState } from "react";
import { shuffle } from "lodash";

const colors = [
    "from-indigo-500",
    "from-blue-500",
    "from-red-500",
    "from-cyan-500",
    "from-rose-500",
    "from-orange-500",
    "from-lime-500",
    "from-emerald-600",
    "from-violet-500",
    "from-pink-500",
];

const Center = () => {
    
    const { data: session } = useSession()
    const[color, setColors] = useState(null)
    
    useEffect(() => {
        setColors(shuffle(colors).pop())
    }, [])
    
    return ( 
        <div className="flex-grow">
            <header className="absolute top-5 right-8">
                <div className=" flex items-center space-x-3 cursor-pointer bg-[#000] rounded-full p-1 pr-2 hover:opacity-70">
                    <Image className="rounded-full w-[25%]" width={25} height={20} src={session?.user.image} alt="img" 
                    style={{ objectFit: 'cover', objectPosition: 'center', width: '25px%', height: '25px' }}/>
                    <h2>{session?.user.name}</h2>
                    <button>
                        <MdOutlineKeyboardArrowDown size={25}/>
                    </button>
                </div>
            </header>
            
            <section className={`flex items-end space-x-7 bg-gradient-to-b  ${color} h-80 text-white p-8 -z-10 w-full rounded-lg`}>
                {/* <Image src={} width={} height={}/> */}
            </section>
            
        </div>
     );
}
 
export default Center;