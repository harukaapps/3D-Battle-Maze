'use client';

import dynamic from 'next/dynamic';

const MainComponent = dynamic(() => import('../components/MainComponent'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="w-screen h-screen bg-black">
      <MainComponent />
    </main>
  );
}