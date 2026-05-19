export default function Profile() {
  return (
    <div className="bg-slate-950 min-h-screen p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>
      
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-6">
        <p className="text-slate-400 text-sm">Username</p>
        <p className="text-white font-bold text-lg mb-4">@yourname</p>

        <p className="text-slate-400 text-sm">Total Earnings</p>
        <p className="text-cyan-400 font-bold text-lg mb-4">$1,204</p>

        <p className="text-slate-400 text-sm">Win Rate</p>
        <p className="text-white font-bold">62%</p>
      </div>
    </div>
  )
}