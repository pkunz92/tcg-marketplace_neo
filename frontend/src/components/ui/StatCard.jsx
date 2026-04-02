export default function StatCard({ label, value, icon: Icon, color = 'text-accent-400' }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-elevated flex items-center justify-center shrink-0">
          <Icon size={22} className={color} />
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}
