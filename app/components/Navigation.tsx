'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AiOutlineHome } from 'react-icons/ai'
import { BiChart } from 'react-icons/bi'
import { AiOutlineSearch } from 'react-icons/ai'
import { AiOutlineTrophy } from 'react-icons/ai'

export default function Navigation() {
  const pathname = usePathname()

  const isActive = (path: string) => pathname === path

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-700 p-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <Link
          href="/"
          className={`flex flex-col items-center gap-2 ${
            isActive('/') ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <AiOutlineHome size={24} />
          <span className="text-xs">Home</span>
        </Link>

        <Link
          href="/porfolio-page"
          className={`flex flex-col items-center gap-2 ${
            isActive('/porfolio-page') ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <BiChart size={24} />
          <span className="text-xs">Portfolio</span>
        </Link>

        <Link
          href="/search"
          className={`flex flex-col items-center gap-2 ${
            isActive('/search') ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <AiOutlineSearch size={24} />
          <span className="text-xs">Search</span>
        </Link>

        <Link
          href="/profile"
          className={`flex flex-col items-center gap-2 ${
            isActive('/profile') ? 'text-cyan-400' : 'text-slate-400'
          }`}
        >
          <AiOutlineTrophy size={24} />
          <span className="text-xs">Profile</span>
        </Link>
      </div>
    </nav>
  )
}