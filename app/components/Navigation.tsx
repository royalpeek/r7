'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AiOutlineHome } from 'react-icons/ai'
import { BiChart } from 'react-icons/bi'
import { AiOutlineSearch } from 'react-icons/ai'
import { AiOutlineUser } from 'react-icons/ai'
import { AiOutlineSetting } from 'react-icons/ai'
import { useHapticFeedback } from '@/app/hooks/useHapticFeedback'
import { useTelegramUser } from '@/app/hooks/useTelegramUser'

export default function Navigation() {
  const haptics = useHapticFeedback()
  const pathname = usePathname()
  const { appUser } = useTelegramUser()
  const isAdmin = appUser?.role === 'admin'

  const isActive = (path: string) => pathname === path
  const navItemClass = (path: string) => {
    const active = isActive(path)

    return `h-10 flex-shrink-0 rounded-full flex items-center justify-center gap-1.5 transition-all duration-300 ease-out ${
      active
        ? 'w-20 bg-cyan-400 text-black shadow-sm shadow-cyan-950/30'
        : 'w-10 text-slate-400 hover:text-slate-300 active:scale-95'
    }`
  }

  const labelClass = (path: string) => {
    const active = isActive(path)

    return `overflow-hidden whitespace-nowrap text-xs font-bold transition-all duration-300 ease-out ${
      active ? 'max-w-14 opacity-100 translate-x-0' : 'max-w-0 opacity-0 -translate-x-1'
    }`
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-slate-950 border-t border-slate-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex h-12 max-w-md items-center justify-between gap-1">
        <Link
          href="/"
          onClick={() => haptics.selection()}
          className={navItemClass('/')}
        >
          <AiOutlineHome size={22} />
          <span className={labelClass('/')}>Home</span>
        </Link>

        <Link
          href="/porfolio-page"
          onClick={() => haptics.selection()}
          className={navItemClass('/porfolio-page')}
        >
          <BiChart size={22} />
          <span className={labelClass('/porfolio-page')}>Portfolio</span>
        </Link>

        <Link
          href="/search"
          onClick={() => haptics.selection()}
          className={navItemClass('/search')}
        >
          <AiOutlineSearch size={22} />
          <span className={labelClass('/search')}>Search</span>
        </Link>

        <Link
          href="/profile"
          onClick={() => haptics.selection()}
          className={navItemClass('/profile')}
        >
          <AiOutlineUser size={22} />
          <span className={labelClass('/profile')}>Profile</span>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => haptics.selection()}
            className={navItemClass('/admin')}
          >
            <AiOutlineSetting size={22} />
            <span className={labelClass('/admin')}>Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
