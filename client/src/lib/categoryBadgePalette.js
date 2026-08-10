const CATEGORY_BADGE_BACKGROUND_ACCENT_WEIGHT = 0.12;
const CATEGORY_BADGE_MINIMUM_TEXT_CONTRAST = 4.5;
const CATEGORY_BADGE_TEXT_ANCHOR = '#0F172A';

function parseHexColor(value) {
    const normalized = normalizeCategoryAccentColor(value);
    if (!normalized) return null;

    const hex = normalized.slice(1);
    return {
        red: Number.parseInt(hex.slice(0, 2), 16),
        green: Number.parseInt(hex.slice(2, 4), 16),
        blue: Number.parseInt(hex.slice(4, 6), 16),
    };
}

function formatHexColor({ red, green, blue }) {
    return `#${[red, green, blue]
        .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
        .join('')}`.toUpperCase();
}

function mixHexColors(source, target, targetWeight) {
    const sourceRgb = parseHexColor(source);
    const targetRgb = parseHexColor(target);
    if (!sourceRgb || !targetRgb) return '';

    const weight = Math.min(Math.max(Number(targetWeight) || 0, 0), 1);
    return formatHexColor({
        red: sourceRgb.red + ((targetRgb.red - sourceRgb.red) * weight),
        green: sourceRgb.green + ((targetRgb.green - sourceRgb.green) * weight),
        blue: sourceRgb.blue + ((targetRgb.blue - sourceRgb.blue) * weight),
    });
}

function getRelativeLuminance(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return 0;

    const channels = [rgb.red, rgb.green, rgb.blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

export function normalizeCategoryAccentColor(value) {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase();
    if (!/^#[0-9a-f]{3}$/i.test(text)) return '';

    return `#${text.slice(1).split('').map((character) => character.repeat(2)).join('')}`.toUpperCase();
}

export function getColorContrastRatio(firstColor, secondColor) {
    const firstLuminance = getRelativeLuminance(firstColor);
    const secondLuminance = getRelativeLuminance(secondColor);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

export function buildCategoryBadgePalette(value) {
    const accentColor = normalizeCategoryAccentColor(value);
    if (!accentColor) return null;

    const backgroundColor = mixHexColors(
        '#FFFFFF',
        accentColor,
        CATEGORY_BADGE_BACKGROUND_ACCENT_WEIGHT,
    );
    let textColor = accentColor;

    if (getColorContrastRatio(textColor, backgroundColor) < CATEGORY_BADGE_MINIMUM_TEXT_CONTRAST) {
        for (let step = 1; step <= 20; step += 1) {
            const candidate = mixHexColors(accentColor, CATEGORY_BADGE_TEXT_ANCHOR, step / 20);
            if (getColorContrastRatio(candidate, backgroundColor) >= CATEGORY_BADGE_MINIMUM_TEXT_CONTRAST) {
                textColor = candidate;
                break;
            }
        }
    }

    if (getColorContrastRatio(textColor, backgroundColor) < CATEGORY_BADGE_MINIMUM_TEXT_CONTRAST) {
        textColor = CATEGORY_BADGE_TEXT_ANCHOR;
    }

    return {
        accentColor,
        backgroundColor,
        textColor,
    };
}
