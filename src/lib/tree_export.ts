import { Page } from './fumen/types';
import { Pages } from './pages';
import { SerializedTree } from './fumen/tree_types';
import { getNodeDfsNumbers } from './fumen/tree_utils';
import {
    calculateTreeViewLayout,
    TREE_HORIZONTAL_GAP,
    TREE_NODE_RADIUS,
    TREE_NODE_WIDTH,
    TREE_PADDING,
    TREE_THUMBNAIL_WIDTH,
} from './fumen/tree_view_layout';
import { BLOCK_SIZE, drawThumbnail, EXPORT_SCALE, getPageCommentText } from './thumbnail';

export function generateTreeViewExportImage(
    pages: Page[],
    guideLineColor: boolean,
    tree: SerializedTree,
    trimTopBlank: boolean = false,
): string {
    if (!tree.rootId || tree.nodes.length === 0 || pages.length === 0) {
        return '';
    }

    // Calculate layout
    const treeViewLayout = calculateTreeViewLayout(tree, pages, trimTopBlank);
    const { layout } = treeViewLayout;
    const dfsNumbers = getNodeDfsNumbers(tree);

    // Calculate canvas dimensions
    const canvasWidth = TREE_PADDING * 2 + (layout.maxDepth + 1) * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
    const canvasHeight = TREE_PADDING * 2 + treeViewLayout.contentHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * EXPORT_SCALE;
    canvas.height = canvasHeight * EXPORT_SCALE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const pagesObj = new Pages(pages);

    // Draw connections first (behind nodes)
    layout.connections.forEach((conn) => {
        const fromPos = treeViewLayout.nodeLayouts.get(conn.fromId);
        const toPos = treeViewLayout.nodeLayouts.get(conn.toId);
        if (!fromPos || !toPos) return;

        const x1 = fromPos.x + TREE_NODE_WIDTH;
        const y1 = fromPos.y + fromPos.height / 2;
        const x2 = toPos.x;
        const y2 = toPos.y + toPos.height / 2;

        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1.5;

        if (conn.isBranch) {
            // Curved path for branches
            const midX = (x1 + x2) / 2;
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
        } else {
            // Straight line for main route
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    });

    // Draw nodes
    tree.nodes.forEach((node) => {
        if (node.pageIndex < 0) return;

        const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
        if (!nodeLayout) return;

        const x = nodeLayout.x;
        const y = nodeLayout.y;
        const nodeHeight = nodeLayout.height;
        const thumbnailHeight = nodeLayout.thumbnailHeight;
        const dfsNumber = dfsNumbers.get(node.id) ?? 0;

        const hasBranch = node.childrenIds.length > 1;
        drawTreeNode(
            ctx,
            pages,
            pagesObj,
            node.pageIndex,
            x,
            y,
            nodeHeight,
            thumbnailHeight,
            guideLineColor,
            dfsNumber,
            hasBranch,
            trimTopBlank,
        );
    });

    return canvas.toDataURL('image/png');
}

function drawTreeNode(
    ctx: CanvasRenderingContext2D,
    pages: Page[],
    pagesObj: Pages,
    pageIndex: number,
    x: number,
    y: number,
    nodeHeight: number,
    thumbnailHeight: number,
    guideLineColor: boolean,
    dfsNumber: number,
    hasBranches: boolean,
    trimTopBlank: boolean,
): void {
    // Node background
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x + TREE_NODE_RADIUS, y);
    ctx.lineTo(x + TREE_NODE_WIDTH - TREE_NODE_RADIUS, y);
    ctx.arcTo(x + TREE_NODE_WIDTH, y, x + TREE_NODE_WIDTH, y + TREE_NODE_RADIUS, TREE_NODE_RADIUS);
    ctx.lineTo(x + TREE_NODE_WIDTH, y + nodeHeight - TREE_NODE_RADIUS);
    ctx.arcTo(x + TREE_NODE_WIDTH, y + nodeHeight, x + TREE_NODE_WIDTH - TREE_NODE_RADIUS,
        y + nodeHeight, TREE_NODE_RADIUS);
    ctx.lineTo(x + TREE_NODE_RADIUS, y + nodeHeight);
    ctx.arcTo(x, y + nodeHeight, x, y + nodeHeight - TREE_NODE_RADIUS, TREE_NODE_RADIUS);
    ctx.lineTo(x, y + TREE_NODE_RADIUS);
    ctx.arcTo(x, y, x + TREE_NODE_RADIUS, y, TREE_NODE_RADIUS);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw thumbnail
    const thumbX = x + (TREE_NODE_WIDTH - TREE_THUMBNAIL_WIDTH) / 2;
    const thumbY = y + 8;
    const visibleTopRow = trimTopBlank
        ? Math.max(0, Math.round(thumbnailHeight / BLOCK_SIZE) - 1)
        : undefined;
    drawThumbnail(ctx, pages, pageIndex, thumbX, thumbY, guideLineColor, trimTopBlank, visibleTopRow);

    // DFS order number
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`#${dfsNumber}`, x + TREE_NODE_WIDTH / 2, thumbY + thumbnailHeight + 20);

    // Comment text
    let commentText = '';
    try {
        commentText = getPageCommentText(pagesObj, pageIndex);
    } catch {
        commentText = '';
    }

    if (commentText) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';

        // Truncate and wrap comment
        const maxCharsPerLine = 12;
        const maxLines = 3;
        const lines: string[] = [];
        let remaining = commentText;
        while (remaining.length > 0 && lines.length < maxLines) {
            if (remaining.length <= maxCharsPerLine) {
                lines.push(remaining);
                break;
            }
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
        }
        if (commentText.length > maxCharsPerLine * maxLines && lines.length > 0) {
            lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
        }

        lines.forEach((line, idx) => {
            ctx.fillText(line, x + TREE_NODE_WIDTH / 2, thumbY + thumbnailHeight + 38 + idx * 14);
        });
    }

    // Reset text align
    ctx.textAlign = 'left';
}
