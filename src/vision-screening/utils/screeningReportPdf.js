const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const BODY_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 57;
const INK = "#000";
const BRAND = "#a81f2a";
const RULE = "#d9d9d9";
const REPORT_TITLE = "Preliminary Vision Screening Report";
const FINDING_COLUMNS = [128, 192, 192];
const QUESTION_COLUMNS = [296, 216];
const WIN_ANSI_EXTENDED = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

function encodePdfText(value) {
  let hex = "";
  for (const character of value) {
    const code = character.codePointAt(0);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) {
      hex += code.toString(16).padStart(2, "0");
      continue;
    }
    const index = WIN_ANSI_EXTENDED.indexOf(character);
    if (index < 0 || (code >= 128 && code < 160)) return null;
    hex += (128 + index).toString(16);
  }
  return hex;
}

function pdfColor(color) {
  const hex = color.length === 4 ? Array.from(color.slice(1), (digit) => digit + digit).join("") : color.slice(1);
  return (hex.match(/../g) || []).map((channel) => (Number.parseInt(channel, 16) / 255).toFixed(4)).join(" ");
}

async function renderFallbackLine(line, width) {
  // Use the browser's installed fonts for characters outside WinAnsi.
  const scale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = line.height * scale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare the PDF fallback text.");
  context.scale(scale, scale);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width / scale, line.height);
  context.font = line.font;
  context.textBaseline = "alphabetic";
  context.fillStyle = line.color;
  context.fillText(line.text, 1, line.size * 0.9);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
    rgb[target] = pixels[source];
    rgb[target + 1] = pixels[source + 1];
    rgb[target + 2] = pixels[source + 2];
  }
  const compressed = new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"));
  const data = await new Response(compressed).arrayBuffer();
  return { data: new Uint8Array(data), width: canvas.width, height: canvas.height };
}

