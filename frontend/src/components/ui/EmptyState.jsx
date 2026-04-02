export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      {Icon && <Icon size={48} className="text-slate-600" />}
      <div>
        <p className="text-slate-300 font-medium text-lg">{title}</p>
        {description && <p className="text-slate-500 text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}
