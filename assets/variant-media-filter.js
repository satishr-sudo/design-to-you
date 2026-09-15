/**
 * Variant Media Filter
 *
 * Filters the product media gallery to show only images that belong to the
 * currently selected colour variant.
 *
 * Architecture notes:
 * - Horizon's variant-picker.js fetches updated section HTML on variant change
 *   and dispatches a `variant:update` event (bubble phase) on the section element.
 * - media-gallery.js listens to that event (also bubble phase) and replaces
 *   the entire <media-gallery> element with the server-rendered version.
 * - By registering a CAPTURE-phase listener on the same section ancestor we run
 *   *before* media-gallery.js and can filter the HTML document in-place before
 *   it is committed to the DOM.
 *
 * Variant–image grouping strategy (positional):
 * - A <script data-variant-media-json> block inside <media-gallery> contains a
 *   map of variantId → [mediaId, …] built server-side in Liquid.
 * - That map is produced by positional analysis: all media items between
 *   variant A's featured_media position and variant B's featured_media position
 *   are considered to belong to variant A.
 * - Images before the first variant boundary are treated as "global" and always
 *   included.
 */

const VARIANT_UPDATE_EVENT = 'variant:update';

class VariantMediaFilter {
  /** @type {Map<number, Set<number>>} variantId → Set of allowed mediaIds */
  #groups = new Map();

  /** @type {HTMLElement} */
  #section;

  /** @type {AbortController} */
  #controller = new AbortController();

  /** @param {HTMLElement} section */
  constructor(section) {
    this.#section = section;
  }

