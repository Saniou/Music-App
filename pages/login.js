import { getProviders, signIn } from 'next-auth/react';

const Login = ({ providers }) => {
  return (
    <div className='flex flex-col items-center justify-center min-h-screen text-black '>
      <img className='w-32 mb-5' src='https://links.papareact.com/9xl' alt='Spotify' />

      {Object.values(providers).map((provider) => (
        <div key={provider.id}>
          <button
            className='w-[180px] h-[50px] bg-[#18D860] rounded-full text-white'
            onClick={() => signIn(provider.id, { callbackUrl: '/' })}
          >
            Login with {provider.name}
          </button>
        </div>
      ))}
    </div>
  );
};

export default Login;

export async function getServerSideProps() {
  const providers = await getProviders();
  return {
    props: {
      providers,
    },
  };
}