function wrapLines(context, value, width) {
  const lines = [];
  for (const paragraph of value.split(/\r\n|\r|\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= width) {
        line = next;
        continue;
      }

      if (line) lines.push(line);
      line = "";
      // Allow long unbroken entries to wrap without overflowing the cell.
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function renderReportPages({ reference, patientDetails, questionnaire, findings, demoOnly }) {
  const pages = [];
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Could not measure the PDF text.");
  let page;
  let y;

  function fill(color, x, top, width, height) {
    page.commands.push(`${pdfColor(color)} rg ${x} ${PAGE_HEIGHT - top - height} ${width} ${height} re f`);
  }

  function textLines(value, width, { size = 10, bold = false, color = INK } = {}) {
    if (!value) return [];
    const font = `${bold ? "bold " : ""}${size}px Arial, sans-serif`;
    context.font = font;
    const height = Math.ceil(size * 1.25);
    return wrapLines(context, value, width).map((text) => ({ text, font, size, bold, color, height }));
  }

  function drawText(lines, x, top, alignRight = false) {
    for (const line of lines) {
      context.font = line.font;
      const width = context.measureText(line.text).width;
      const left = alignRight ? x - width : x;
      const encoded = encodePdfText(line.text);
      if (encoded) {
        const baseline = PAGE_HEIGHT - top - line.size * 0.9;
        const font = line.bold ? "Bold" : "Regular";
        page.commands.push(`BT ${pdfColor(line.color)} rg /${font} ${line.size} Tf 1 0 0 1 ${left.toFixed(3)} ${baseline.toFixed(3)} Tm <${encoded}> Tj ET`);
      } else if (encoded === null) {
        const imageWidth = Math.ceil(width + 2);
        const image = page.images.push(renderFallbackLine(line, imageWidth));
        const bottom = PAGE_HEIGHT - top - line.height;
        page.commands.push(`q ${imageWidth} 0 0 ${line.height} ${(left - 1).toFixed(3)} ${bottom} cm /Line${image} Do Q`);
      }
      top += line.height;
    }
    return top;
  }

  function write(value, style, after = 0) {
    y = drawText(textLines(value, BODY_WIDTH, style), MARGIN, y) + after;
  }

  function newPage() {
    page = { commands: [], images: [] };
    pages.push(page);
    fill("#fff", 0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    drawText(textLines("ACEBEDO PANOL OPTICAL", BODY_WIDTH, { size: 11, bold: true, color: BRAND }), MARGIN, 31);
    drawText(textLines("A comprehensive eye examination is needed for a diagnosis or prescription.", BODY_WIDTH - 64, { size: 9 }), MARGIN, PAGE_HEIGHT - 34);
    drawText(textLines(reference, BODY_WIDTH, { size: 9 }), PAGE_WIDTH - MARGIN, 33, true);
    drawText(textLines(`Page ${pages.length}`, BODY_WIDTH, { size: 9 }), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 34, true);
    fill(RULE, MARGIN, 49, BODY_WIDTH, 0.75);
    fill(RULE, MARGIN, PAGE_HEIGHT - 43, BODY_WIDTH, 0.75);
    y = 67;
  }

  function heading(title) {
    write(title, { size: 14, bold: true }, 4);
  }

  function startSection(title, minimumHeight) {
    y += 8;
    if (y + 22 + minimumHeight > BOTTOM) newPage();
    heading(title);
  }

  function row(columns, cells, { padding = 4, inset = 7, gap = 0, grid = false, rule = grid, background, repeat } = {}) {
    const lines = cells.map((cell, index) => {
      const width = columns[index] - inset * 2 - (index < columns.length - 1 ? gap : 0);
      return cell.flatMap(({ value, ...style }) => textLines(value, width, style));
    });
    const heightOf = (stack) => stack.reduce((height, line) => height + line.height, 0);
    const measuredHeight = Math.max(0, ...lines.map(heightOf)) + padding * 2;

    // Keep a row together if it can fit on an otherwise empty continuation page.
    if (repeat && y + measuredHeight > BOTTOM && measuredHeight <= BOTTOM - 115) {
      newPage();
      repeat();
    }

    do {
      if (repeat && y + padding * 2 + 17 > BOTTOM) {
        newPage();
        repeat();
      }

      const available = BOTTOM - y - padding * 2;
      const portions = lines.map((stack) => {
        let taken = 0;
        let height = 0;
        while (taken < stack.length && height + stack[taken].height <= available) {
          height += stack[taken].height;
          taken += 1;
        }
        return { lines: stack.splice(0, taken), height };
      });
      const height = Math.max(0, ...portions.map((portion) => portion.height)) + padding * 2;
      if (background) fill(background, MARGIN, y, BODY_WIDTH, height);

      let x = MARGIN;
      for (const [index, portion] of portions.entries()) {
        drawText(portion.lines, x + inset, y + padding);
        if (grid) fill(RULE, x, y, 0.75, height);
        x += columns[index];
      }
      if (grid) fill(RULE, x - 0.75, y, 0.75, height);
      if (rule) fill(RULE, MARGIN, y + height - 0.75, BODY_WIDTH, 0.75);
      y += height;
      if (lines.some((stack) => stack.length)) {
        newPage();
        repeat?.();
      }
    } while (lines.some((stack) => stack.length));
  }

  function findingsHeader(continued = false) {
    if (continued) heading("Findings by test (continued)");
    row(FINDING_COLUMNS, ["TEST", "RIGHT EYE", "LEFT EYE"].map((value) => [
      { value, size: 9, bold: true, color: "#fff" },
    ]), { padding: 5, background: BRAND });
  }

  newPage();
  write(REPORT_TITLE, { size: 22, bold: true }, 3);
  write("These are the preliminary findings of the vision screening.", undefined, 3);
  if (demoOnly) write("Demo screening", { bold: true }, 3);
  startSection("Patient and appointment", 60);

  const detailColumns = [156, 165, 191];
  for (let index = 0; index < patientDetails.length; index += detailColumns.length) {
    const cells = patientDetails.slice(index, index + detailColumns.length).map(([label, value]) => [
      { value: label.toUpperCase(), size: 9, bold: true },
      { value, size: 11 },
    ]);
    row(detailColumns, cells, { padding: 3, inset: 0, gap: 10, repeat: () => heading("Patient and appointment (continued)") });
  }

  startSection("Findings by test", findings.length ? 55 : 15);
  if (!findings.length) {
    write("Detailed test findings are unavailable for this record.");
  } else {
    findingsHeader();
    const repeat = () => findingsHeader(true);
    for (const test of findings) {
      const eyeCells = ["Right eye", "Left eye"].map((label) => {
        const eye = test.eyes.find((item) => item.label === label);
        if (!eye) return [{ value: "Unavailable" }];
        const status = eye.metric && eye.status && eye.metric !== eye.status ? `${eye.status}. ` : "";
        return [
          { value: eye.metric || eye.status, bold: true },
          { value: status + eye.text },
        ];
      });
      row(FINDING_COLUMNS, [
        [{ value: test.title, bold: true }, { value: test.subtitle }],
        ...eyeCells,
      ], { padding: 6, grid: true, repeat });
      for (const note of test.notes) {
        row([BODY_WIDTH], [[{ value: note }]], { grid: true, repeat });
      }
    }
  }

  startSection("Questionnaire responses", 22);
  if (!questionnaire.length) {
    write("No questionnaire responses were saved for this record.");
  } else {
    fill(RULE, MARGIN, y, BODY_WIDTH, 0.75);
    const repeat = () => {
      heading("Questionnaire responses (continued)");
      fill(RULE, MARGIN, y, BODY_WIDTH, 0.75);
    };
    for (const { question, answer } of questionnaire) {
      row(QUESTION_COLUMNS, [
        [{ value: question }],
        [{ value: answer, bold: true }],
      ], { padding: 2.5, inset: 0, gap: 12, rule: true, repeat });
    }
  }
  return pages;
}

export async function createScreeningReportPdf(report) {
  const pages = renderReportPages(report);
  const pageImages = await Promise.all(pages.map((page) => Promise.all(page.images)));
  const chunks = [];
  const offsets = [0];
  let length = 0;

  function append(chunk) {
    chunks.push(chunk);
    // All PDF syntax strings here are ASCII, so their character and byte counts match.
    length += typeof chunk === "string" ? chunk.length : chunk.size ?? chunk.byteLength;
  }

  function object(id, content, stream) {
    offsets[id] = length;
    append(`${id} 0 obj\n${content}\n`);
    if (stream) {
      append("stream\n");
      append(stream);
      append("\nendstream\n");
    }
    append("endobj\n");
  }

  append("%PDF-1.4\n");
  append(Uint8Array.of(37, 226, 227, 207, 211, 10));
  const pageIds = pages.map((_, index) => 5 + index * 2);
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  object(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  let nextImageId = 5 + pages.length * 2;
  for (const [index, page] of pages.entries()) {
    const pageId = pageIds[index];
    const pageContent = page.commands.join("\n");
    const imageRefs = pageImages[index].map((image, imageIndex) => {
      const id = nextImageId++;
      object(id, `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.data.byteLength} >>`, image.data);
      return `/Line${imageIndex + 1} ${id} 0 R`;
    });
    const resources = `/Font << /Regular 3 0 R /Bold 4 0 R >> /XObject << ${imageRefs.join(" ")} >>`;
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resources} >> /Contents ${pageId + 1} 0 R >>`);
    object(pageId + 1, `<< /Length ${pageContent.length} >>`, pageContent);
  }

  const xrefOffset = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}
