(() => {
  'use strict';

  const body = document.body;
  const menuToggle = document.getElementById('menu-toggle');
  const navigation = document.getElementById('navigation');
  const navLinks = [...navigation.querySelectorAll('a')];
  const sections = [...document.querySelectorAll('[data-slide]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scrollBehavior = () => reducedMotion.matches ? 'instant' : 'smooth';

  function closeMenu() {
    navigation.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menu');
  }

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    navigation.classList.toggle('is-open', isOpen);
  });
  navLinks.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) closeMenu();
  });

  const galleryButtons = [...document.querySelectorAll('[data-gallery]')];
  const gallery = galleryButtons.map(button => ({
    src: button.querySelector('img').getAttribute('src'),
    alt: button.querySelector('img').getAttribute('alt'),
    caption: button.querySelector('strong').textContent,
  }));
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightbox-image');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxCount = document.getElementById('lightbox-count');
  let galleryIndex = 0;
  let galleryOrigin = null;

  function showGalleryImage(index) {
    galleryIndex = (index + gallery.length) % gallery.length;
    const item = gallery[galleryIndex];
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt;
    lightboxCaption.textContent = item.caption + ' · Visualização do conceito AURION P1';
    lightboxCount.textContent = String(galleryIndex + 1).padStart(2, '0') + ' / ' + String(gallery.length).padStart(2, '0');
  }

  galleryButtons.forEach(button => button.addEventListener('click', () => {
    galleryOrigin = button;
    showGalleryImage(Number(button.dataset.gallery));
    body.classList.add('dialog-open');
    lightbox.showModal();
  }));
  document.getElementById('lightbox-close').addEventListener('click', () => lightbox.close());
  document.getElementById('lightbox-previous').addEventListener('click', () => showGalleryImage(galleryIndex - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => showGalleryImage(galleryIndex + 1));
  lightbox.addEventListener('close', () => {
    body.classList.remove('dialog-open');
    galleryOrigin?.focus({ preventScroll: true });
  });
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) lightbox.close();
  });

  const presentationTrigger = document.getElementById('presentation-trigger');
  const presentationBar = document.getElementById('presentation-bar');
  const slideLabel = document.getElementById('slide-label');
  const previousSlide = document.getElementById('previous-slide');
  const nextSlide = document.getElementById('next-slide');
  let presenting = false;
  let slideIndex = 0;
  let pendingSlide = null;
  let pendingSlideTimer = null;

  function updateSlideLabel(index) {
    slideIndex = index;
    slideLabel.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(sections.length).padStart(2, '0') + ' — ' + sections[index].dataset.label;
    previousSlide.disabled = index === 0;
    nextSlide.disabled = index === sections.length - 1;
    navLinks.forEach(link => {
      if (link.hash === '#' + sections[index].id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function navigateSlide(index) {
    const boundedIndex = Math.max(0, Math.min(sections.length - 1, index));
    pendingSlide = boundedIndex;
    window.clearTimeout(pendingSlideTimer);
    updateSlideLabel(boundedIndex);
    sections[boundedIndex].scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    pendingSlideTimer = window.setTimeout(() => {
      pendingSlide = null;
      syncCurrentSection();
    }, reducedMotion.matches ? 0 : 1000);
  }

  function exitPresentation() {
    if (!presenting) return;
    presenting = false;
    pendingSlide = null;
    window.clearTimeout(pendingSlideTimer);
    body.classList.remove('is-presenting');
    presentationBar.hidden = true;
    sections[slideIndex].scrollIntoView({ behavior: 'instant', block: 'start' });
    presentationTrigger.focus({ preventScroll: true });
  }

  presentationTrigger.addEventListener('click', () => {
    closeMenu();
    presenting = true;
    body.classList.add('is-presenting');
    presentationBar.hidden = false;
    navigateSlide(0);
    nextSlide.focus({ preventScroll: true });
  });
  previousSlide.addEventListener('click', () => navigateSlide(slideIndex - 1));
  nextSlide.addEventListener('click', () => navigateSlide(slideIndex + 1));
  document.getElementById('exit-presentation').addEventListener('click', exitPresentation);

  let scrollScheduled = false;
  function syncCurrentSection() {
    scrollScheduled = false;
    if (pendingSlide !== null) {
      if (Math.abs(sections[pendingSlide].getBoundingClientRect().top) < 4) {
        pendingSlide = null;
        window.clearTimeout(pendingSlideTimer);
      } else {
        return;
      }
    }
    const focusY = window.innerHeight * 0.28;
    let nearestIndex = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= focusY) nearestIndex = index;
    });
    updateSlideLabel(nearestIndex);
  }
  window.addEventListener('scroll', () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      window.requestAnimationFrame(syncCurrentSection);
    }
  }, { passive: true });
  window.addEventListener('resize', syncCurrentSection);
  syncCurrentSection();

  document.addEventListener('keydown', event => {
    if (lightbox.open) {
      if (event.key === 'ArrowRight') { event.preventDefault(); showGalleryImage(galleryIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); showGalleryImage(galleryIndex - 1); }
      return;
    }
    if (event.key === 'Escape') {
      closeMenu();
      exitPresentation();
      return;
    }
    if (!presenting || event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === 'ArrowDown') {
      event.preventDefault();
      navigateSlide(slideIndex + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'ArrowUp') {
      event.preventDefault();
      navigateSlide(slideIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      navigateSlide(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      navigateSlide(sections.length - 1);
    }
  });
})();
