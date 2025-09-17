import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Chat with Document',
  version: '0.1.0',
  action: { default_popup: 'src/popup/index.html' },
  background: { service_worker: 'src/service-worker.ts', type: 'module' },
  permissions: ['activeTab', 'tabs', 'scripting', 'storage'],
  host_permissions: ['<all_urls>'],
  content_scripts: [{ matches: ['<all_urls>'], js: ['src/content-script.ts'], run_at: 'document_idle' }],
  web_accessible_resources: [{ resources: ['public/pdf.worker.min.js'], matches: ['<all_urls>'] }]
});
