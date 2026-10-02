import { Link } from 'react-router-dom';
import { safeGuideActionRoute } from '../../lib/supportInbox.js';
import { safeHelpArticleRoute } from '../help/helpLibrary.js';

export default function GuideActionLinks({ actions = [], signedIn = false }) {
    if (!Array.isArray(actions)) return null;
    return actions.map((item) => {
        const path = item?.route;
        const directoryRoute = signedIn && ['/my-directory?section=my-maps', '/my-directory?section=my-places'].includes(path) ? path : null;
        const route = safeGuideActionRoute(path, signedIn) || directoryRoute
            || (path === '/help-centre' ? path : safeHelpArticleRoute(path));
        if (!route || route === '/help?tab=report') return null;
        return <Link className="btn-ghost text-sm" key={route} to={route}>{item.label}</Link>;
    });
}
