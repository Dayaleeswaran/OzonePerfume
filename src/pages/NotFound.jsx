import Icon from '../components/Icon.jsx';
import { Empty } from '../components/common.jsx';
import { useUI } from '../components/ui.jsx';
import { t } from '../lib/i18n.js';
import { useTitle } from '../lib/router.js';

export default function NotFound({ msg }) {
  const ui = useUI();
  useTitle(msg || t('nf.title'));
  return (
    <section className="container section">
      <Empty ic="search" title={msg || t('nf.title')} text={t('nf.text')}>
        <a className="btn btn-primary" href="#/">{t('nav.home')}</a>
        <button className="btn btn-outline" onClick={() => ui.openSearch()}><Icon name="search" /> {t('search.open')}</button>
      </Empty>
    </section>
  );
}
