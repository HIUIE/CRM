export function withTransition(cb: () => void) {
  if ((document as any).startViewTransition) {
    (document as any).startViewTransition(cb);
  } else {
    cb();
  }
}
