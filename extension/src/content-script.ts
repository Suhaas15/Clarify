import { extractDomText } from './dom-extractor';
import { isPdf, extractPdf } from './pdf-extractor';

(async () => {
  try {
    if (isPdf()) {
      const pdf = await extractPdf();
      chrome.runtime.sendMessage({ type: 'INGEST', payload: { kind: 'pdf', pdf } });
    } else {
      const dom = extractDomText(document);
      chrome.runtime.sendMessage({ type: 'INGEST', payload: { kind: 'html', dom } });
    }
  } catch (e) {
    console.error('Extraction failed', e);
  }
})();
