type DocumentWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => void;
};

export function withTransition(cb: () => void) {
  const doc = document as DocumentWithViewTransition;
  if (doc.startViewTransition) {
    doc.startViewTransition(cb);
  } else {
    cb();
  }
}
