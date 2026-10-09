import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function ScrollArrows({ targetRef, className = '' }) {
  const location = useLocation();
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const page = document.scrollingElement;
    if (!page) return;
    const target = targetRef?.current;
    const scrollTop = target ? target.scrollTop : page.scrollTop;
    const clientHeight = target ? target.clientHeight : window.innerHeight;
    const maxScroll = (target ? target.scrollHeight : page.scrollHeight) - clientHeight;
    setCanScrollUp(scrollTop > 24);
    setCanScrollDown(maxScroll - scrollTop > 24);
  }, [targetRef]);

  useEffect(() => {
    const page = document.scrollingElement;
    if (!page) return undefined;
    const target = targetRef?.current;

    let frame;
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateScrollState);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (target) {
      resizeObserver.observe(target);
      target.addEventListener('scroll', scheduleUpdate, { passive: true });
    } else {
      resizeObserver.observe(document.documentElement);
      resizeObserver.observe(document.body);
      window.addEventListener('scroll', scheduleUpdate, { passive: true });
      window.addEventListener('resize', scheduleUpdate);
    }
    scheduleUpdate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      if (target) target.removeEventListener('scroll', scheduleUpdate);
      else {
        window.removeEventListener('scroll', scheduleUpdate);
        window.removeEventListener('resize', scheduleUpdate);
      }
    };
  }, [location.pathname, targetRef, updateScrollState]);

  if (!canScrollUp && !canScrollDown) return null;

  const movePage = (direction) => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = targetRef?.current;
    const pageHeight = target ? target.clientHeight : window.innerHeight;
    const amount = direction * Math.max(pageHeight * 0.72, 180);
    if (target) target.scrollBy({ top: amount, behavior: reducedMotion ? 'auto' : 'smooth' });
    else window.scrollBy({ top: amount, behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  return <nav className={`scroll-arrows ${targetRef ? 'scroll-arrows-sidebar' : ''} ${className}`} aria-label={targetRef ? 'Sidebar navigation scrolling controls' : 'Page scrolling controls'}>
    {canScrollUp && <button type="button" className="scroll-arrow scroll-arrow-up" aria-label="Scroll up" title="Scroll up" onClick={() => movePage(-1)}><ChevronUp size={19} /></button>}
    {canScrollDown && <button type="button" className="scroll-arrow scroll-arrow-down" aria-label="Scroll down" title="Scroll down" onClick={() => movePage(1)}><ChevronDown size={19} /></button>}
  </nav>;
}