  init() {
    const gallery = this.#section.querySelector('media-gallery');
    if (!gallery) return;

    this.#loadGroups(gallery);

    if (this.#groups.size === 0) return;

    // Capture phase: fires before media-gallery.js's bubble-phase handler on
    // the same ancestor element, letting us pre-filter the HTML document.
    this.#section.addEventListener(VARIANT_UPDATE_EVENT, this.#onVariantUpdate, {
      capture: true,
      signal: this.#controller.signal,
    });
  }

  /** Read the variant-media JSON block embedded inside a gallery element. */
  #loadGroups(gallery) {
    const script = gallery.querySelector('script[data-variant-media-json]');
    if (!script) return;

    let data;
    try {
      data = JSON.parse(script.textContent);
    } catch {
      return;
    }

    const map = data?.variantMedia;
    if (!map) return;

    for (const [idStr, mediaIds] of Object.entries(map)) {
      if (Array.isArray(mediaIds) && mediaIds.length > 0) {
        this.#groups.set(parseInt(idStr, 10), new Set(mediaIds));
      }
    }
  }

  /** @param {CustomEvent} event */
  #onVariantUpdate = (event) => {
    const html = event.detail?.data?.html;
    const variant = event.detail?.resource;
    if (!html || !variant) return;

    // Refresh groups from the new HTML in case a combined-listing product changed.
    const newGallery = html.querySelector('media-gallery');
    if (!newGallery) return;

    const variantId = parseInt(variant.id, 10);

    // Re-read groups from the fresh HTML (keeps combined-listing support working).
    const tempGroups = new Map();
    const jsonScript = newGallery.querySelector('script[data-variant-media-json]');
    if (jsonScript) {
      try {
        const data = JSON.parse(jsonScript.textContent);
        const map = data?.variantMedia;
        if (map) {
          for (const [idStr, mediaIds] of Object.entries(map)) {
            if (Array.isArray(mediaIds) && mediaIds.length > 0) {
              tempGroups.set(parseInt(idStr, 10), new Set(mediaIds));
            }
          }
        }
      } catch {
        // fall through — use cached groups
      }
    }

    const activeGroups = tempGroups.size > 0 ? tempGroups : this.#groups;
    if (activeGroups.size === 0) return;

    const allowed = activeGroups.get(variantId);
    if (!allowed || allowed.size === 0) return;

    this.#filterGallery(newGallery, allowed);
  };

  /**
   * Remove slides (and their matching controls) that do not belong to the
   * selected variant, then re-sequence the remaining elements so the slideshow
   * component receives a consistent, zero-based set of slides.
   *
   * @param {Element} gallery  The <media-gallery> element from the parsed HTML.
   * @param {Set<number>} allowed  Media IDs that should remain visible.
   */
  #filterGallery(gallery, allowed) {
    const slides = Array.from(
      gallery.querySelectorAll('slideshow-slide[data-slide-media-id]')
    );

    if (slides.length === 0) return;

    // Indices (original) of slides that must be removed.
    const removeIndices = /** @type {number[]} */ ([]);
    slides.forEach((slide, i) => {
      const id = parseInt(slide.dataset.slideMediaId, 10);
      if (!allowed.has(id)) removeIndices.push(i);
    });

    if (removeIndices.length === 0) return;

    // Remove in reverse so earlier indices stay valid.
    const descIndices = [...removeIndices].sort((a, b) => b - a);

    // --- Remove slides ---
    descIndices.forEach((i) => slides[i].remove());

    // --- Remove matching controls (thumbnails / dots) for each control set ---
    gallery.querySelectorAll('slideshow-controls').forEach((controls) => {
      // Thumbnails
      const thumbs = Array.from(
        controls.querySelectorAll('.slideshow-controls__thumbnail')
      );
      descIndices.forEach((i) => thumbs[i]?.remove());

      // Dot buttons (wrapped in <li>)
      const dots = Array.from(controls.querySelectorAll('[ref="dots[]"]'));
      descIndices.forEach((i) => dots[i]?.closest('li')?.remove());
    });

    // --- Remove matching zoom-dialog items ---
    const zoomItems = Array.from(
      gallery.querySelectorAll('.dialog-zoomed-gallery li[ref="media[]"]')
    );
    const zoomThumbs = Array.from(
      gallery.querySelectorAll('.dialog-thumbnails-list button')
    );

    // Match zoom items to remove by their nested data-media-id attribute.
    const zoomRemoveIndices = /** @type {number[]} */ ([]);
    zoomItems.forEach((item, i) => {
      const mediaDiv = item.querySelector('[data-media-id]');
      if (mediaDiv) {
        const id = parseInt(mediaDiv.dataset.mediaId, 10);
        if (!allowed.has(id)) zoomRemoveIndices.push(i);
      }
    });
    const descZoomIndices = [...zoomRemoveIndices].sort((a, b) => b - a);
    descZoomIndices.forEach((i) => {
      zoomItems[i]?.remove();
      zoomThumbs[i]?.remove();
    });

    // -----------------------------------------------------------------------
    // Re-sequence remaining elements so slide indices are 0-based and
    // contiguous, matching what the Slideshow component expects.
    // -----------------------------------------------------------------------
    const remainingSlides = Array.from(gallery.querySelectorAll('slideshow-slide'));
    const newCount = remainingSlides.length;

    remainingSlides.forEach((slide, newIdx) => {
      slide.setAttribute('aria-hidden', newIdx === 0 ? 'false' : 'true');
      // Update CSS timeline variable used by scroll-timeline animations.
      const style = slide.getAttribute('style') ?? '';
      slide.setAttribute(
        'style',
        style.replace(
          /--slideshow-timeline:\s*--slide-\d+/,
          `--slideshow-timeline: --slide-${newIdx}`
        )
      );
    });

    // Update slideshow-component's timeline scope to match new count.
    const slideshowComp = gallery.querySelector('slideshow-component');
    if (slideshowComp && newCount > 0) {
      const newScope = Array.from({ length: newCount }, (_, i) => `--slide-${i}`).join(',');
      const style = slideshowComp.getAttribute('style') ?? '';
      slideshowComp.setAttribute(
        'style',
        style.replace(/--slideshow-timeline:\s*[^;]+/, `--slideshow-timeline: ${newScope}`)
      );

      // Single-media class when only one slide remains.
      if (newCount === 1) {
        slideshowComp.classList.add('slideshow--single-media');
        gallery.classList.add('product-media-gallery__slideshow--single-media');
      }
    }

    // Re-sequence each control set independently.
    gallery.querySelectorAll('slideshow-controls').forEach((controls) => {
      // Thumbnails: update on:click index and reset aria-selected.
      const remainingThumbs = Array.from(
        controls.querySelectorAll('.slideshow-controls__thumbnail')
      );
      remainingThumbs.forEach((thumb, newIdx) => {
        this.#reindexOnClick(thumb, 'on:click', '/select/', newIdx);
        thumb.toggleAttribute('aria-selected', newIdx === 0);
        thumb.setAttribute(
          'aria-label',
          thumb.getAttribute('aria-label')?.replace(/\d+\s*\/\s*\d+/, `${newIdx + 1} / ${remainingThumbs.length}`) ??
            thumb.getAttribute('aria-label') ?? ''
        );
      });

      // Dots: update on:click index, animation-timeline style, and aria-selected.
      const remainingDots = Array.from(controls.querySelectorAll('[ref="dots[]"]'));
      remainingDots.forEach((dot, newIdx) => {
        this.#reindexOnClick(dot, 'on:click', '/select/', newIdx);
        const dotStyle = dot.getAttribute('style') ?? '';
        dot.setAttribute(
          'style',
          dotStyle.replace(
            /animation-timeline:\s*--slide-\d+/,
            `animation-timeline: --slide-${newIdx}`
          )
        );
        dot.toggleAttribute('aria-selected', newIdx === 0);
      });

      // Counter: update the total text node (rendered as "1/<total>").
      const slash = controls.querySelector('.slash');
      if (slash) {
        const totalNode = slash.nextSibling;
        if (totalNode?.nodeType === Node.TEXT_NODE) {
          totalNode.textContent = String(newCount);
        }
      }
    });

    // Re-sequence zoom-dialog thumbnail click handlers.
    const remainingZoomThumbs = Array.from(
      gallery.querySelectorAll('.dialog-thumbnails-list button')
    );
    remainingZoomThumbs.forEach((thumb, newIdx) => {
      this.#reindexOnClick(thumb, 'on:click', '/handleThumbnailClick/', newIdx);
      this.#reindexOnClick(thumb, 'on:pointerenter', '/handleThumbnailPointerEnter/', newIdx);
      thumb.toggleAttribute('aria-selected', newIdx === 0);
    });

    // Re-sequence zoom gallery on:click on image slides that also need a fresh
    // "open" index for the zoom dialog.
    const zoomSlideButtons = Array.from(
      gallery.querySelectorAll('.product-media-container--zoomable[on\\:click]')
    );
    zoomSlideButtons.forEach((btn, newIdx) => {
      this.#reindexOnClick(btn, 'on:click', '/open/', newIdx);
    });
  }

  /**
   * Update a numeric index inside an `on:*` attribute.
   * e.g. `on:click="/select/3"` → `on:click="/select/1"`
   *
   * @param {Element} el
   * @param {string}  attrName   e.g. 'on:click'
   * @param {string}  prefix     e.g. '/select/'
   * @param {number}  newIndex
   */
  #reindexOnClick(el, attrName, prefix, newIndex) {
    const val = el.getAttribute(attrName);
    if (!val) return;
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    el.setAttribute(attrName, val.replace(new RegExp(`${escaped}\\d+`), `${prefix}${newIndex}`));
  }

  destroy() {
    this.#controller.abort();
  }
}

// ---------------------------------------------------------------------------
// Auto-initialise for every section that contains both a media-gallery and a
// variant-picker (i.e. every product page / featured-product section).
// ---------------------------------------------------------------------------
function initAll() {
  document.querySelectorAll('media-gallery').forEach((gallery) => {
    const section = gallery.closest('.shopify-section, dialog');
    if (!section) return;
    if (!section.querySelector('variant-picker')) return;

    const filter = new VariantMediaFilter(/** @type {HTMLElement} */ (section));
    filter.init();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}
