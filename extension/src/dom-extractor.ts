export function extractDomText(doc: Document) {
  const drop = ['nav','footer','script','style','noscript','iframe','svg','canvas'];
  drop.forEach(sel => doc.querySelectorAll(sel).forEach(n => n.remove()));
  const parts: string[] = [];
  doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,td').forEach(el => {
    const t = el.textContent?.trim();
    if (t) parts.push(t);
  });
  return { title: doc.title || location.href, url: location.href, text: parts.join('\n\n') };
}

