const WHATSAPP_TAB_NAME = 'ogx-whatsapp-messages';

export const openWhatsAppTab = (url: string) => {
  const whatsappTab = window.open(url, WHATSAPP_TAB_NAME);
  if (whatsappTab) whatsappTab.opener = null;
};
