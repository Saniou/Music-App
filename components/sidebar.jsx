import Link from 'next/link';
import {AiFillHome, AiTwotoneFire} from 'react-icons/ai';
import {MdFavorite} from 'react-icons/md';
import {ImSearch} from 'react-icons/im';
import {IoIosCreate} from 'react-icons/io';
import {SiGooglepodcasts} from 'react-icons/si';
import {GoSignOut} from 'react-icons/go';
import Playlist from './playList';
import { signOut, useSession } from 'next-auth/react';

const Sidebar = () => {
    
    const { data: session, status } = useSession();
    console.log(session)
    
    return (
    <> 
    <div> 
        <div className="m-5 p-2 rounded-[15px] text-sm bg-[#1f1e1e]">
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-red-800">
            <button className='flex' onClick={() => signOut() }>
                <GoSignOut size={20} className="mr-[16px] text-[#b4fc0b]"/>
                <p>Sign Out</p>
            </button>
        </div>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <AiFillHome size={20} className="mr-[16px] text-[green]"/>
                <p>Home</p>
            </button>
        </div>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <AiTwotoneFire className="h-5 w-5 mr-[16px] text-[#d3622e]"/>
                <p>Trending</p>
            </button>
        </div>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <MdFavorite size={20} className="mr-[16px] text-[red]"/>
                <p>Following</p>
            </button>
        </div>
        <hr className="border-t-[0.1px] border-gray-600"/>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <ImSearch size={20} className="mr-[16px] text-[cyan]"/>
                <p>Search</p>
            </button>
        </div>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <IoIosCreate size={20} className="mr-[16px] text-lime-50"/>
                <p>Create Playlist</p>
            </button>
        </div>
        <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
            <button className='flex'>
                <SiGooglepodcasts size={20} className="mr-[16px] text-blue-700"/>
                <p>Your Episode</p>
            </button>
        </div>
    </div>

    <div className="m-5 p-2 rounded-[15px] text-sm bg-[#1f1e1e]">
        <Playlist/>
    </div>

</div> 
</>
    );
};

export default Sidebar;