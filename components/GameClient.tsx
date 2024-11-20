'use client';

import dynamic from 'next/dynamic'

const MainComponent = dynamic(() => import('./MainComponent'), {
  ssr: false
})

export default function GameClient() {
  return <MainComponent />
}
