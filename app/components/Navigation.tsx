'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AiOutlineHome } from 'react-icons/ai'
import { BiChart } from 'react-icons/bi'
import { AiOutlineSearch } from 'react-icons/ai'
import { AiOutlineTrophy } from 'react-icons/ai'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'

export default function Navigation() {
  const haptics = useHapticFeedback()
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path
  const navItemClass = (path: string) => {
    const active = isActive(path)

    return `h-12 px-3 rounded-full flex items-center justify-center gap-2 transition-all duration-300 ease-out ${
      active
        ? 'min-w-28 bg-cyan-400 text-black shadow-lg shadow-cyan-950/40'
        : 'min-w-12 text-slate-400 hover:text-slate-300 active:scale-95'
    }`
  }

  const labelClass = (path: string) => {
    const active = isActive(path)

    return `overflow-hidden whitespace-nowrap text-xs font-bold transition-all duration-300 ease-out ${
      active ? 'max-w-20 opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-1'
    }`
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-700 p-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <Link
          href="/"
          onClick={() => haptics.selection()}
          className={navItemClass('/')}
        >
          <AiOutlineHome size={24} />
          <span className={labelClass('/')}>Home</span>
        </Link>

        <Link
          href="/porfolio-page"
          onClick={() => haptics.selection()}
          className={navItemClass('/porfolio-page')}
        >
          <BiChart size={24} />
          <span className={labelClass('/porfolio-page')}>Portfolio</span>
        </Link>

        <Link
          href="/search"
          onClick={() => haptics.selection()}
          className={navItemClass('/search')}
        >
          <AiOutlineSearch size={24} />
          <span className={labelClass('/search')}>Search</span>
        </Link>

        <Link
          href="/profile"
          onClick={() => haptics.selection()}
          className={navItemClass('/profile')}
        >
          <AiOutlineTrophy size={24} />
          <span className={labelClass('/profile')}>Profile</span>
        </Link>
      </div>
    </nav>
  )
}
