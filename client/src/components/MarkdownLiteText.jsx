import React from 'react';

const INLINE_TOKEN_PATTERN = /(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*)/g;
const LIST_ITEM_PATTERN = /^(\s*)([-+*]|\d+\.)\s+(.+)$/;

function isOrderedMarker(marker) {
    return /^\d+\.$/.test(marker);
}

function splitTrailingUrlPunctuation(value) {
    const match = String(value || '').match(/^(.*?)([.,!?;:)]*)$/);
    return {
        url: match?.[1] || value,
        trailing: match?.[2] || '',
    };
}

function renderInlineMarkdown(text, linkClassName) {
    const source = String(text || '');
    const nodes = [];
    let lastIndex = 0;

    source.replace(INLINE_TOKEN_PATTERN, (match, _fullLink, linkLabel, linkUrl, bareUrl, boldText, italicText, offset) => {
        if (offset > lastIndex) {
            nodes.push(source.slice(lastIndex, offset));
        }

        if (linkUrl) {
            nodes.push(
                <a
                    key={`link-${offset}`}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClassName}
                    onClick={(event) => event.stopPropagation()}
                >
                    {linkLabel}
                </a>
            );
        } else if (bareUrl) {
            const { url, trailing } = splitTrailingUrlPunctuation(bareUrl);
            nodes.push(
                <a
                    key={`url-${offset}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClassName}
                    onClick={(event) => event.stopPropagation()}
                >
                    {url}
                </a>
            );
            if (trailing) nodes.push(trailing);
        } else if (boldText) {
            nodes.push(<strong key={`bold-${offset}`}>{boldText}</strong>);
        } else if (italicText) {
            nodes.push(<em key={`italic-${offset}`}>{italicText}</em>);
        } else {
            nodes.push(match);
        }

        lastIndex = offset + match.length;
        return match;
    });

    if (lastIndex < source.length) {
        nodes.push(source.slice(lastIndex));
    }

    return nodes;
}

function buildBlocks(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let currentParagraph = [];
    let currentList = null;

    function flushParagraph() {
        if (!currentParagraph.length) return;
        blocks.push({ type: 'paragraph', lines: currentParagraph });
        currentParagraph = [];
    }

    function flushList() {
        if (!currentList) return;
        blocks.push(currentList);
        currentList = null;
    }

    lines.forEach((line) => {
        if (!line.trim()) {
            flushParagraph();
            flushList();
            return;
        }

        const listMatch = line.match(LIST_ITEM_PATTERN);
        if (listMatch) {
            flushParagraph();
            const [, leadingSpace, marker, content] = listMatch;
            const ordered = isOrderedMarker(marker);
            if (!currentList || currentList.ordered !== ordered) {
                flushList();
                currentList = { type: 'list', ordered, items: [] };
            }
            currentList.items.push({
                indent: Math.floor((leadingSpace || '').length / 2),
                content,
            });
            return;
        }

        flushList();
        currentParagraph.push(line);
    });

    flushParagraph();
    flushList();
    return blocks;
}

export default function MarkdownLiteText({
    text,
    className = '',
    compact = false,
    linkClassName = 'text-brand-600 hover:underline break-all',
    style = undefined,
}) {
    if (!text) return null;

    const blocks = buildBlocks(text);
    const rootSpacing = compact ? 'space-y-1' : 'space-y-2';
    const listSpacing = compact ? 'space-y-0.5' : 'space-y-1';

    return (
        <div className={`${rootSpacing} ${className}`.trim()} style={style}>
            {blocks.map((block, blockIndex) => {
                if (block.type === 'list') {
                    const ListTag = block.ordered ? 'ol' : 'ul';
                    const listClassName = `${block.ordered ? 'list-decimal' : 'list-disc'} ${listSpacing} pl-5`;

                    return (
                        <ListTag key={`list-${blockIndex}`} className={listClassName}>
                            {block.items.map((item, itemIndex) => (
                                <li
                                    key={`item-${blockIndex}-${itemIndex}`}
                                    style={item.indent ? { marginLeft: `${item.indent}rem` } : undefined}
                                >
                                    {renderInlineMarkdown(item.content, linkClassName)}
                                </li>
                            ))}
                        </ListTag>
                    );
                }

                return (
                    <p key={`paragraph-${blockIndex}`} className="whitespace-pre-wrap">
                        {renderInlineMarkdown(block.lines.join('\n'), linkClassName)}
                    </p>
                );
            })}
        </div>
    );
}
