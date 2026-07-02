import { useRef, useState } from 'react';
import { Eye, Info, Save, X } from 'lucide-react';

const SKIP_VALIDITY_SELECTOR = '[data-resource-wizard-skip-validity]';

export default function ResourceWizardShell({
    steps,
    activeStep,
    setActiveStep,
    validateStep,
    error,
    renderStep,
    onCancel,
    onSave,
    saving = false,
    saveLabel = 'Save',
    savingLabel = 'Saving...',
    previewLabel = 'Preview',
    previewTitle = 'Resource preview',
    previewDescription = 'Unsaved edits shown as a public resource detail page.',
    renderPreview,
    shellClassName = 'h-[74vh] max-h-[760px]',
}) {
    const [showPreview, setShowPreview] = useState(false);
    const [validationAttempted, setValidationAttempted] = useState(false);
    const workspaceRef = useRef(null);

    function canOpenStep(index) {
        if (index <= activeStep || !validateStep) return true;
        setValidationAttempted(true);
        const stepValid = validateStep();
        const visibleControlsValid = validateVisibleControls({ report: false });
        if (stepValid && visibleControlsValid) {
            setValidationAttempted(false);
            return true;
        }
        return false;
    }

    function isVisibleControl(control) {
        if (control.type === 'hidden') return false;
        if (typeof control.checkVisibility === 'function') {
            return control.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
        }
        return Boolean(control.offsetParent || control.getClientRects().length);
    }

    function validateVisibleControls({ report = true } = {}) {
        const controls = Array.from(workspaceRef.current?.querySelectorAll('input, select, textarea') || []);
        const invalidControl = controls.find((control) => (
            isVisibleControl(control)
            && !control.closest(SKIP_VALIDITY_SELECTOR)
            && !control.checkValidity()
        ));
        if (!invalidControl) return true;
        if (report) {
            invalidControl.reportValidity();
            invalidControl.focus?.();
        }
        return false;
    }

    function handleSave() {
        setValidationAttempted(true);
        const stepValid = validateStep ? validateStep() : true;
        const visibleControlsValid = validateVisibleControls();
        if (!stepValid || !visibleControlsValid) return;
        setValidationAttempted(false);
        onSave?.();
    }

    return (
        <div className={`resource-wizard-shell flex flex-col overflow-hidden ${shellClassName}`}>
            <div className="resource-wizard-tabbar shrink-0 bg-white pb-4">
                <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
                    {steps.map((step, index) => (
                        <button
                            key={step}
                            type="button"
                            onClick={() => {
                                if (canOpenStep(index)) setActiveStep(index);
                            }}
                            className={`flex min-h-[48px] items-center justify-center gap-2 border-r border-slate-200 px-2 text-sm font-black last:border-r-0 ${index === activeStep ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-white'}`}
                        >
                            <span className="truncate">{step}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div ref={workspaceRef} className={`resource-wizard-workspace min-h-0 flex-1 overflow-y-auto pr-1 ${validationAttempted ? 'resource-wizard-guidance-active' : ''}`}>
                <div className="space-y-6 pb-4">
                    {error ? (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" aria-live="polite">
                            <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-amber-700 shadow-sm">
                                <Info size={18} />
                            </span>
                            <div className="space-y-1">
                                <p className="font-black text-amber-950">Required detail needed</p>
                                <p className="font-semibold">{error}</p>
                                <p className="text-xs font-semibold leading-5 text-amber-800">The field that needs attention is highlighted below. Your draft is still here.</p>
                            </div>
                        </div>
                    ) : null}
                    {renderStep?.(activeStep)}
                </div>
            </div>

            <div className="resource-wizard-footer flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white pt-5">
                <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
                <div className="flex flex-wrap justify-end gap-3">
                    {renderPreview ? (
                        <button type="button" className="btn-secondary" onClick={() => setShowPreview(true)} disabled={saving}>
                            <Eye size={16} /> <span>{previewLabel}</span>
                        </button>
                    ) : null}
                    <button type="button" onClick={handleSave} className="btn-primary" disabled={saving}>
                        <Save size={16} /> {saving ? savingLabel : saveLabel}
                    </button>
                </div>
            </div>

            {showPreview && renderPreview ? (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={previewTitle}>
                    <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-black text-slate-950">{previewTitle}</h3>
                                {previewDescription ? <p className="mt-1 text-sm font-semibold text-slate-500">{previewDescription}</p> : null}
                            </div>
                            <button type="button" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" onClick={() => setShowPreview(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="min-h-0 overflow-y-auto rounded-[28px] bg-slate-50 p-4">
                            {renderPreview()}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
