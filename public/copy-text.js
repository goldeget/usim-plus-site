// Plain copy only: never pass URLs or serialized JSON through this normalizer.
(function (root) {
  function normalize(value) { return String(value ?? '').replace(/\r\n?/g, '\n').replaceAll('\\n', '\n').trim(); }
  function render(element, value) {
    element.replaceChildren();
    const text = normalize(value);
    if (!text) return;
    for (const paragraph of text.split(/\n[\t ]*\n(?:[\t ]*\n)*/)) {
      const p = element.ownerDocument.createElement('p');
      paragraph.trim().split('\n').forEach((line, index) => {
        if (index) p.append(element.ownerDocument.createElement('br'));
        p.append(element.ownerDocument.createTextNode(line));
      });
      element.append(p);
    }
  }
  root.ClimeCopy = Object.freeze({ normalize, render });
})(globalThis);
