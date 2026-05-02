import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Files, User, Shield, Map, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { canAccessAdmin, getRoleMeta, isStandardUserRole } from '../../lib/roles.js';

export default function DashboardOverview() {
    const { user } = useAuth();
    const { t } = useLocale();
    const navigate = useNavigate();
    const roleMeta = getRoleMeta(user?.role);
    const canShowAdmin = canAccessAdmin(user?.role);
    const isStandardUser = isStandardUserRole(user?.role);
    
    const launchpadItems = [
        {
            id: 'dash-map',
            to: '/discover',
            icon: Map,
            title: t('overviewDiscoverTitle'),
            description: t('overviewDiscoverDescription'),
            color: 'var(--color-brand)',
            bg: 'var(--color-brand-light)',
        },
        {
            id: 'dash-directory',
            to: '/my-directory',
            icon: BookOpen,
            title: t('myDirectory'),
            description: t('overviewDirectoryDescription'),
            color: '#7c3aed',
            bg: 'rgba(124, 58, 237, 0.08)',
        },
        ...(!isStandardUser ? [{
            id: 'dash-resources',
            to: '/dashboard/resources',
            icon: Files,
            title: t('overviewResourcesTitle'),
            description: t('overviewResourcesDescription'),
            color: '#0891b2',
            bg: 'rgba(8, 145, 178, 0.08)',
        }] : []),
        {
            id: 'dash-profile',
            to: '/dashboard/profile',
            icon: User,
            title: t('overviewProfileTitle'),
            description: t('overviewProfileDescription'),
            color: '#475569',
            bg: 'rgba(71, 85, 105, 0.08)',
        },
        ...(canShowAdmin ? [{
            id: 'dash-admin',
            to: '/dashboard/admin',
            icon: Shield,
            title: t('overviewAdminTitle'),
            description: t('overviewAdminDescription'),
            color: '#b91c1c',
            bg: 'rgba(185, 28, 28, 0.08)',
        }] : [])
    ];

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <header className="mb-10">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        {t('overviewWelcome', { name: user?.name?.split(' ')[0] || t('account') })}
                    </h1>
                    <span 
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-sm ${roleMeta.pillClassName}`}
                        style={{ border: '1px solid rgba(0,0,0,0.05)' }}
                    >
                        {roleMeta.shortLabel}
                    </span>
                </div>
                <p className="text-slate-500 text-lg max-w-2xl leading-relaxed">
                    {t('overviewIntro')}
                </p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                {launchpadItems.map((item) => (
                    <button
                        key={item.id}
                        id={item.id}
                        onClick={() => navigate(item.to)}
                        className="group relative flex flex-col p-4 sm:p-5 lg:p-6 rounded-2xl lg:rounded-3xl border-2 transition-all text-left bg-white hover:border-brand-500 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
                        style={{ borderColor: 'var(--color-border)' }}
                    >
                        <div 
                            className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 lg:mb-5 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: item.bg, color: item.color }}
                        >
                            <item.icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" strokeWidth={2.5} />
                        </div>
                        
                        <div className="mb-1 sm:mb-2 flex items-center justify-between">
                            <h3 className="text-sm sm:text-lg lg:text-xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-tight">
                                {item.title}
                            </h3>
                            <ArrowRight size={18} className="hidden sm:block text-slate-300 opacity-0 -translate-x-4 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-brand-500" />
                        </div>
                        
                        <p className="text-slate-500 text-[11px] sm:text-xs lg:text-sm leading-relaxed line-clamp-2 sm:line-clamp-none">
                            {item.description}
                        </p>

                        <div className="mt-4 hidden lg:flex items-center gap-1 text-xs font-bold text-brand-600 opacity-0 transition-opacity group-hover:opacity-100 uppercase tracking-wider">
                            {t('overviewOpen')}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
