/** Storage açarından ictimai URL. Production-da Caddy /media/*-i birbaşa volume-dan verir. */
export const mediaUrl = (key: string) => `/media/${key}`;
