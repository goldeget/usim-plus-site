import { renderPublicPage } from '../../_lib/public-page-renderer.js';
export const onRequest = context => renderPublicPage(context, 'disclosures/service');
