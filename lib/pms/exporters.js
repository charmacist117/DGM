export function downloadReportBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(filename, content, type = "application/json") {
  downloadReportBlob(new Blob([content], { type }), filename);
}

export function getCanvasTextLines(context, value, maxWidth) {
  const lines = [];
  for (const sourceLine of String(value ?? "-").split(/\r?\n/)) {
    let line = "";
    for (const character of sourceLine) {
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function drawCanvasTable(context, { headers, rows, widths, x, y }) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  widths = widths.map((width) => width * (context.canvas.width - x * 2) / totalWidth);
  const headerHeight = 46;
  const lineHeight = 24;
  const padding = 10;
  const headerPadding = 6;
  let currentX = x;

  context.textBaseline = "top";
  for (const [index, header] of headers.entries()) {
    context.fillStyle = "#dbeafe";
    context.fillRect(currentX, y, widths[index], headerHeight);
    context.strokeStyle = "#94a3b8";
    context.strokeRect(currentX, y, widths[index], headerHeight);
    context.fillStyle = "#0f172a";
    const text = String(header ?? "-");
    const availableWidth = Math.max(1, widths[index] - headerPadding * 2);
    context.font = "700 17px 'Malgun Gothic', Arial, sans-serif";
    const measuredWidth = context.measureText(text).width;
    const fontSize = measuredWidth > availableWidth
      ? Math.max(6, Math.floor(17 * availableWidth / measuredWidth))
      : 17;
    context.font = `700 ${fontSize}px 'Malgun Gothic', Arial, sans-serif`;
    context.fillText(text, currentX + headerPadding, y + Math.max(5, Math.floor((headerHeight - fontSize) / 2)), availableWidth);
    currentX += widths[index];
  }

  let currentY = y + headerHeight;
  rows.forEach((row, rowIndex) => {
    context.font = "16px 'Malgun Gothic', Arial, sans-serif";
    const lineSets = row.map((value, index) => getCanvasTextLines(context, value, widths[index] - padding * 2));
    const rowHeight = Math.max(50, Math.max(...lineSets.map((lines) => lines.length)) * lineHeight + padding * 2);
    currentX = x;
    row.forEach((value, index) => {
      context.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      context.fillRect(currentX, currentY, widths[index], rowHeight);
      context.strokeStyle = "#cbd5e1";
      context.strokeRect(currentX, currentY, widths[index], rowHeight);
      context.fillStyle = "#0f172a";
      lineSets[index].forEach((line, lineIndex) => {
        context.fillText(line, currentX + padding, currentY + padding + lineIndex * lineHeight);
      });
      currentX += widths[index];
    });
    currentY += rowHeight;
  });
  return currentY;
}
