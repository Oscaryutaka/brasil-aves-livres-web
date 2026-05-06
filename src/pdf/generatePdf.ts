import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Bird, PdfOptions, PrintItem } from '../types';

const mm = {
  pageWidth: 210,
  pageHeight: 297,
  margin: 12,
  headerHeight: 20,
  footerHeight: 10,
};

const fixedGrid = {
  columns: 3,
  rows: 4,
};

type RenderEntry = {
  bird: Bird;
};

export async function generateBirdPdf(
  catalog: Bird[],
  items: PrintItem[],
  options: PdfOptions,
) {
  const entries = expandItems(catalog, items);

  if (entries.length === 0) {
    throw new Error('Adicione pelo menos uma ave antes de gerar o PDF.');
  }

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const qrCache = new Map<string, string>();
  const columns = fixedGrid.columns;
  const rows = fixedGrid.rows;
  const cellsPerPage = columns * rows;

  for (let index = 0; index < entries.length; index += cellsPerPage) {
    if (index > 0) {
      pdf.addPage();
    }

    drawPageFrame(pdf, options);
    const pageEntries = entries.slice(index, index + cellsPerPage);

    for (const [slot, entry] of pageEntries.entries()) {
      const qr = await qrFor(entry.bird.url, qrCache);
      drawBirdCell(pdf, entry.bird, qr, slot, columns, rows, options);
    }
  }

  if (options.showPageNumbers) {
    addPageNumbers(pdf);
  }

  pdf.save(filenameFromTitle(options.title));
}

function expandItems(catalog: Bird[], items: PrintItem[]): RenderEntry[] {
  const catalogById = new Map(catalog.map((bird) => [bird.id, bird]));
  const entries: RenderEntry[] = [];

  for (const item of items) {
    const bird = item.customBird ?? catalogById.get(item.birdId);
    if (!bird) continue;

    for (let i = 0; i < Math.max(1, item.copies); i += 1) {
      entries.push({ bird });
    }
  }

  return entries;
}

async function qrFor(url: string, cache: Map<string, string>) {
  const cached = cache.get(url);
  if (cached) return cached;

  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });

  cache.set(url, dataUrl);
  return dataUrl;
}

function drawPageFrame(pdf: jsPDF, options: PdfOptions) {
  pdf.setFillColor('#ffffff');
  pdf.rect(0, 0, mm.pageWidth, mm.pageHeight, 'F');
  pdf.setTextColor('#1f2933');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(options.title || 'BRASIL AVES LIVRES', mm.pageWidth / 2, 15, { align: 'center' });
  pdf.setDrawColor('#d3c6ae');
  pdf.setLineWidth(0.2);
  pdf.line(mm.margin, 21, mm.pageWidth - mm.margin, 21);
}

function drawBirdCell(
  pdf: jsPDF,
  bird: Bird,
  qrDataUrl: string,
  slot: number,
  columns: number,
  rows: number,
  options: PdfOptions,
) {
  const contentTop = mm.headerHeight + 8;
  const contentHeight = mm.pageHeight - contentTop - mm.footerHeight - mm.margin;
  const contentWidth = mm.pageWidth - mm.margin * 2;
  const column = slot % columns;
  const row = Math.floor(slot / columns);
  const gap = 4;
  const cellWidth = (contentWidth - gap * (columns - 1)) / columns;
  const cellHeight = (contentHeight - gap * (rows - 1)) / rows;
  const x = mm.margin + column * (cellWidth + gap);
  const y = contentTop + row * (cellHeight + gap);

  pdf.setFillColor('#ffffff');
  pdf.setDrawColor('#d1d5db');
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, cellWidth, cellHeight, 'FD');

  const qrMax = Math.min(cellWidth - 18, cellHeight - 28, 42);
  const qrX = x + (cellWidth - qrMax) / 2;
  const qrY = y + 7;
  pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrMax, qrMax);

  const nameY = qrY + qrMax + 7;
  pdf.setTextColor('#18202a');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(bird.nomePopular, x + cellWidth / 2, nameY, { align: 'center', maxWidth: cellWidth - 8 });

  let nextY = nameY + 5;

  if (options.showScientificName && bird.nomeCientifico) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor('#58616d');
    pdf.text(bird.nomeCientifico, x + cellWidth / 2, nextY, { align: 'center', maxWidth: cellWidth - 8 });
    nextY += 4;
  }

  if (options.showUrl) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor('#6b7280');
    pdf.text(bird.url, x + cellWidth / 2, nextY, { align: 'center', maxWidth: cellWidth - 8 });
  }
}

function addPageNumbers(pdf: jsPDF) {
  const pageCount = pdf.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setTextColor('#6b6255');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(`Pagina ${page} de ${pageCount}`, mm.pageWidth - mm.margin, mm.pageHeight - 7, {
      align: 'right',
    });
  }
}

function filenameFromTitle(title: string) {
  const slug = (title || 'brasil-aves-livres')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${slug || 'brasil-aves-livres'}-qrcodes.pdf`;
}
