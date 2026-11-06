import './MapLayerInspector.css';

export function MapLayerReadout({ result, messages, compact = false }) {
    const groups = ['resources', 'areas', 'annotations'];
    const count = groups.reduce((sum, key) => sum + (result?.[key]?.length || 0), 0);
    return <div className={`map-layer-readout${compact ? ' map-layer-readout--compact' : ''}`} data-map-layer-readout="true">
        {!count ? <p>{messages.empty}</p> : groups.map(key => result?.[key]?.length ? <section key={key} data-map-layer-group={key}>
            <h3>{messages[key]} <span>{result[key].length}</span></h3>
            <ul>{result[key].map(item => <li key={item.id} data-map-layer-id={item.id}>
                <span>{item.name || messages[item.type] || messages.annotations}</span>
                {!compact && key === 'resources' && item.placeName && item.placeName !== item.name ? <small>{item.placeName}</small> : null}
                {!compact && item.cluster ? <small>{messages.cluster}</small> : null}
            </li>)}</ul>
        </section> : null)}
    </div>;
}

export default function MapLayerInspector({ inspection, messages }) {
    if (!inspection) return null;
    const width = Math.min(280, window.innerWidth - 24);
    const count = ['resources', 'areas', 'annotations'].reduce((sum, key) => sum + (inspection.result?.[key]?.length || 0), 0);
    return <aside className="map-layer-pointer-card" aria-label={messages.pointer} data-map-layer-pointer-card="true"
        style={{ width, left: Math.max(12, Math.min(inspection.x + 18, window.innerWidth - width - 12)),
            top: Math.max(12, Math.min(inspection.y + 18, window.innerHeight - 210)) }}>
        <h2>{messages.pointer}</h2><MapLayerReadout result={inspection.result} messages={messages} compact />
        <footer data-map-layer-passive-footer="true">
            <strong>{messages.count.replace('{count}', count)}</strong><span>{messages.fullList}</span>
        </footer>
    </aside>;
}
