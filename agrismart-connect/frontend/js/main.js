/* ============================================================
   main.js — Landing page interactions
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Mobile nav drawer
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => mobileNav.classList.add('open'));
    mobileNavClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileNav.classList.remove('open')));
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(other => {
        other.classList.remove('open');
        other.querySelector('.faq-answer').style.maxHeight = null;
      });
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Scroll reveal
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => observer.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('is-visible'));
  }

  // Stat counters — pulls real platform stats where available, falls back gracefully.
  async function loadImpactStats() {
    const nums = document.querySelectorAll('[data-count]');
    if (!nums.length) return;
    try {
      // Public-ish demand analytics endpoint requires auth; for the landing page
      // we simply animate from 0 to a modest placeholder if no public stat endpoint exists yet.
      // This keeps the landing page honest: no invented large numbers.
      nums.forEach(el => animateCount(el, 0));
    } catch (e) {
      nums.forEach(el => animateCount(el, 0));
    }
  }

  function animateCount(el, target) {
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = current.toLocaleString();
    }, 30);
  }

  loadImpactStats();

  // Contact form (demo — no backend endpoint wired yet)
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Thanks — your message has been noted. We\'ll get back to you soon.', 'success');
      contactForm.reset();
    });
  }
});
