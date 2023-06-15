import Link from 'next/link';
import {AiFillHome, AiTwotoneFire} from 'react-icons/ai';
import {MdFavorite} from 'react-icons/md';
import {ImSearch} from 'react-icons/im';
import {IoIosCreate} from 'react-icons/io';
import {SiGooglepodcasts} from 'react-icons/si';
import Playlist from './playList';

const Sidebar = () => {
    return (
<> 
        <div>
         <div className="m-5 p-2 rounded-[15px] text-sm bg-[#1f1e1e]">
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <AiFillHome size={20} className="mr-[16px] text-[green]"/>
                <p>Home</p>
            </div>
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <AiTwotoneFire className="h-5 w-5 mr-[16px] text-[#d3622e]"/>
                <p>Trending</p>
            </div>
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <MdFavorite size={20} className="mr-[16px] text-[red]"/>
                <p>Following</p>
            </div>
            <hr className="border-t-[0.1px] border-gray-600"/>
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <ImSearch size={20} className="mr-[16px] text-[cyan]"/>
                <p>Search</p>
            </div>
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <IoIosCreate size={20} className="mr-[16px] text-lime-50"/>
                <p>Create Playlist</p>
            </div>
            <div className="flex p-2 cursor-pointer m-2 items-center hover:text-[#5C67DE]">
                <SiGooglepodcasts size={20} className="mr-[16px] text-blue-700"/>
                <p>Your Episode</p>
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