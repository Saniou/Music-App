import React from 'react';
import { AiFillHome, AiTwotoneFire } from "react-icons/ai";
import { MdFavorite } from "react-icons/md";
import { ImSearch } from "react-icons/im";
import { IoIosCreate } from "react-icons/io";
import { SiGooglepodcasts } from "react-icons/si";
import { GoSignOut } from "react-icons/go";
import Playlist from "./playList";
import { signOut } from "next-auth/react";
import 'bootstrap/dist/css/bootstrap.min.css';
import Link from 'next/link';

const SideBar = () => {
  
  return ( 
    <div className=''>
    <div className="ml-1 rounded-xl w-[50px] lg:w-[220px] md:w-[210px] sm:w-[70px] mr-2 flex flex-column flex-shrink-0 p-3 text-bg-dark overflow-y-scroll h-screen scrollbar-hide pb-36 bg-[#1f1e1e]">
      <ul className="text-none lg:text-[14px] md:text-[12px] sm:text-[8px] nav nav-pills flex-column mb-auto m-2">
      <li className="nav-item">
            <button className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none" onClick={() => signOut({ callbackUrl: "/login" })}>
              <GoSignOut size={20} className="mr-[16px] text-[#b4fc0b]" />
              <p className="hidden md:inline sm:hidden">Sign Out</p>
            </button>
        </li>
        <li className="nav-item">
            <Link  href="/" className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none ">
               <AiFillHome size={20} className="mr-[16px] text-[green]" />
               <p className="hidden md:inline sm:hidden">Home</p>
             </Link>
        </li>
        <li>
        <button className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
              <AiTwotoneFire className="h-5 w-5 mr-[16px] text-[#d3622e]" />
              <p className="hidden md:inline sm:hidden">Trending</p>
            </button>
        </li>
        <li>
        <button className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
              <MdFavorite size={20} className="mr-[16px] text-[red]" />
              <p className="hidden md:inline sm:hidden">Following</p>
          </button>
        </li>
        <li>
        <button className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
              <ImSearch size={20} className="mr-[16px] text-[cyan]" />
              <p className="hidden md:inline sm:hidden">Search</p>
            </button>
        </li>
        <hr className="border-t-[0.1px] border-gray-600"/>
        <li className="">
        <button className="flex center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
              <IoIosCreate size={20} className="mr-[16px] text-lime-50" />
              <p className="hidden md:inline sm:hidden">Create Playlist</p>
            </button>
        </li>
        <li>
        <button className="flex center mb-md-0 me-md-auto text-white text-decoration-none">
              <SiGooglepodcasts size={20} className="mr-[16px] text-blue-700" />
              <p className="hidden md:inline sm:hidden">Your Episode</p>
            </button>
        </li>
      </ul>
      <hr className="border-t-[0.1px] border-gray-600"/>
          <div>
                <Playlist/>
          </div>
    </div>
    </div>
  );
}
 
export default SideBar;