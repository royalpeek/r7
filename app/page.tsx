import PollCard from './components/PollCard'

export default function Home() {
  return (
    <div className="bg-slate-950 min-h-screen p-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">r7</h1>
        <div className="bg-slate-800 text-slate-400 px-4 py-2 rounded text-sm">
          $64.167 USDC
        </div>
      </div>
      <div>
        <PollCard />
      </div>
    </div>
  )
}