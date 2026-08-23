/** Wrap markdown tables in a scroll container for responsive layouts */
export function rehypeWrapTables() {
    return (tree) => {
        wrapTables(tree);
    };
}

function wrapTables(node) {
    if (!node?.children?.length) return;

    for (let i = 0; i < node.children.length; i += 1) {
        const child = node.children[i];
        if (child.type === 'element' && child.tagName === 'table') {
            node.children[i] = {
                type: 'element',
                tagName: 'div',
                properties: { className: ['prose-table-wrap'] },
                children: [child],
            };
        } else {
            wrapTables(child);
        }
    }
}
