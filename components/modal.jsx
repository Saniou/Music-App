import { useState } from "react";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Toast from "react-bootstrap/Toast";
import { MdOutlineKeyboardArrowDown } from "react-icons/md";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";

const ModalWindow = () => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const { data: session } = useSession();

  return (
    <div>
      <header
        onClick={handleOpen}
        className="absolute top-5 right-8 cursor-pointer"
      >
        <div
          className="flex items-center space-x-3 z-10 bg-[#000] p-1 pr-2 hover:opacity-70"
          style={{ alignItems: "center !important" }}
        >
          <Toast
            style={{ background: "black", width: "50%" }}
            className="space-x-3 items-center flex rounded-full"
          >
            <Image
              className="rounded-full w-[25%]"
              width={20}
              height={20}
              src={session?.user.image}
              alt="img"
              style={{
                objectFit: "cover",
                objectPosition: "center",
                width: "25px",
                height: "25px",
              }}
            />
            <strong className="me-auto text-white">{session?.user.name}</strong>
            <button>
              <MdOutlineKeyboardArrowDown className="text-white" size={25} />
            </button>
          </Toast>
        </div>
      </header>

      <Modal
        open={open}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box 
            onClick={handleClose}
            >
          <div className="flex flex-col items-center justify-center min-h-screen bg-white bg-opacity-10 text-black ">
            <Image
              className="w-32 mb-5 bg-black rounded-full"
              src="/./fPuEa9V.png"
              alt="Spotify"
              width={100}
              height={100}
            />
            <div className="grid items-center justify-center">
              <button
                className="w-[180px] h-[50px] bg-[#18D860] rounded-full text-white mb-3"
                onClick={() => signIn()}
              >
                Login with
              </button>
              <button
                className="w-[180px] h-[40px] bg-[#115f2f] rounded-full text-white"
                onClick={handleClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </Box>
      </Modal>
    </div>
  );
};

export default ModalWindow;