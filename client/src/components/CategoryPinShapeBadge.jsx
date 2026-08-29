import {
    getCategoryPinShapePath,
    getCategoryPinShapeTextY,
    normalizeCategoryPinShape,
} from '../lib/categoryPinShapes.js';
import { getCategoryPinLabelColor } from '../lib/categoryPinStyles.js';

function normalizeFill(value) {
    const color = String(value || '').trim();
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : '#0f766e';
}

export default function CategoryPinShapeBadge({
    shape = 'circle',
    color = '#0f766e',
    ringColor = '#ffffff',
    label = '',
    compact = false,
    selected = false,
    className = '',
}) {
    const normalizedShape = normalizeCategoryPinShape(shape);
    const text = String(label || '').replace(/^#/, '').trim();
    const fontSize = text.length > 2 ? 31 : text.length > 1 ? 37 : 42;
    const sizeClassName = compact
        ? 'h-[22px] w-[22px] min-w-[22px]'
        : 'h-[30px] w-[30px] min-w-[30px]';

    return (
        <span
            aria-hidden="true"
            data-print-number-badge={text ? 'true' : undefined}
            data-category-pin-shape={normalizedShape}
            className={`inline-flex flex-shrink-0 items-center justify-center ${sizeClassName} ${className}`}
            style={{
                filter: selected
                    ? 'drop-shadow(0 7px 9px rgba(194,65,12,0.24)) drop-shadow(0 0 4px rgba(249,115,22,0.36))'
                    : 'drop-shadow(0 5px 6px rgba(15,23,42,0.16))',
            }}
        >
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" focusable="false">
                <path
                    d={getCategoryPinShapePath(normalizedShape)}
                    fill={normalizeFill(color)}
                    stroke={normalizeFill(ringColor)}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
                {text ? (
                    <text
                        x="50"
                        y={getCategoryPinShapeTextY(normalizedShape)}
                        fill={getCategoryPinLabelColor(color)}
                        fontFamily="var(--font-heading)"
                        fontSize={fontSize}
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ textShadow: '0 1px 2px rgba(15,23,42,0.22)' }}
                    >
                        {text}
                    </text>
                ) : null}
            </svg>
        </span>
    );
}
