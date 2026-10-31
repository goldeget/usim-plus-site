import { SERVICE_FACTS } from './service-facts.js';
import { loadPublicContent } from '../api/content.js';

export async function loadPublicInformation(env = {}) {
  const { content, contentSource } = await loadPublicContent(env);
  return {
    ...SERVICE_FACTS,
    operator: content.operator,
    supportLinks: content.supportLinks,
    payout: content.payout,
    contentSource
  };
}
