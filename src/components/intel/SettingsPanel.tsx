'use client';

import { useSettingsStore, type TextScale } from '@/store/useSettingsStore';
import { useT, LANGS, type MsgKey } from '@/lib/i18n';
import { WorkspaceHeader, Card, SegButton } from '@/components/ui/kit';

const SCALES: TextScale[] = ['md', 'lg', 'xl'];

const SHORTCUTS: [string, string, string][] = [
  ['/', 'Rechercher', 'Search'],
  ['R', 'Actualiser les données', 'Refresh data'],
  ['?', 'Aide', 'Help'],
  ['Esc', 'Fermer le panneau ou la fiche', 'Close panel or record'],
  ['↑ ↓ / J K', 'Parcourir le flux', 'Move through the feed'],
  ['1 – 9', 'Changer de vue', 'Switch view'],
];

export default function SettingsPanel() {
  const { t, lang } = useT();
  const setLang = useSettingsStore((s) => s.setLang);
  const scale = useSettingsStore((s) => s.scale);
  const setScale = useSettingsStore((s) => s.setScale);

  return (
    <div className="h-full flex flex-col bg-b0 min-h-0">
      <WorkspaceHeader title={t('set.title')} hint={t('set.hint')} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 md:p-4 grid gap-3 max-w-2xl" data-testid="settings">
          <Card title={t('set.language')} hint={t('set.language.note')}>
            <div className="flex" role="group" aria-label={t('set.language')}>
              {LANGS.map((l) => (
                <SegButton key={l.code} active={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</SegButton>
              ))}
            </div>
          </Card>
          <Card title={t('set.text')}>
            <div className="flex" role="group" aria-label={t('set.text')} data-testid="text-scale">
              {SCALES.map((s) => (
                <SegButton key={s} active={scale === s} onClick={() => setScale(s)}>{t(`set.text.${s}` as MsgKey)}</SegButton>
              ))}
            </div>
            <p className="text-xs text-t2 mt-2 leading-relaxed">{t('set.text.sample')}</p>
          </Card>
          <Card title={t('set.motion')}><p className="text-2xs text-t3">{t('set.motion.note')}</p></Card>
          <Card title={t('set.shortcuts')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-2xs">
              {SHORTCUTS.map(([k, fr, en]) => (
                <div key={k} className="contents">
                  <dt><kbd className="font-data text-t1 border border-b3 rounded px-1.5 py-0.5 bg-b2">{k}</kbd></dt>
                  <dd className="text-t2 self-center">{lang === 'fr' ? fr : en}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title={t('set.about')}><p className="text-2xs text-t3 leading-relaxed">{t('set.about.body')}</p></Card>
        </div>
      </div>
    </div>
  );
}
