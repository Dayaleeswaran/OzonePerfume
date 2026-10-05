import { useCallback } from 'react';
import { S } from './store.js';
import { t, pname } from './i18n.js';
import { errorText } from './format.js';
import { useUI } from '../components/ui.jsx';

/* Shop actions shared by cards, product pages, cart and wishlist — each shows feedback */
export function useShopActions() {
  const ui = useUI();

  const addToCart = useCallback((p, sizeId = null, qty = 1, { openDrawer = true } = {}) =>
    S.addToCart(p.id, sizeId, qty).then(() => {
      if (openDrawer) ui.openCart(true);
      ui.announce(t('cart.addedNamed', { name: pname(p) }));
      return true;
    }).catch(err => { ui.toast(errorText(err), 'error'); return false; }), [ui]);

  const toggleWish = useCallback(p =>
    S.toggleWishlist(p.id).then(added => {
      const name = pname(p);
      if (added && !S.user()) ui.toast(t('wish.addedGuest', { name }), 'info', { label: t('nav.login'), href: '/login?next=%2Fwishlist&reason=wishlist' });
      else ui.toast(t(added ? 'wish.added' : 'wish.removed', { name }), added ? 'success' : 'info', added ? { label: t('wish.view'), href: '/wishlist' } : null);
    }).catch(err => ui.toast(errorText(err), 'error')), [ui]);

  const updateQty = useCallback((line, qty) => {
    if (qty < 1) return removeLine(line);
    return S.updateQty(line.id, qty).then(() => ui.announce(t('cart.qtyUpdated', { n: qty }))).catch(err => ui.toast(errorText(err), 'error'));
  }, [ui]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeLine = useCallback(line => {
    const p = S.product(line.productId);
    return S.removeLine(line.id).then(() => {
      ui.toast(t('cart.removed', { name: pname(p) }), 'info', {
        label: t('common.undo'),
        onClick: () => S.addToCart(line.productId, line.sizeId, line.qty, line.gift).catch(err => ui.toast(errorText(err), 'error'))
      });
    }).catch(err => ui.toast(errorText(err), 'error'));
  }, [ui]);

  return { addToCart, toggleWish, updateQty, removeLine, openGift: ui.openGift };
}
