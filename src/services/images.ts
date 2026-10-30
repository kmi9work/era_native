/**
 * Адреса картинок бэкенда: гербы государств и значки ресурсов.
 *
 * `CONFIG.BACKEND_URL` заканчивается на `/backend/`, а статика лежит в корне сайта
 * (`https://<host>/images/...`), поэтому хвост `/backend` отрезается — тем же
 * правилом, что в `useMarketScreenLogic` (оттуда адрес герба и скопирован, чтобы
 * окно уведомления не зависело от экрана «Рынок»).
 */
import { CONFIG } from '../config';
import ApiService from './api';

export const imagesBaseUrl = (): string => {
  const base = (CONFIG.BACKEND_URL || ApiService.getBaseUrl() || '').replace(/\/+$/, '');
  return base.replace(/\/backend$/i, '');
};

/** Герб государства по `flag_image_name` из API. null — рисовать нечего. */
export const countryFlagUrl = (flagImageName?: string | null): string | null => {
  if (!flagImageName) return null;

  const clean = flagImageName.replace(/\.png$/i, '').trim();
  if (!clean) return null;

  return `${imagesBaseUrl()}/images/countries/${encodeURIComponent(clean)}.png`;
};
