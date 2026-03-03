import { useAuth } from '../../contexts/AuthContext.jsx';

export default function DashboardOverview() {
    const { user } = useAuth();
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
            <p className="text-slate-500 text-lg">Use the sidebar to manage your {user?.role === 'user' ? 'favorites' : 'resources'}, update your profile{user?.role === 'admin' ? ', or access Admin tools' : ''}.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Your Role', value: user?.role === 'user' ? '👤 User' : user?.role === 'admin' ? '⚡ Admin' : '🤝 Partner', color: 'bg-brand-50 text-brand-700' },
                    { label: 'Portal', value: 'SeniorCare Connect', color: 'bg-green-50 text-green-700' },
                    { label: 'Status', value: '✅ Active', color: 'bg-slate-50 text-slate-700' },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`card ${color} border-0`}>
                        <p className="text-sm font-semibold opacity-70">{label}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
