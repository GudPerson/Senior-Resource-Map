import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function DirectoryQrCode({
    value,
    className = '',
    compact = false,
}) {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;

        async function generate() {
            if (!value) {
                setSrc('');
                return;
            }

            try {
                const dataUrl = await QRCode.toDataURL(value, {
                    errorCorrectionLevel: 'M',
                    margin: 1,
                    width: 144,
                    color: {
                        dark: '#0f172a',
                        light: '#0000',
                    },
                });
                if (active) {
                    setSrc(dataUrl);
                }
            } catch (error) {
                console.error('Failed to generate directory QR code', error);
                if (active) {
                    setSrc('');
                }
            }
        }

        generate();

        return () => {
            active = false;
        };
    }, [value]);

    if (!value) return null;

    if (compact) {
        return (
            <div className={`rounded-[18px] border border-slate-200 bg-white p-2.5 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                        {src ? (
                            <img src={src} alt="QR code linking to the interactive directory" className="h-12 w-12" />
                        ) : (
                            <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">Interactive directory</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">Scan to open</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Open the live shared directory.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-[24px] border border-slate-200 bg-white p-4 ${className}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">Interactive directory</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Scan to open interactive directory</p>
            <div className="mt-3 flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                    {src ? (
                        <img src={src} alt="QR code linking to the interactive directory" className="h-20 w-20" />
                    ) : (
                        <div className="h-16 w-16 animate-pulse rounded-xl bg-slate-200" />
                    )}
                </div>
                <p className="text-xs leading-6 text-slate-500">
                    Use the live shared page for map interaction, saving, and the full directory context.
                </p>
            </div>
        </div>
    );
}
