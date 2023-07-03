// import React from "react";
// import Image from "next/image";
// import { BsFillPlayFill } from "react-icons/bs";

// const Song = ({ track, order }) => {
//   const formatDuration = (duration) => {
//     const minutes = Math.floor(duration / 60000);
//     const seconds = Math.floor((duration % 60000) / 1000);
//     return `${minutes}:${seconds.toString().padStart(2, "0")}`;
//   };

//   const truncateText = (text, limit) => {
//     if (text.length <= limit) {
//       return text;
//     }
//     return text.split(" ").slice(0, limit).join(" ") + "...";
//   };

//   return (
//     <tr>
//       <td className="bg-black text-white">{order + 1}</td>
//       <td className="bg-black text-white">
//         <button className="cursor-pointer">
//           <BsFillPlayFill className="w-10 h-10 p-1 text-white rounded-full hover:bg-[#5C67DE] hover:text-white cursor-pointer hover:rounded-full transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-10 duration-50" />
//         </button>
//       </td>
//       <td className="bg-black">
//         <div className="flex items-center space-x-4">
//           <div className="w-10 h-10">
//             <Image
//               className=" text-[15px] object-cover w-10 h-10"
//               src={track.track.album.images[0].url}
//               alt="Track Image"
//               width={250}
//               height={250}
//             />
//           </div>
//           <div className="pl-5 flex flex-col" style={{ background: "#000" }}>
//             <p className="text-white">{truncateText(track.track.name, 3)}</p>
//             <p className="opacity-40">{track.track.artists[0].name}</p>
//           </div>
//         </div>
//       </td>
//       <td className="bg-black text-white">{track.track.artists[0].name}</td>
//       <td className="bg-black text-white">{track.added_at}</td>
//       <td className="bg-black text-white">{truncateText(track.track.album.name, 3)}</td>
//       <td className="bg-black text-white">{formatDuration(track.track.duration_ms)}</td>
//     </tr>
//   );
// };

// export default Song;

//-----------------------------------------------

    //   <div className="w-[1000px] m-2 py-4 px-5 justify-center items-center hover:bg-[#1f1e1e] rounded-lg cursor-pointer grid grid-cols-2">
    //     <div className="flex items-center space-x-4">
    //       <button className="cursor-pointer">
    //         <BsFillPlayFill className="w-10 h-10 p-1 rounded-full hover:bg-[#5C67DE] hover:text-white cursor-pointer hover:rounded-full transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-10 duration-50" />
    //       </button>
    //       <p className="pl-5 pr-5">{order + 1}</p>
    //       <div className="w-10 h-10">
    //         <Image
    //           className="object-cover w-10 h-10"
    //           src={track.track.album.images[0].url}
    //           alt="Track Image"
    //           width={250}
    //           height={250}
    //         />
    //       </div>
    //       <div className="pl-5 flex flex-col">
    //         <p className="">{truncateText(track.track.name, 3)}</p>
    //         <p className="opacity-40 ">{track.track.artists[0].name}</p>
    //       </div>
    //     </div>
    //     <div className="grid grid-cols-3 items-center md:ml-0">
    //       <p className="text-sm opacity-70 hidden md:inline">{truncateText(track.track.album.name, 3)}</p>
    //       <p className="text-xs opacity-70">{track.added_at}</p>
    //       <p className="text-xs opacity-70">{formatDuration(track.track.duration_ms)}</p>
    //     </div>
    //   </div>
    // </div>