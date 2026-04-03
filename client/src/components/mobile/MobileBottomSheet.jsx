import { Drawer } from 'vaul';

export default function MobileBottomSheet({
    open,
    onOpenChange,
    title = '',
    description = '',
    children,
    contentClassName = '',
    bodyClassName = '',
    headerActions = null,
    hideHeader = false,
}) {
    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[580] bg-slate-950/35" />
                <Drawer.Content
                    className={`fixed bottom-0 left-0 right-0 z-[590] flex max-h-[86svh] flex-col rounded-t-[28px] border-t px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 ${contentClassName}`}
                    style={{
                        backgroundColor: 'var(--color-drawer-bg)',
                        borderColor: 'var(--color-border)',
                        boxShadow: '0 -18px 42px rgba(15, 89, 91, 0.18)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Drawer.Title className="sr-only">{title || 'Mobile sheet'}</Drawer.Title>
                    <Drawer.Description className="sr-only">{description || title || 'Open mobile actions'}</Drawer.Description>

                    <div className="mx-auto h-1.5 w-12 rounded-full" style={{ backgroundColor: 'var(--color-border-strong)' }} />

                    {!hideHeader ? (
                        <div className="mt-4 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                {title ? (
                                    <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                                        {title}
                                    </h2>
                                ) : null}
                                {description ? (
                                    <p className="mt-1 text-[13px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                        {description}
                                    </p>
                                ) : null}
                            </div>
                            {headerActions}
                        </div>
                    ) : null}

                    <div className={`min-h-0 flex-1 overflow-y-auto ${hideHeader ? 'mt-3' : 'mt-4'} ${bodyClassName}`}>
                        {children}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
