/** Browser-only spot check for the site's opaque text and solid backgrounds, not a WCAG certification. */
export function visibleContrastFailures() {
  const channels = (value) => value.match(/[\d.]+/g).map(Number);
  const luminance = (rgb) => rgb.slice(0, 3).map((value) => {
    const normalized = value / 255;
    return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const background = (element) => {
    for (let current = element; current; current = current.parentElement) {
      const rgb = channels(getComputedStyle(current).backgroundColor);
      if (rgb.length === 3 || rgb[3] > 0) return rgb;
    }
    throw new Error("No opaque page background");
  };
  return [...document.querySelectorAll("p,h1,h2,h3,a,li,dt,dd,summary,th,td,.preview-notice")].flatMap((element) => {
    if (!element.getBoundingClientRect().height) return [];
    const style = getComputedStyle(element);
    const foreground = luminance(channels(style.color)), behind = luminance(background(element));
    const ratio = (Math.max(foreground, behind) + .05) / (Math.min(foreground, behind) + .05);
    const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700);
    return ratio >= (large ? 3 : 4.5) ? [] : [{ text: element.textContent.trim().slice(0, 90), ratio, required: large ? 3 : 4.5 }];
  });
}
