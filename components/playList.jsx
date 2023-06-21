import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSpotify from "@/hooks/useSpotify";
import Image from "next/image";

const Playlist = () => {
    
    const spotifyApi = useSpotify()
    
    const {data: session} = useSession()
    const [playlist, setPlaylist] = useState([])
    
    useEffect(() => {
        if (spotifyApi.getAccessToken()) {
            spotifyApi.getUserPlaylists().then((data) => {
                setPlaylist(data.body.items)
            })
        }
    }, [session, spotifyApi])
    
    console.log(playlist)
    
    
    return ( 
        <>
        <div className="items-center">
            {playlist.map((playlist) =>(
                <>
                <div className="flex ml-2 items-center cursor-pointer hover:opacity-60">
                    
                <Image className="w-10 h-10 mb-5" width={50} height={50} src={playlist.images[0]?.url} alt='image'/>
                
                <p key={playlist.id} className="text-[12px] flex pl-3">
                    {playlist.name}
                    <p>{}</p>
                </p>
                
                </div>
                </>
            ))}
        </div>
        </>
     );
}
 
export default Playlist;