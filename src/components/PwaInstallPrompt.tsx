import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, Share, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const dismissed = window.sessionStorage.getItem('ogx-o7-install-dismissed') === 'true';
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setVisible(!standalone && !dismissed);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setHelpOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.sessionStorage.setItem('ogx-o7-install-dismissed', 'true');
    setVisible(false);
    setHelpOpen(false);
  };

  const handleInstall = async () => {
    if (!installEvent) {
      setHelpOpen((open) => !open);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      setVisible(false);
    }
  };

  if (!visible || installed) return null;

  const manualSteps = isIos
    ? 'In Safari, tap Share → Add to Home Screen → Add. Turn on “Open as Web App” if it appears.'
    : /android/i.test(navigator.userAgent)
      ? 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.'
      : 'Use the install icon in your browser address bar, or choose “Install app” from its menu.';

  return (
    <>
      {helpOpen && (
        <section role="dialog" aria-label="How to install OG x o7" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 z-50 w-[min(21rem,calc(100vw-1.5rem))] rounded-2xl border border-orange-200/15 bg-[#141720]/[.98] p-4 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:bottom-24 sm:left-6 md:left-[17rem]">
          <div className="flex items-start gap-3">
            <img src="/icons/ogx-o7-192.png" alt="" className="h-10 w-10 rounded-xl" />
            <div className="min-w-0 flex-1"><div className="text-sm font-extrabold">Add OG x o7 to your home screen</div><p className="mt-1.5 text-xs leading-5 text-slate-300">{manualSteps}</p>{isIos && <p className="mt-2 text-[10px] leading-4 text-amber-100/75">Safari requires you to confirm “Add” in its menu; a website can’t install itself automatically.</p>}</div>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close install instructions" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X size={15} /></button>
          </div>
          {isIos && <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/[.04] px-3 py-2 text-[10px] font-semibold text-slate-300"><Share size={14} className="text-cyan-200" /> Share icon <span className="text-slate-500">→</span> Add to Home Screen</div>}
        </section>
      )}
      <aside aria-label="Install app" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-[max(.75rem,env(safe-area-inset-left))] z-[45] flex max-w-[min(22rem,calc(100vw-5.5rem))] items-center gap-2 rounded-2xl border border-orange-200/25 bg-[#111620] p-2 shadow-[0_10px_35px_rgba(0,0,0,.65)] sm:bottom-6 sm:left-6 md:left-[17rem]">
        <img src="/icons/ogx-o7-192.png" alt="" className="h-9 w-9 shrink-0 rounded-xl border border-white/10" />
        <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-extrabold text-white">Install OG x o7</div><div className="truncate text-[9px] text-slate-400">Add it to your home screen</div></div>
        <button type="button" onClick={handleInstall} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-2.5 py-2 text-[10px] font-extrabold text-[#1b1006] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
          {installEvent ? <><ArrowDownToLine size={13} /> Install</> : <><Check size={13} /> {isIos ? 'Steps' : 'Guide'}</>}
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss install app suggestion" className="absolute -right-2 -top-2 rounded-full border border-white/10 bg-[#252a36] p-1 text-slate-300 shadow-lg transition hover:text-white"><X size={11} /></button>
      </aside>
    </>
  );
};
