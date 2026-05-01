import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateFunction } from 'react-router-dom';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => void;
};

export function withTransition(cb: () => void) {
  const doc = document as DocumentWithViewTransition;
  if (!doc.startViewTransition) {
    cb();
    return;
  }
  doc.startViewTransition(() => {
    flushSync(() => {
      cb();
    });
  });
}

/**
 * Drop-in replacement for react-router-dom's useNavigate().
 * All navigation calls are automatically wrapped with the View Transitions API
 * so page transitions animate smoothly without per-call boilerplate.
 */
export function useNavigateWithTransition(): NavigateFunction {
  const navigate = useNavigate();

  return useCallback(
    ((to: any, options?: any) => {
      const doc = document as DocumentWithViewTransition;
      if (!doc.startViewTransition) {
        navigate(to, options);
        return;
      }
      doc.startViewTransition(() => {
        flushSync(() => {
          navigate(to, options);
        });
      });
    }) as NavigateFunction,
    [navigate],
  );
}
