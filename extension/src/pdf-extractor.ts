import * as pdfjs from 'pdfjs-dist';
(pdfjs as any).GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('public/pdf.worker.min.js');

export const isPdf = () =>
  !!document.querySelector('embed[type="application/pdf"], .pdfViewer, #viewer');

export async function extractPdf() {
  const embed = document.querySelector('embed[type="application/pdf"]') as HTMLObjectElement | null;
  const url = embed?.getAttribute('src') || location.href;

  const buf = await fetch(url, { credentials: 'include' }).then(r => r.arrayBuffer());
  const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;

  const textByPage: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    textByPage.push(content.items.map((i: any) => i.str).join(' '));
  }
  return { title: document.title || url, url, textByPage, pageCount: pdf.numPages };
}

