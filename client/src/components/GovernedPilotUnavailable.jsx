import { Link } from 'react-router-dom';

export default function GovernedPilotUnavailable() {
    return (
        <main className="mx-auto max-w-2xl px-5 py-14">
            <h1 className="text-2xl font-bold">Organisation onboarding is not open yet</h1>
            <p className="mt-3 text-slate-600">New organisation applications and Governed Care Maps will become available when the pilot opens.</p>
            <Link to="/" className="btn-secondary mt-6">Back to CareAround SG</Link>
        </main>
    );
}
